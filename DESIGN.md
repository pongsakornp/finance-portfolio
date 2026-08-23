# design.md — Architecture & UI Design System

Companion to [`AGENTS.md`](./AGENTS.md) (operational rules). This document explains *why* the system looks the way it does and specifies the visual language.

---

## 1. Product

Multi-user financial portfolio tracker for **stocks, ETFs and crypto** with USD/THB display. Users record transactions (buy/sell/dividend) against portfolios; the app computes holdings, P/L, allocation and performance from that ledger and enriches it with live/historical market data.

### Core domain concepts

| Concept | Meaning |
|---|---|
| Portfolio | Named container of transactions owned by one user |
| Asset | Shared, global: `symbol` + `type` (stock/etf/crypto) + native `currency`; crypto also carries CoinGecko `external_id` |
| Transaction | Immutable ledger row: buy / sell / dividend; dividends store the cash amount in `quantity` |
| Position | **Computed** at read time via average-cost method — never persisted |
| Snapshot | Nightly USD value/cost per portfolio (`snapshots`) for long-range charts |

### Money & P/L formulas (authoritative)

```
buy    : qty += q            cost += q·price + fee
sell   : avg  = cost / qty   realized += (price − avg)·q_sold − fee
         cost −= avg·q_sold  qty   −= q_sold        (oversell ignored)
dividend : dividends += quantity (cash)
position: unrealized = qty·currentPrice − cost
totals  : summed per asset after conversion to USD
day change: Σ qty·(currentPrice − previousClose) where prev close exists
```

Reference implementation + tests: `src/lib/services/holdings-service.ts`, `tests/holdings-service.test.ts`.

### Currency model

- Every amount lives natively in the asset's currency (e.g. `PTT.BK` → THB).
- Services normalize to **USD** internally; the display layer converts once to the user's `baseCurrency` (USD or THB) using a cached daily rate.
- ponytail simplification: historical series use today's FX rate (see `valuation-service.ts`). Upgrade path: historical fx table.

## 2. External data

| Source | Used for | Endpoint | Notes |
|---|---|---|---|
| Yahoo Finance chart API | stocks/ETF quotes + history incl. `.BK`, benchmark `^GSPC` | `query1.finance.yahoo.com/v8/finance/chart/{sym}` | unofficial; requires UA header; may rate-limit |
| CoinGecko free API | crypto price + 365 d history | `api.coingecko.com/api/v3/simple/price`, `/market_chart` | ~10-30 req/min |
| open.er-api.com | FX (USD↔THB etc.) | `/v6/latest/{base}` | daily rates |

**Caching contract** (`price_cache`, `fx_rates`, `price_history` tables):

- Quote TTL: stock/ETF **5 min**, crypto **60 s**; on upstream failure serve stale value; hard-fail only if no cache exists.
- FX TTL: **12 h**.
- History backfill: refresh when newest stored day is >3 days old; upsert idempotent.

All external traffic is confined to `quote-service.ts`, `fx-service.ts`, `valuation-service.ts`.

## 3. Data model (ERD)

```mermaid
erDiagram
    users ||--o{ portfolios : owns
    users ||--o{ alerts : configures
    portfolios ||--o{ transactions : contains
    portfolios ||--o{ snapshots : daily
    assets ||--o{ transactions : referenced
    assets ||--|| price_cache : "1:1 quote"
    assets ||--o{ price_history : daily closes
    assets ||--o{ alerts : target

    users { uuid id PK  text email UK  text password_hash  text base_currency }
    portfolios { uuid id PK  uuid user_id FK  text name }
    assets { uuid id PK  text symbol  enum type  text currency  text external_id }
    transactions { uuid id PK  uuid portfolio_id FK  uuid asset_id FK  enum type  numeric quantity 20_8  numeric price 20_8  numeric fee  timestamptz occurred_at }
    snapshots { uuid id PK  uuid portfolio_id FK  date day  numeric value_usd  numeric cost_usd }
    alerts { uuid id PK  uuid user_id FK  uuid asset_id FK  enum direction  numeric threshold  bool active  timestamptz triggered_at }
```

Key indexes: `transactions(portfolio_id, occurred_at)`, `assets(symbol,type)` unique, `snapshots(portfolio_id, day)` unique.

## 4. Request flow

```
Browser ── RSC page ──► view-service ──► holdings-service (pure math)
                            │                ▲
                            └─► quote/fx services ──► price_cache/fx_rates tables
                                                        │ miss+stale
                                                        ▼
                                              Yahoo / CoinGecko / er-api

Mutation: form ──► server action (zod validate → ownership check → db write
                        → revalidatePath) ──► toast result client-side
Background: node-cron (instrumentation.ts): nightly snapshots, hourly alert eval
```

## 5. Deployment topology (Dokploy)

```
Dokploy project
├── service "db"   postgres:16-alpine, volume pgdata, pg_isready healthcheck
└── service "app"  built from Dockerfile (multi-stage, standalone output, non-root)
      entrypoint: scripts/migrate.mjs → node server.js
      healthcheck: GET /api/health
      env: POSTGRES_PASSWORD, AUTH_SECRET, CRON_ENABLED(optional)
```

