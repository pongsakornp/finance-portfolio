import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function getUserBaseCurrency(userId: string): Promise<string> {
  const [user] = await db
    .select({ baseCurrency: users.baseCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.baseCurrency ?? "USD";
}

export async function setUserBaseCurrency(userId: string, baseCurrency: "USD" | "THB") {
  await db.update(users).set({ baseCurrency }).where(eq(users.id, userId));
}

export async function setUserPlView(userId: string, plView: "unrealized" | "daily") {
  await db.update(users).set({ plView }).where(eq(users.id, userId));
}
