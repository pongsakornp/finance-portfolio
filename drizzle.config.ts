import { defineConfig } from "drizzle-kit";

// drizzle-kit loads .env automatically
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/finance",
  },
});
