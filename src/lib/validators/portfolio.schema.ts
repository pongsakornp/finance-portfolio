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

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type RenamePortfolioInput = z.infer<typeof renamePortfolioSchema>;
