import { z } from "zod";

export const createAlertSchema = z.object({
  symbol: z.string().min(1).max(20),
  assetType: z.enum(["stock", "etf", "crypto"]),
  direction: z.enum(["above", "below"]),
  threshold: z.coerce.number().positive("Must be > 0"),
});

export type CreateAlertInput = z.infer<typeof createAlertSchema>;

export const setBaseCurrencySchema = z.object({
  baseCurrency: z.enum(["USD", "THB"]),
});
