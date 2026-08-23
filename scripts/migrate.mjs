/**
 * Applies Drizzle migrations at container boot (bundled self-contained for the runtime image).
 * Migration SQL lives in ./drizzle (copied into the image).
 */
import { existsSync } from "node:fs";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL is not set");
    return 1;
  }
  if (!existsSync("./drizzle")) {
    console.error("[migrate] ./drizzle folder missing from image");
    return 1;
  }

  const sql = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("[migrate] done");
    return 0;
  } catch (e) {
    console.error("[migrate] failed:", e);
    return 1;
  } finally {
    await sql.end();
  }
}

main().then((code) => process.exit(code));
