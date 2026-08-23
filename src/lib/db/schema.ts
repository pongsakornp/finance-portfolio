import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const assetTypeEnum = pgEnum("asset_type", [
  "stock",
  "etf",
  "crypto",
  "commodity",
  "cash",
  "mutualfund",
]);
export const txTypeEnum = pgEnum("tx_type", ["buy", "sell", "dividend"]);
export const alertDirectionEnum = pgEnum("alert_direction", ["above", "below"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  baseCurrency: text("base_currency").notNull().default("USD"), // "USD" | "THB"
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: text("symbol").notNull(), // AAPL, BTC, PTT.BK
    name: text("name").notNull(),
    type: assetTypeEnum("type").notNull(),
    currency: text("currency").notNull().default("USD"),
    externalId: text("external_id"), // CoinGecko id (crypto only), e.g. "bitcoin"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("assets_symbol_type_uq").on(t.symbol, t.type)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    type: txTypeEnum("type").notNull(),
    // buy/sell: quantity in units + price per unit. dividend: quantity = cash amount paid
    quantity: numeric("quantity", { precision: 28, scale: 10 }).notNull(),
    price: numeric("price", { precision: 20, scale: 8 }).notNull(),
    fee: numeric("fee", { precision: 20, scale: 8 }).notNull().default("0"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("tx_portfolio_date_idx").on(t.portfolioId, t.occurredAt)]
);

export const priceCache = pgTable("price_cache", {
  assetId: uuid("asset_id")
    .primaryKey()
    .references(() => assets.id, { onDelete: "cascade" }),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  previousClose: numeric("previous_close", { precision: 20, scale: 8 }),
  currency: text("currency").notNull().default("USD"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export const priceHistory = pgTable(
  "price_history",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
    source: integer("source").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.day] })]
);

export const fxRates = pgTable("fx_rates", {
  pair: text("pair").primaryKey(), // "USD/THB"
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    valueUsd: numeric("value_usd", { precision: 20, scale: 2 }).notNull(),
    costUsd: numeric("cost_usd", { precision: 20, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex("snapshots_portfolio_day_uq").on(t.portfolioId, t.day)]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(), // sha256 of the plaintext token
    prefix: text("prefix").notNull(), // display hint only, e.g. "skp_ab12cd34"
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash)]
);

export const alerts = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  direction: alertDirectionEnum("direction").notNull(),
  threshold: numeric("threshold", { precision: 20, scale: 8 }).notNull(),
  active: boolean("active").notNull().default(true),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
