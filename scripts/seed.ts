/**
 * Seeds a demo user with realistic multi-currency data.
 *   pnpm seed
 * Login: demo@finance.local / demo1234
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, client } from "../src/lib/db";
import { assets, portfolios, transactions, users } from "../src/lib/db/schema";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);

async function upsertAsset(a: typeof assets.$inferInsert) {
  const [existing] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.symbol, a.symbol))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(assets).values(a).returning({ id: assets.id });
  return created.id;
}

async function main() {
  const email = "demo@finance.local";
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  let userId = existingUser?.id;

  if (!userId) {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: "Demo",
        passwordHash: await bcrypt.hash("demo1234", 10),
        baseCurrency: "USD",
      })
      .returning({ id: users.id });
    userId = created.id;
    console.log("Created user", email);
  }

  const [portfolio] = await db
    .insert(portfolios)
    .values({ userId, name: "Long-term" })
    .returning({ id: portfolios.id });

  const ids = {
    aapl: await upsertAsset({ symbol: "AAPL", name: "Apple Inc.", type: "stock", currency: "USD" }),
    msft: await upsertAsset({ symbol: "MSFT", name: "Microsoft Corp.", type: "stock", currency: "USD" }),
    spy: await upsertAsset({ symbol: "SPY", name: "SPDR S&P 500 ETF", type: "etf", currency: "USD" }),
    btc: await upsertAsset({ symbol: "BTC", name: "Bitcoin", type: "crypto", currency: "USD", externalId: "bitcoin" }),
    eth: await upsertAsset({ symbol: "ETH", name: "Ethereum", type: "crypto", currency: "USD", externalId: "ethereum" }),
    ptt: await upsertAsset({ symbol: "PTT.BK", name: "PTT PCL", type: "stock", currency: "THB" }),
  };

  const txs: Array<typeof transactions.$inferInsert> = [
    { portfolioId: portfolio.id, assetId: ids.aapl, type: "buy", quantity: "10", price: "150.20", fee: "1.99", occurredAt: daysAgo(300) },
    { portfolioId: portfolio.id, assetId: ids.aapl, type: "buy", quantity: "5", price: "172.40", fee: "1.99", occurredAt: daysAgo(150) },
    { portfolioId: portfolio.id, assetId: ids.aapl, type: "dividend", quantity: "26", price: "0", occurredAt: daysAgo(120) },
    { portfolioId: portfolio.id, assetId: ids.msft, type: "buy", quantity: "8", price: "310.00", fee: "1.99", occurredAt: daysAgo(280) },
    { portfolioId: portfolio.id, assetId: ids.spy, type: "buy", quantity: "15", price: "410.50", fee: "2.50", occurredAt: daysAgo(320) },
    { portfolioId: portfolio.id, assetId: ids.spy, type: "dividend", quantity: "31.80", price: "0", occurredAt: daysAgo(90) },
    { portfolioId: portfolio.id, assetId: ids.btc, type: "buy", quantity: "0.35", price: "42000", fee: "0", occurredAt: daysAgo(260) },
    { portfolioId: portfolio.id, assetId: ids.btc, type: "buy", quantity: "0.15", price: "57500", fee: "0", occurredAt: daysAgo(140) },
    { portfolioId: portfolio.id, assetId: ids.eth, type: "buy", quantity: "2.4", price: "2250", fee: "0", occurredAt: daysAgo(230) },
    { portfolioId: portfolio.id, assetId: ids.eth, type: "sell", quantity: "0.6", price: "3050", fee: "0", occurredAt: daysAgo(60) },
    { portfolioId: portfolio.id, assetId: ids.ptt, type: "buy", quantity: "300", price: "34.25", fee: "105.00", occurredAt: daysAgo(200) },
    { portfolioId: portfolio.id, assetId: ids.ptt, type: "dividend", quantity: "1026", price: "0", note: "THB cash dividend", occurredAt: daysAgo(45) },
  ];
  await db.insert(transactions).values(txs);

  console.log(`Seeded ${txs.length} transactions into "Long-term".`);
  console.log("Login: demo@finance.local / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