Rollback = redeploy previous git SHA; DB migrations are forward-only additive.

## 6. UI design system

### Principles

1. **Data first**: dense tabular data, generous numbers typography, zero decorative chrome.
2. **Semantic color only**: green/red are reserved exclusively for gain/loss via `<PL>`/`<PLPct>`.
3. **Server-rendered by default**: interactivity limited to forms, dialogs, charts, theme toggle.
4. Dark mode is a first-class requirement — every screen must be checked in both themes.

### Tokens (defined in `src/app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` / `foreground` | white / near-black | near-black / white | page |
| `card` | white | elevated dark | panels |
| `muted-foreground` | gray | gray | labels, secondary text |
| `primary` | black | white | main actions |
| `success` | oklch(0.62 0.17 149) | lighter variant | gains only |
| `destructive` | red | brighter red | losses, destructive actions |
| `warning` | amber | amber | sells, triggered-alerts |
| `chart-1..5` | palette | palette | donut + line series |
| `radius` | 0.625rem | same | all corners |

Never hardcode hex; reference semantic classes (`bg-card`, `text-success`, …).

### Typography & spacing

- Font: Geist Sans (UI) / Geist Mono available for code-ish values.
- Page title: `text-2xl font-semibold tracking-tight`. Card titles: `text-base`. Labels/meta: `text-xs/text-sm text-muted-foreground`.
- All numerics in tables/stat cards: `tabular-nums`.
- Spacing on a 4px grid; page container `max-w-6xl mx-auto p-4 md:p-6`; card grid gap-4.

### Layout anatomy

```
┌ sidebar 224px (md+) ┐┌ header 56px: [mobile menu] …… [currency switch][theme][sign out]
│ logo                ││
│ nav (6 items)       ││  <main max-w-6xl>
│                     ││    h1 + primary action row
└─────────────────────┘┘    stat cards grid (2×2 sm, 4 lg)
                           charts row: perf chart (2/3) + allocation (1/3)
                           data table(s) in cards
```

Mobile: sidebar collapses into a left Sheet; stat cards stack 2-up; tables scroll horizontally inside their card.

### Component inventory (all in `src/components/`)

- `ui/*` — vendored shadcn primitives (button, card, input, label, select, table, dialog, sheet, dropdown-menu, tabs, badge, separator, skeleton, textarea, sonner). Do not modify; compose instead.
- `pl.tsx` — `<PL>` signed colored amount, `<PLPct>` percent. **Every** gain/loss renders through these.
- `charts/allocation-donut` — Recharts donut by asset class.
- `charts/performance-chart` — area (portfolio % change) + dashed S&P 500 line, range tabs 1M/3M/6M/1Y, benchmark toggle.
- `features/add-transaction-dialog` — portfolio select, action select (buy/sell/dividend), asset class, symbol (+CoinGecko ID for crypto), qty/price/fee/date. Dividend mode hides price/fee and relabels quantity as cash amount.
- `features/import-client` — CSV upload → parse preview (first 20 rows) → target portfolio → import; template download link.
- `features/delete-button`, `toggle-alert-button` — icon buttons wired to bound server actions with confirm + toast.
- `currency-switcher` — global USD/THB display toggle (persists to user profile).

### States every screen must define

| State | Treatment |
|---|---|
| Empty | Centered muted sentence inside the table card ("No open positions yet — add your first transaction.") |
| Loading (charts) | Inline "Loading chart…" text block (server pages render data directly) |
| Error (quotes) | Stale cached price served silently; missing quote → em-dash cells, never a crash |
| Triggered alert | Amber `Triggered <date>` badge; pause/re-arm icons in row actions |

### Wireframes (reference screens)

Dashboard:
```
Dashboard                                    [+ Add transaction]
┌ Total value ─┬ Cost basis ─┬ Unrealized ─┬ Realized+Div ─┐
│ $128,412     │ $101,930    │ +$26,482    │ +$1,214       │
│ Today +$812  │             │ +26.0%      │ Div $57.80    │
└──────────────┴─────────────┴─────────────┴───────────────┘
┌ Performance vs S&P500 [1M 3M 6M 1Y] ☑bench ┬ Allocation  ┐
│  area chart + dashed line                  │  donut      │
└────────────────────────────────────────────┴─────────────┘
┌ Holdings(N): Asset|Qty|Avg cost|Price|Value|P/L ──────────┐
```

Transactions ledger columns: Date · Portfolio · Action(badge) · Symbol · Qty/Amount · Price · Fee · ␥delete.
Alerts columns: Asset · Condition · Current · Status badge · ␦pause/delete.

## 7. Testing strategy

- Pure money logic (`holdings-service`, `report-service`, utils) unit-tested in `tests/` — no DB mocks, fast.
- Integration/E2E deliberately omitted v1 (single maintainer app); add Playwright if the team grows.
- Manual smoke checklist before release: register→create portfolio→add buy/sell/dividend→dashboard math sanity→CSV round-trip→THB switch→dark mode→mobile layout.
