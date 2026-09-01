import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { alerts, assets, portfolios, users } from "@/lib/db/schema";
import { convert } from "@/lib/services/fx-service";
import { buildHoldingsView, getUserTransactions, getUserPortfolios } from "@/lib/services/view-service";
import { monthlyBreakdown } from "@/lib/services/report-service";
import { benchmarkSeries, portfolioSeries } from "@/lib/services/valuation-service";
import { getQuote } from "@/lib/services/quote-service";
import { assertOwnedPortfolio } from "@/lib/services/portfolio-service";
import {
  createTransaction,
  deleteTransaction,
  importTransactions,
  upsertAsset,
} from "@/lib/services/transaction-service";
import { whatIfSell } from "@/lib/services/holdings-service";
import {
  createAlertSchema,
  setBaseCurrencySchema,
} from "@/lib/validators/alert.schema";
import {
  ASSET_TYPES,
  transactionObjectSchema,
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
}

// z.coerce.date() can't serialize to JSON Schema (breaks tools/list) — ISO strings over the wire
const mcpTxObjectSchema = transactionObjectSchema.extend({
  occurredAt: z.iso.datetime(),
});
const mcpTxSchema = mcpTxObjectSchema.refine(
  (data) => data.price > 0,
  { message: "Price must be > 0 for buy and sell transactions", path: ["price"] }
);

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
        "List the user's portfolios with USD totals: market value, cost basis, unrealized/realized P/L, day change.",
      inputSchema: {},
    },
    async () => {
      try {
        const views = await loadViews(userId);
        return okJson(
          views.map(({ portfolio, view }) => ({
            id: portfolio.id,
            name: portfolio.name,
            holdingsCount: view.rows.filter((r) => r.position.qty > 0).length,
            totals: view.totalsUsd,
          })),
        );
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_holdings",
    {
      description:
        "Current positions with avg cost and live quotes, normalized to USD. Omit portfolioId for all portfolios.",
      inputSchema: { portfolioId: z.uuid().optional() },
    },
    async ({ portfolioId }) => {
      try {
        const views = await loadViews(userId, portfolioId);
        return okJson(
          views.flatMap(({ portfolio, view }) =>
            view.rows.map((r) => ({
              portfolio: portfolio.name,
              symbol: r.asset.symbol,
              name: r.asset.name,
              type: r.asset.type,
              currency: r.asset.currency,
              qty: r.position.qty,
              avgCost: r.position.avgCost,
              currentPrice: r.price,
              previousClose: r.previousClose,
              valueUsd: r.valueUsd,
              costUsd: r.costUsd,
              unrealizedPL: r.valueUsd - r.costUsd,
              unrealizedPLPct: r.position.unrealizedPLPct,
              realizedPL: r.position.realizedPL,
            }))
          )
        );
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_portfolio_summary",
    {
      description:
        "Aggregate totals per portfolio (or combined across all): value, cost, P/L, day change.",
      inputSchema: { portfolioId: z.uuid().optional() },
    },
    async ({ portfolioId }) => {
      try {
        const views = await loadViews(userId, portfolioId);
        const t = views.map((v) => v.view.totalsUsd);
        const sum = (k: "marketValue" | "costBasis" | "realizedPL" | "dayChange") =>
          t.reduce((a, x) => a + x[k], 0);
        const mv = sum("marketValue");
        const cost = sum("costBasis");
        const dayChange = sum("dayChange");
        const prevMv = mv - dayChange;
        const out = views.length === 1
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
        return okJson(out);
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
        return okJson(
          rows.slice(-limit).map((r) => ({
            id: r.id,
            portfolioId: r.portfolioId,
            occurredAt: r.occurredAt.toISOString(),
            type: r.type,
            symbol: r.asset.symbol,
            assetType: r.asset.type,
            quantity: parseFloat(r.quantity),
            price: parseFloat(r.price),
            fee: parseFloat(r.fee),
            note: r.note,
          }))
        );
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_portfolio_history",
    {
      description:
        "Daily USD portfolio value reconstructed from historical closes. days clamped 7–365, default 90.",
      inputSchema: {
        portfolioId: z.uuid().optional(),
        days: z.number().int().min(7).max(365).default(90),
      },
    },
    async ({ portfolioId, days }) => {
      try {
        if (portfolioId) await assertOwnedPortfolio(portfolioId, userId);
        const txs = await getUserTransactions(userId, portfolioId);
        return okJson(await portfolioSeries(txs, days));
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_benchmark_comparison",
    {
      description:
        "Portfolio daily value vs S&P 500 index closes (absolute levels, not normalized).",
      inputSchema: {
        portfolioId: z.uuid().optional(),
        days: z.number().int().min(7).max(365).default(90),
      },
    },
    async ({ portfolioId, days }) => {
      try {
        if (portfolioId) await assertOwnedPortfolio(portfolioId, userId);
        const txs = await getUserTransactions(userId, portfolioId);
        const [series, bench] = await Promise.all([
          portfolioSeries(txs, days),
          benchmarkSeries(days),
        ]);
        return okJson({ portfolio: series, benchmark: bench });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "get_monthly_report",
    {
      description:
        "Monthly invested/sold/fees breakdown. Amounts in each asset's native currency (not converted).",
      inputSchema: { portfolioId: z.uuid().optional() },
    },
    async ({ portfolioId }) => {
      try {
        if (portfolioId) await assertOwnedPortfolio(portfolioId, userId);
        const txs = await getUserTransactions(userId, portfolioId);
        return okJson(monthlyBreakdown(txs));
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
      },
    },
    async ({ symbol, assetType, assetMarket }) => {
      try {
        let [asset] = await db
          .select()
          .from(assets)
          .where(
            and(
              eq(assets.symbol, symbol.toUpperCase()),
              assetType ? eq(assets.type, assetType) : undefined
            )
          )
          .limit(1);
        if (!asset) {
          const id = await upsertAsset({
            symbol: symbol.toUpperCase(),
            name: symbol.toUpperCase(),
            type: assetType ?? "stock",
            market: assetMarket ?? (symbol.toUpperCase().endsWith(".BK") ? "SET" : "US"),
          });
          [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
        }
        if (!asset) throw new Error(`Unknown asset ${symbol}`);
        return okJson(await getQuote(asset));
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "convert_currency",
    {
      description: "Convert an amount between currencies using cached FX rates.",
      inputSchema: {
        amount: z.number(),
        from: z.string().length(3),
        to: z.string().length(3),
      },
    },
    async ({ amount, from, to }) => {
      try {
        return okJson({
          amount,
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          converted: await convert(amount, from.toUpperCase(), to.toUpperCase()),
        });
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
        const [created] = await db
          .insert(portfolios)
          .values({ userId, name })
          .returning({ id: portfolios.id, name: portfolios.name });
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
        await assertOwnedPortfolio(portfolioId, userId);
        await db.delete(portfolios).where(eq(portfolios.id, portfolioId));
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
        await assertOwnedPortfolio(portfolioId, userId);
        const [updated] = await db
          .update(portfolios)
          .set({ name })
          .where(eq(portfolios.id, portfolioId))
          .returning({ id: portfolios.id, name: portfolios.name });
        revalidateMutated();
        return okJson(updated);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "add_transaction",
    {
      description:
        "Record a buy or sell. buy/sell take quantity in units + price per unit. occurredAt is an ISO datetime.",
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
    "import_transactions",
    {
      description:
        "Bulk-import parsed broker/CSV rows into one portfolio. Per-row validation errors are reported, valid rows still import.",
      inputSchema: {
        portfolioId: z.uuid(),
        rows: z.array(
          transactionObjectSchema
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
        await db.update(users).set({ baseCurrency }).where(eq(users.id, userId));
        revalidatePath("/", "layout");
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
        const rows = await db
          .select({ alert: alerts, asset: assets })
          .from(alerts)
          .innerJoin(assets, eq(assets.id, alerts.assetId))
          .where(eq(alerts.userId, userId));
        return okJson(
          rows.map(({ alert, asset }) => ({
            id: alert.id,
            symbol: asset.symbol,
            assetType: asset.type,
            direction: alert.direction,
            threshold: parseFloat(alert.threshold),
            active: alert.active,
            triggeredAt: alert.triggeredAt,
          }))
        );
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    "create_alert",
    {
      description: "Create a price alert: notify when price goes above/below a threshold.",
      inputSchema: createAlertSchema.shape,
    },
    async ({ symbol, assetType, market, direction, threshold }) => {
      try {
        const assetId = await upsertAsset({
          symbol,
          name: "",
          type: assetType,
          currency: assetType === "crypto" ? "USD" : undefined,
          market,
        });
        const [created] = await db
          .insert(alerts)
          .values({ userId, assetId, direction, threshold: String(threshold) })
          .returning({ id: alerts.id });
        revalidatePath("/alerts");
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
        await db.delete(alerts).where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)));
        revalidatePath("/alerts");
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
        await db
          .update(alerts)
          .set({ active, triggeredAt: active ? null : undefined })
          .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)));
        revalidatePath("/alerts");
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
