import { z } from "zod";

export const upsertAssetSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.trim().toUpperCase()),
  name: z.string().min(1).max(80),
  type: z.enum(["stock", "etf", "crypto"]),
  currency: z.string().length(3).default("USD"),
  externalId: z.string().max(60).optional(),
});

export const createTransactionSchema = z.object({
  portfolioId: z.uuid(),
  symbol: z.string().min(1).max(20),
  assetType: z.enum(["stock", "etf", "crypto"]),
  assetName: z.string().min(1).max(80).optional(),
  externalId: z.string().max(60).optional(),
  type: z.enum(["buy", "sell", "dividend"]),
  quantity: z.coerce.number().positive("Must be > 0"),
  price: z.coerce.number().nonnegative("Must be >= 0"),
  fee: z.coerce.number().nonnegative().default(0),
  occurredAt: z.coerce.date(),
  note: z.string().max(200).optional(),
});

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;
/** Input shape: fields with defaults (currency) stay optional */
export type UpsertAssetInput = z.input<typeof upsertAssetSchema>;
