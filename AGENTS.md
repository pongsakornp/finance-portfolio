# AGENTS.md — Operating Guide for AI Agents

This file is the **entry point** for any AI agent working in this repo. Read it fully before writing code. Product spec, architecture and UI design system live in [`design.md`](./design.md).

## What this is

A multi-user financial portfolio tracker (stocks, ETFs, crypto) built with Next.js 16 App Router, Tailwind CSS v4, PostgreSQL + Drizzle, Auth.js v5. Self-hosted via Dokploy/Docker.

## Commands

Package manager is **pnpm 10** (pinned via `"packageManager"`). Your global pnpm may be older — always run it through npx:

```bash
P="npx --yes pnpm@10.12.1"
$P install            # install
$P dev                # dev server on :3000
$P build              # production build
$P typecheck          # tsc --noEmit        ┐
$P lint               # eslint              ├ ALL THREE must pass before you commit
$P test               # vitest run          ┘
$P db:generate        # drizzle-kit generate (after schema.ts edits)
$P db:migrate         # apply migrations locally
$P seed               # demo data: demo@finance.local / demo1234
```

Local dev needs Postgres running (`docker compose up db` or any instance) and `.env` copied from `.env.example`.

## Non-negotiable architecture rules

The dependency direction is one-way. Never break it:

```
page (server component)
   → server action ("use server" in src/actions/)
      → service (src/lib/services/, pure or DB-bound)
         → db (src/lib/db/)
```

1. **Components never fetch external APIs or query the DB directly.** All Yahoo Finance / CoinGecko / FX calls go through `src/lib/services/quote-service.ts` and `fx-service.ts`. Pages assemble data through `view-service` / `valuation-service`.
2. **All mutations go through server actions** in `src/actions/*.actions.ts`. Every action validates input with the zod schemas in `src/lib/validators/` and scopes reads/writes to `requireUserId()`. Ownership check on every portfolio-scoped mutation.
3. **Holdings/P-L are always computed, never stored.** Balances derive from the `transactions` ledger at read time (avg-cost method in `holdings-service.ts`). There is no mutable "position" table — do not add one.
4. **Money discipline:** DB amounts are `numeric` (they come back as strings — parse once with `num()`/parseFloat at the edge); math uses `Decimal.js` inside services; UI receives plain numbers. Never use float arithmetic on money paths.
5. **Quotes are cached:** pages never hit external APIs even indirectly more than needed — `getQuote()` enforces TTLs (stock/ETF 5 min, crypto 60 s) against the `price_cache` table and falls back to stale values when upstream fails. Historical closes go through `price_history` via `ensureHistory()`.
6. **Timestamps are UTC ISO everywhere**; dates in the DB use `date`/`timestamptz`; format for display only at the render edge.

## Schema changes

Edit `src/lib/db/schema.ts` → run `$P db:generate` → commit `schema.ts` **and** the new files in `/drizzle` together. Migrations are applied automatically by `docker-entrypoint.sh` at container boot. Never hand-edit migration SQL.

## New-feature recipe

Follow this order; copy an existing feature as your template:

1. zod validator in `src/lib/validators/<domain>.schema.ts`
2. pure logic in `src/lib/services/` (+ unit test in `tests/`)
3. server action(s) in `src/actions/<domain>.actions.ts`
4. UI component(s) in `src/components/features/`
5. page wiring in `src/app/(app)/…`

## UI rules

- Use the vendored shadcn/ui primitives in `src/components/ui/` as-is. Do not restyle them ad hoc; do not add a component library.
- Design tokens (colors incl. semantic `success`/`warning`, chart palette, radius) live in `src/app/globals.css` under `@theme`. Reference tokens (`bg-background`, `text-muted-foreground`, …), never raw hex.
- Dark mode is class-based (`next-themes`) and must work for every screen you touch.
- P/L values render through `<PL>` / `<PLPct>` so green/red semantics stay consistent.
- Full visual spec: `design.md`.

## Conventions

- Files: components PascalCase, everything else kebab/camelCase per existing layout. Colocate feature components under `src/components/features/<feature>/`.
- Server vs client: default to server components; add `"use client"` only where interactivity requires it (forms, charts, dialogs).
- Error style: actions return `{ ok?: true } | { error: string }` — no thrown errors across the action boundary; toast them client-side.
- Comments only for non-obvious decisions; keep the `ponytail:` convention for deliberate simplifications (grep it before "improving" those spots).
- No secrets in code. `.env` is gitignored; `.env.example` documents every variable.

## Definition of done (every change)

```bash
npx --yes pnpm@10.12.1 typecheck && npx --yes pnpm@10.12.1 lint && npx --yes pnpm@10.12.1 test && npx --yes pnpm@10.12.1 build
```

All four green, plus: new domain logic has a test in `tests/`, `revalidatePath` called for every mutated view, ownership enforced, dark mode checked.

## Deployment (Dokploy)

Compose project from this repo: `db` (postgres:16-alpine, volume `pgdata`) + `app` (built from `Dockerfile`). Required env in Dokploy UI: `POSTGRES_PASSWORD`, `AUTH_SECRET` (32+ random chars). Migrations run on boot via entrypoint; healthcheck hits `/api/health`; cron jobs start automatically with the server (`CRON_ENABLED=false` disables).
