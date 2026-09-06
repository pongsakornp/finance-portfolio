import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { baseRate, loadFxHistory } from "@/lib/services/fx-service";
import { buildHoldingsView, getUserTransactions, getUserPortfolios } from "@/lib/services/view-service";
import { monthlyBreakdown, toBaseReportTxs } from "@/lib/services/report-service";
import { benchmarkSeries, portfolioSeries } from "@/lib/services/valuation-service";
import { getQuoteForRequest } from "@/lib/services/quote-service";
import { getPortfolioHoldingsSnapshot } from "@/lib/services/portfolio-export-service";
import { getUserBaseCurrency, setUserBaseCurrency } from "@/lib/services/user-settings-service";
import { createAlert, deleteAlert, listAlerts, setAlertActive } from "@/lib/services/alert-service";
import { searchStocks } from "@/lib/services/stock-search-service";
import { searchCryptoCatalog } from "@/lib/services/crypto-catalog-service";
import { searchCommodities } from "@/lib/services/commodity-search-service";
import { searchFundCatalog } from "@/lib/services/fund-catalog-service";
import {
  assertOwnedPortfolio,
  createPortfolio,
  deletePortfolio,
  renamePortfolio,
  reorderPortfolios,
} from "@/lib/services/portfolio-service";
import {
  createTransaction,
  deleteTransaction,
  importTransactions,
  updateTransaction,
} from "@/lib/services/transaction-service";
import { whatIfSell } from "@/lib/services/holdings-service";
import {
  createAlertSchema,
  setBaseCurrencySchema,
} from "@/lib/validators/alert.schema";
import { reorderPortfoliosSchema } from "@/lib/validators/portfolio.schema";
import {
  ASSET_TYPES,
  transactionObjectBaseSchema,
} from "@/lib/validators/transaction.schema";

const okJson = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const asError = (e: unknown) => ({
  content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
  isError: true,
});

function revalidateMutated() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/portfolios");
  revalidatePath("/settings");
}

// z.coerce.date() can't serialize to JSON Schema (breaks tools/list) — ISO strings over the wire
const mcpTxObjectSchema = transactionObjectBaseSchema.extend({
  occurredAt: z.iso.datetime(),
});
const mcpTxSchema = mcpTxObjectSchema
  .superRefine((data, ctx) => {
    if (data.assetType === "crypto" && !/^[1-9]\d*$/.test(data.externalId ?? "")) {
      ctx.addIssue({ code: "custom", path: ["externalId"], message: "CoinMarketCap ID is required" });
    }
  })
  .refine((data) => data.price > 0, {
    message: "Price must be > 0 for buy and sell transactions",
    path: ["price"],
  });

/** Loads holdings views scoped to the user; throws when portfolioId is foreign. */
async function loadViews(userId: string, portfolioId?: string) {
  const list = (await getUserPortfolios(userId)).filter(
    (p) => !portfolioId || p.id === portfolioId
  );
  if (portfolioId && list.length === 0) throw new Error("Portfolio not found");
  return Promise.all(
    list.map(async (p) => ({
      portfolio: p,
      view: await buildHoldingsView(await getUserTransactions(userId, p.id)),
    }))
  );
}

function convertTotals(totals: {
  marketValue: number; costBasis: number; unrealizedPL: number; realizedPL: number; dayChange: number;
  unrealizedPLPct: number; dayChangePct: number;
}, rate: number) {
  const money = (value: number) => Math.round(value * rate * 100) / 100;
  return {
    marketValue: money(totals.marketValue),
    costBasis: money(totals.costBasis),
    unrealizedPL: money(totals.unrealizedPL),
    unrealizedPLPct: totals.unrealizedPLPct,
    realizedPL: money(totals.realizedPL),
    dayChange: money(totals.dayChange),
    dayChangePct: totals.dayChangePct,
  };
}

