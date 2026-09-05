import { z } from "zod";

export const ASSET_TYPES = [
  "stock",
  "etf",
  "crypto",
  "commodity",
  "mutualfund",
] as const;

export const MARKETS = ["US", "SET"] as const;

export const upsertAssetSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.trim().toUpperCase()),
  name: z.string().min(1).max(80),
  type: z.enum(ASSET_TYPES),
  currency: z.string().length(3).default("USD"),
  market: z.enum(MARKETS).default("US"),
  externalId: z.string().max(60).optional(),
}).superRefine((data, ctx) => {
  if (data.type === "crypto" && !/^[1-9]\d*$/.test(data.externalId ?? "")) {
    ctx.addIssue({ code: "custom", path: ["externalId"], message: "CoinMarketCap ID is required" });
  }
});

export const transactionObjectBaseSchema = z.object({
  portfolioId: z.uuid(),
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.trim().toUpperCase()),
  assetType: z.enum(ASSET_TYPES),
  assetName: z.string().min(1).max(80).optional(),
  externalId: z.string().max(60).optional(),
  market: z.enum(MARKETS).optional(),
  type: z.enum(["buy", "sell"]),
  quantity: z.coerce.number().finite("Must be a finite number").positive("Must be > 0"),
  price: z.coerce.number().finite("Must be a finite number").nonnegative("Must be >= 0"),
  fee: z.coerce.number().finite("Must be a finite number").nonnegative().default(0),
  occurredAt: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), {
    message: "Invalid date",
  }),
  note: z.string().max(200).optional(),
});

export const transactionObjectSchema = transactionObjectBaseSchema.superRefine((data, ctx) => {
  if (data.assetType === "crypto" && !/^[1-9]\d*$/.test(data.externalId ?? "")) {
    ctx.addIssue({ code: "custom", path: ["externalId"], message: "CoinMarketCap ID is required" });
  }
});

export const createTransactionSchema = transactionObjectSchema.refine(
  (data) => data.price > 0,
  { message: "Price must be > 0 for buy and sell transactions", path: ["price"] }
);

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;
/** Input shape: fields with defaults (currency) stay optional */
export type UpsertAssetInput = z.input<typeof upsertAssetSchema>;
