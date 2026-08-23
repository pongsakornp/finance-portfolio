import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// ponytail: local fallback URL so build never crashes without env; real value comes from DATABASE_URL at runtime
const connectionString =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/finance";

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema, client };