async function convertUsdSeries(points: Array<{ day: string; value: number }>, baseCurrency: string) {
  if (baseCurrency === "USD" || points.length === 0) return points;
  const current = await baseRate(baseCurrency);
  const history = await loadFxHistory([baseCurrency], points[0].day);
  const baseToUsd = history.get(baseCurrency);
  return points.map((point) => {
    const rate = baseToUsd?.get(point.day);
    const usdToBase = rate && rate > 0 ? 1 / rate : current;
    return { day: point.day, value: Math.round(point.value * usdToBase * 100) / 100 };
  });
}

export function buildMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "seabiscuit-portfolio",
    version: "1.0.0",
  });

  // ── reads ────────────────────────────────────────────────────────────────

  server.registerTool(
    "list_portfolios",
    {
      description:
        "List the user's portfolios with totals in the user's selected base currency.",
      inputSchema: {},
    },
    async () => {
      try {
        const [views, baseCurrency] = await Promise.all([loadViews(userId), getUserBaseCurrency(userId)]);
        const rate = await baseRate(baseCurrency);
        return okJson(
          {
            baseCurrency,
            portfolios: views.map(({ portfolio, view }) => ({
              id: portfolio.id,
              name: portfolio.name,
              holdingsCount: view.rows.filter((r) => r.position.qty > 0).length,
              totals: convertTotals(view.totalsUsd, rate),
            })),
          },
        );
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_portfolio_snapshot",
    {
      description: "Complete current holdings snapshot for one owned portfolio, in the user's base currency.",
      inputSchema: { portfolioId: z.uuid() },
    },
    async ({ portfolioId }) => {
      try {
        return okJson(await getPortfolioHoldingsSnapshot(userId, portfolioId));
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_portfolio_summary",
    {
      description:
        "Aggregate totals for one portfolio or all portfolios in the user's selected base currency.",
      inputSchema: { portfolioId: z.uuid().optional() },
    },
    async ({ portfolioId }) => {
      try {
        const [views, baseCurrency] = await Promise.all([loadViews(userId, portfolioId), getUserBaseCurrency(userId)]);
        const t = views.map((v) => v.view.totalsUsd);
        const sum = (k: "marketValue" | "costBasis" | "realizedPL" | "dayChange") =>
          t.reduce((a, x) => a + x[k], 0);
        const mv = sum("marketValue");
        const cost = sum("costBasis");
        const dayChange = sum("dayChange");
        const prevMv = mv - dayChange;
        const totals = views.length === 1
          ? t[0]
          : {
              marketValue: Math.round(mv * 100) / 100,
              costBasis: Math.round(cost * 100) / 100,
              unrealizedPL: Math.round((mv - cost) * 100) / 100,
              unrealizedPLPct: cost > 0 ? parseFloat(((mv - cost) / cost * 100).toFixed(2)) : 0,
              realizedPL: sum("realizedPL"),
              dayChange: Math.round(dayChange * 100) / 100,
              dayChangePct: prevMv > 0 ? parseFloat((dayChange / prevMv * 100).toFixed(2)) : 0,
            };
        return okJson({ baseCurrency, totals: convertTotals(totals, await baseRate(baseCurrency)) });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_transactions",
    {
      description:
        "Transaction ledger, oldest first. Filter by portfolio/symbol/since.",
      inputSchema: {
        portfolioId: z.uuid().optional(),
        symbol: z.string().max(20).optional(),
        // ISO string over the wire — z.coerce.date() can't serialize to JSON Schema (breaks tools/list)
        since: z.iso.datetime().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    async ({ portfolioId, symbol, since, limit }) => {
      try {
        if (portfolioId) await assertOwnedPortfolio(portfolioId, userId);
        let rows = await getUserTransactions(userId, portfolioId);
        if (symbol) {
          const s = symbol.toUpperCase();
          rows = rows.filter((r) => r.asset.symbol === s);
        }
        if (since) {
          const d = new Date(since);
          rows = rows.filter((r) => r.occurredAt >= d);
        }
        return okJson({
          transactions: rows.slice(-limit).map((r) => ({
            id: r.id,
            portfolioId: r.portfolioId,
            occurredAt: r.occurredAt.toISOString(),
            type: r.type,
            symbol: r.asset.symbol,
            assetType: r.asset.type,
            assetName: r.asset.name,
            assetNameEn: r.asset.nameEn,
            assetNameTh: r.asset.nameTh,
            currency: r.asset.currency,
            market: r.asset.market,
            externalId: r.asset.externalId,
            quantity: parseFloat(r.quantity),
            price: parseFloat(r.price),
            fee: parseFloat(r.fee),
            note: r.note,
          })),
        });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_portfolio_history",
    {
      description:
        "Daily portfolio value in the user's base currency, reconstructed from historical closes. days 7–365, default 90.",
      inputSchema: {
        portfolioId: z.uuid().optional(),
        days: z.number().int().min(7).max(365).default(90),
      },
    },
    async ({ portfolioId, days }) => {
      try {
        if (portfolioId) await assertOwnedPortfolio(portfolioId, userId);
        const [txs, baseCurrency] = await Promise.all([getUserTransactions(userId, portfolioId), getUserBaseCurrency(userId)]);
        return okJson({ baseCurrency, points: await convertUsdSeries(await portfolioSeries(txs, days), baseCurrency) });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_benchmark_comparison",
    {
      description:
        "Portfolio value in the user's base currency versus S&P 500 index points (absolute levels, not normalized).",
      inputSchema: {
        portfolioId: z.uuid().optional(),
        days: z.number().int().min(7).max(365).default(90),
      },
    },
    async ({ portfolioId, days }) => {
      try {
        if (portfolioId) await assertOwnedPortfolio(portfolioId, userId);
        const [txs, baseCurrency] = await Promise.all([getUserTransactions(userId, portfolioId), getUserBaseCurrency(userId)]);
        const [series, bench] = await Promise.all([
          portfolioSeries(txs, days),
          benchmarkSeries(days),
        ]);
        return okJson({
          baseCurrency,
          portfolio: await convertUsdSeries(series, baseCurrency),
          benchmark: { symbol: "^GSPC", unit: "index-points", points: bench },
        });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_monthly_report",
    {
      description:
        "Monthly invested, proceeds, fees, and realized P/L in the user's selected base currency.",
      inputSchema: { portfolioId: z.uuid().optional() },
    },
    async ({ portfolioId }) => {
      try {
        if (portfolioId) await assertOwnedPortfolio(portfolioId, userId);
        const [txs, baseCurrency] = await Promise.all([getUserTransactions(userId, portfolioId), getUserBaseCurrency(userId)]);
        return okJson({ baseCurrency, rows: monthlyBreakdown(await toBaseReportTxs(txs, baseCurrency)) });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_quote",
    {
      description:
        "Live quote for an asset symbol (5-min stock/ETF TTL, 60s crypto), served through the app's price cache.",
      inputSchema: {
        symbol: z.string().min(1).max(20),
        assetType: z.enum(ASSET_TYPES).optional(),
        assetMarket: z.enum(["US", "SET"]).optional(),
        externalId: z.string().max(60).optional(),
      },
    },
    async ({ symbol, assetType, assetMarket, externalId }) => {
      try {
        const result = await getQuoteForRequest({
          symbol,
          assetType: assetType ?? "stock",
          assetMarket: assetMarket ?? (symbol.toUpperCase().endsWith(".BK") ? "SET" : "US"),
          externalId,
        });
        if (result.assetCreated) revalidateMutated();
        return okJson(result);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "search_assets",
    {
      description: "Find stock/ETF, crypto, commodity-futures, or Thai mutual-fund symbols before creating a transaction or alert.",
      inputSchema: {
        query: z.string().min(1).max(160),
        category: z.enum(["security", "crypto", "commodity", "mutualfund"]),
        market: z.enum(["US", "SET"]).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ query, category, market, limit }) => {
      try {
        if (category === "security") {
          const resolvedMarket = market ?? "US";
          const rows = await searchStocks(query, resolvedMarket, limit);
          return okJson({ results: rows.map((r) => ({ symbol: r.symbol, name: r.nameEn, assetType: r.assetType, market: resolvedMarket })) });
        }
        if (category === "crypto") {
          const rows = await searchCryptoCatalog(query, limit);
          return okJson({ results: rows.map((r) => ({ symbol: r.symbol, name: r.name, assetType: "crypto", market: "US", externalId: r.cmcId })) });
        }
        if (category === "commodity") {
          const rows = await searchCommodities(query, limit);
          return okJson({ results: rows.map((r) => ({ symbol: r.symbol, name: r.name, assetType: "commodity", market: "US" })) });
        }
        const rows = await searchFundCatalog(query, limit);
        return okJson({ results: rows.map((r) => ({ symbol: r.shortCode, name: r.name, assetType: "mutualfund", market: "SET" })) });
      } catch (e) {
        return asError(e);
      }
    }
  );

  // ── writes ───────────────────────────────────────────────────────────────

  server.registerTool(
    "create_portfolio",
    {
      description: "Create a new empty portfolio (max 60 chars).",
      inputSchema: { name: z.string().min(1).max(60) },
    },
    async ({ name }) => {
      try {
        const created = await createPortfolio(userId, name.trim());
        revalidatePath("/portfolios");
        revalidatePath("/dashboard");
        return okJson(created);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "delete_portfolio",
    {
      description:
        "Delete a portfolio and cascade-delete its transactions. Irreversible.",
      inputSchema: { portfolioId: z.uuid() },
    },
    async ({ portfolioId }) => {
      try {
        await deletePortfolio(portfolioId, userId);
        revalidateMutated();
        return okJson({ deleted: portfolioId });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "rename_portfolio",
    {
      description: "Rename a portfolio (max 60 chars).",
      inputSchema: { portfolioId: z.uuid(), name: z.string().min(1).max(60) },
    },
    async ({ portfolioId, name }) => {
      try {
        const updated = await renamePortfolio(portfolioId, userId, name.trim());
        revalidateMutated();
        return okJson(updated);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "reorder_portfolios",
    {
      description: "Set the complete ordered portfolio ID list; the first portfolio becomes the default.",
      inputSchema: reorderPortfoliosSchema.shape,
    },
    async (args) => {
      const parsed = reorderPortfoliosSchema.safeParse(args);
      if (!parsed.success) return asError(new Error(parsed.error.issues[0]?.message ?? "Invalid portfolio order"));
      try {
        await reorderPortfolios(userId, parsed.data.orderedIds);
        revalidateMutated();
        return okJson({ orderedIds: parsed.data.orderedIds });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "add_transaction",
    {
      description:
        "Record a buy or sell. buy/sell take quantity in units + price per unit. Crypto assets require a numeric CoinMarketCap ID. occurredAt is an ISO datetime.",
      inputSchema: mcpTxObjectSchema.shape,
    },
    async (args) => {
      try {
        const parsed = mcpTxSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
        }
        await createTransaction(userId, {
          ...parsed.data,
          occurredAt: new Date(parsed.data.occurredAt),
        });
        revalidateMutated();
        return okJson({ recorded: true });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "delete_transaction",
    {
      description: "Delete one transaction by id (ownership enforced).",
      inputSchema: { transactionId: z.uuid() },
    },
    async ({ transactionId }) => {
      try {
        await deleteTransaction(transactionId, userId);
        revalidateMutated();
        return okJson({ deleted: transactionId });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "update_transaction",
    {
      description: "Replace one owned transaction. Fields match add_transaction; occurredAt is an ISO datetime.",
      inputSchema: { transactionId: z.uuid(), ...mcpTxObjectSchema.shape },
    },
    async ({ transactionId, ...args }) => {
      try {
        const parsed = mcpTxSchema.safeParse(args);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
        await updateTransaction(userId, transactionId, { ...parsed.data, occurredAt: new Date(parsed.data.occurredAt) });
        revalidateMutated();
        return okJson({ updated: transactionId });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "import_transactions",
    {
      description:
        "Bulk-import parsed broker/CSV rows into one portfolio. Per-row validation errors are reported, valid rows still import.",
      inputSchema: {
        portfolioId: z.uuid(),
        rows: z.array(
          transactionObjectBaseSchema
            .omit({ portfolioId: true, occurredAt: true })
            .extend({ occurredAt: z.iso.datetime() })
        ),
      },
    },
    async ({ portfolioId, rows }) => {
      try {
        const result = await importTransactions(rows, portfolioId, userId);
        revalidateMutated();
        return okJson(result);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "set_base_currency",
    {
      description: "Set the user's base display currency (USD or THB).",
      inputSchema: setBaseCurrencySchema.shape,
    },
    async ({ baseCurrency }) => {
      try {
        await setUserBaseCurrency(userId, baseCurrency);
        revalidateMutated();
        return okJson({ baseCurrency });
      } catch (e) {
        return asError(e);
      }
    }
  );

  // ── alerts ───────────────────────────────────────────────────────────────

  server.registerTool(
    "list_alerts",
    {
      description: "All price alerts for the user with their assets.",
      inputSchema: {},
    },
    async () => {
      try {
        return okJson({ alerts: await listAlerts(userId) });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "create_alert",
    {
      description: "Create a price alert: notify when price goes above/below a threshold.",
      inputSchema: { ...createAlertSchema.shape, externalId: z.string().max(60).optional() },
    },
    async ({ symbol, assetType, market, direction, threshold, externalId }) => {
      try {
        const parsed = createAlertSchema.safeParse({ symbol, assetType, market, direction, threshold });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid alert");
        const created = await createAlert(userId, { ...parsed.data, externalId });
        revalidateMutated();
        return okJson(created);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "delete_alert",
    {
      description: "Delete a price alert (ownership enforced).",
      inputSchema: { alertId: z.uuid() },
    },
    async ({ alertId }) => {
      try {
        await deleteAlert(alertId, userId);
        revalidateMutated();
        return okJson({ deleted: alertId });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "toggle_alert",
    {
      description: "Pause (false) or re-arm (true) an alert; re-arming clears its trigger stamp.",
      inputSchema: { alertId: z.uuid(), active: z.boolean() },
    },
    async ({ alertId, active }) => {
      try {
        await setAlertActive(alertId, userId, active);
        revalidateMutated();
        return okJson({ alertId, active });
      } catch (e) {
        return asError(e);
      }
    }
  );

  // ── hypothetical ─────────────────────────────────────────────────────────

  server.registerTool(
    "what_if_sell",
    {
      description:
        "Estimate proceeds and realized P/L for selling a quantity at the current price, WITHOUT recording anything. Amounts in the asset's native currency.",
      inputSchema: {
        symbol: z.string().min(1).max(20),
        quantity: z.number().positive(),
        portfolioId: z.uuid().optional(),
      },
    },
    async ({ symbol, quantity, portfolioId }) => {
      try {
        const s = symbol.toUpperCase();
        const views = await loadViews(userId, portfolioId);
        for (const { portfolio, view } of views) {
          const row = view.rows.find((r) => r.asset.symbol === s && r.position.qty > 0);
          if (!row) continue;
          return okJson({
            portfolio: portfolio.name,
            symbol: s,
            currency: row.asset.currency,
            ...whatIfSell(row.position, quantity),
          });
        }
        throw new Error(`No position in ${s}`);
      } catch (e) {
        return asError(e);
      }
    }
  );

  return server;
}
