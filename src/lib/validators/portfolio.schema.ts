import { z } from "zod";

export const createPortfolioSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60, "Max 60 characters"),
});

export const renamePortfolioSchema = z.object({
  id: z.uuid("Invalid portfolio ID"),
  name: z.string().trim().min(1, "Name required").max(60, "Max 60 characters"),
});

export const deletePortfolioSchema = z.object({
  id: z.uuid("Invalid portfolio ID"),
});

export const reorderPortfoliosSchema = z.object({
  orderedIds: z
    .array(z.uuid("Invalid portfolio ID"))
    .min(1, "At least one portfolio is required")
    .refine((ids) => new Set(ids).size === ids.length, "Portfolio IDs must be unique"),
});

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type RenamePortfolioInput = z.infer<typeof renamePortfolioSchema>;
export type ReorderPortfoliosInput = z.infer<typeof reorderPortfoliosSchema>;
