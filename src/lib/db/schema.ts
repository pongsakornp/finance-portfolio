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
export const marketEnum = pgEnum("asset_market", ["US", "SET"]);
export const txTypeEnum = pgEnum("tx_type", ["buy", "sell"]);
export const alertDirectionEnum = pgEnum("alert_direction", ["above", "below"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // Password-less OAuth accounts are supported alongside credentials accounts.
  passwordHash: text("password_hash"),
  baseCurrency: text("base_currency").notNull().default("USD"), // "USD" | "THB"
  plView: text("pl_view").notNull().default("unrealized"), // "unrealized" | "daily"
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Stable external identities for OAuth users. Sessions remain JWT-based, so this
 * is intentionally narrower than Auth.js's full adapter schema.
 */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("oauth_accounts_user_id_idx").on(t.userId),
  ]
);

export const portfolios = pgTable("portfolios", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // The first portfolio in a user's explicit order is their default portfolio.
  sortOrder: integer("sort_order").notNull().default(0),
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
    // Localized names are kept independently so a future instrument picker can
    // search and display either language without losing the canonical name.
    nameEn: text("name_en"),
    nameTh: text("name_th"),
    type: assetTypeEnum("type").notNull(),
    currency: text("currency").notNull().default("USD"),
    market: marketEnum("market").notNull().default("US"), // US | SET (Stock Exchange of Thailand)
    externalId: text("external_id"), // CoinMarketCap numeric ID (crypto only), e.g. "1"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // A ticker is only unique within its market: the same symbol can be listed
  // in the US and on SET, with different native currencies and quotes.
  (t) => [uniqueIndex("assets_symbol_type_market_uq").on(t.symbol, t.type, t.market)]
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
    // buy/sell: quantity in units + price per unit
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

export const benchmarkCache = pgTable(
  "benchmark_cache",
  {
    index: text("index").notNull(),
    day: date("day").notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.index, t.day] })]
);

export const fxRates = pgTable("fx_rates", {
  pair: text("pair").primaryKey(), // "USD/THB"
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export const fxHistory = pgTable(
  "fx_history",
  {
    pair: text("pair").notNull(), // "USD/THB"
    day: date("day").notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.pair, t.day] })]
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

// Finnomena fund registry (mutual funds): short_code is the master mutual-fund symbol.
export const fundCatalog = pgTable("fund_catalog", {
  shortCode: text("short_code").primaryKey(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// CoinMarketCap registry: cmc_id is the stable identifier used for crypto quotes.
export const cryptoCatalog = pgTable(
  "crypto_catalog",
  {
    cmcId: text("cmc_id").primaryKey(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("crypto_catalog_symbol_idx").on(t.symbol)]
);
