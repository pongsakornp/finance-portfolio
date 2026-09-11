# AGENTS.md — Operating Guide for AI Agents

This file is the **entry point** for any AI agent working in this repo. Read it fully before writing code. Product spec, architecture and UI design system live in [`design.md`](./design.md).

## What this is

A multi-user financial portfolio tracker (stocks, ETFs, crypto) built with Next.js 16 App Router, Tailwind CSS v4, PostgreSQL + Drizzle, Auth.js v5. Self-hosted via Dokploy/Docker.

## Commands

Package manager is pinned by `"packageManager"` in `package.json` — that field is the single source of truth, never hardcode the version elsewhere. `pnpm-workspace.yaml` enables `manage-package-manager-versions`, so a local pnpm ≥9.7 auto-switches to the pinned version; on machines without pnpm, run it through npx:

```bash
P="npx --yes pnpm"
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

Named test environment (build + start + seed): `./scripts/start.sh <env> [no-seed]` — see [Docker workflow](#workflow-code--checks--docker-deploy--verify).

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

- **Prefer shadcn/ui; never hand-roll custom UI.** Compose from the vendored primitives in `src/components/ui/` (Base UI, style `base-rhea`). Do not write bespoke buttons, empty states, checkboxes, toggles, charts, form layouts, or sidebar markup when a shadcn primitive covers it.
- Add any missing primitive with the project runner: `pnpm dlx shadcn@latest add <component>` (e.g. `empty`, `checkbox`, `toggle-group`, `chart`, `field`, `sidebar`). It writes Base UI-consistent files into `src/components/ui/`. Before writing a styled `div`, check whether a shadcn component already exists.
- Right component for the job: `Empty` for empty states, `Checkbox` for booleans, `ToggleGroup` for 2–8 static options, `Chart` (wraps Recharts) for charts, `Field`/`FieldGroup` for labelled form controls, `Sidebar` for app navigation, `Card` for panels, `Table` for tabular data, `Badge` for status, `Separator` for dividers.
- Composing layouts is fine, but compose **from** shadcn primitives — don't restyle them ad hoc and don't introduce a second component library.
- Design tokens (colors incl. semantic `success`/`warning`, chart palette, radius) live in `src/app/globals.css` under `@theme`. Reference tokens (`bg-background`, `text-muted-foreground`, …), never raw hex.
- Dark mode is class-based (`next-themes`) and must work for every screen you touch.
- P/L values render through `<PL>` / `<PLPct>` so green/red semantics stay consistent — the one deliberate custom component, mandated by design.
- Full visual spec: `design.md`.

## Conventions

- Files: components PascalCase, everything else kebab/camelCase per existing layout. Colocate feature components under `src/components/features/<feature>/`.
- Server vs client: default to server components; add `"use client"` only where interactivity requires it (forms, charts, dialogs).
- Prefer composing shadcn primitives over custom markup. If a hand-rolled `div` starts to look like a button/table/empty state/form row, swap it for the corresponding shadcn component.
- Error style: actions return `{ ok?: true } | { error: string }` — no thrown errors across the action boundary; toast them client-side.
- Comments only for non-obvious decisions; keep the `ponytail:` convention for deliberate simplifications (grep it before "improving" those spots).
- No secrets in code. `.env` is gitignored; `.env.example` documents every variable.

## Definition of done (every change)

```bash
npx --yes pnpm typecheck && npx --yes pnpm lint && npx --yes pnpm test && npx --yes pnpm build
```

All four green, plus: new domain logic has a test in `tests/`, `revalidatePath` called for every mutated view, ownership enforced, dark mode checked.

## Workflow (code → checks → Docker deploy → verify)

The full loop for any change:

1. **Code** — follow the [New-feature recipe](#new-feature-recipe). One feature per branch.
2. **Checks** — gate on the four commands before committing:
   ```bash
   npx --yes pnpm typecheck && npx --yes pnpm lint && npx --yes pnpm test && npx --yes pnpm build
   ```
   `.env` must exist (copy from `.env.example`) for local ops.
3. **Deploy on Docker** — build and start the whole Compose project (db + app); migrations run on boot:
   ```bash
   docker compose up --build -d --force-recreate
   ```
   Requires `POSTGRES_PASSWORD` and `AUTH_SECRET` in `.env` (any values work locally; `AUTH_SECRET` 32+ chars — `openssl rand -base64 32`). `CRON_ENABLED=false` keeps local runs quiet. Watch migrations + startup with `docker compose logs -f app`.
   For an isolated named environment (own containers/volume, auto-picked host ports, optional seed) use `./scripts/start.sh <env> [no-seed]` — it runs the same `up --build -d --force-recreate` under `docker compose -p <env>`, so containers/volume become `<env>_app`/`<env>_db`/`<env>_pgdata`. Pass `no-seed` to skip seeding on re-run (the seed re-inserts a portfolio + transactions, so don't re-seed an env that already has data).
4. **Verify** — wait for the server, then:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health   # 200 = healthy
   ```
    - Login at `/login` (seed demo user: `npx --yes pnpm seed` → `demo@finance.local` / `demo1234`).
   - Exercise the changed paths in the browser.
   - Check data landed: `docker compose exec db psql -U finance -d finance -c "SELECT ..."`.
   - Confirm no error lines: `docker compose logs --tail 50 app | grep -iE "error|throw|unhandled"`.
   - Reset cleanly with `docker compose down -v` (drops the `pgdata` volume — re-seed after).

## MCP server (AI agent access)

`POST /mcp` is a stateless Streamable-HTTP MCP endpoint (`src/app/mcp/route.ts`, tools in `src/lib/mcp/tools.ts`). Auth is a per-user API key (Bearer `skp_…`, sha256-hashed in the `api_keys` table); users create/revoke keys at `/settings` via `src/actions/api-key.actions.ts`.

Rules:

- Tools must go through `src/lib/services/*` + zod validators — same layering as actions. Never query the DB or hit Yahoo/CoinGecko from tool callbacks directly.
- Ownership: every portfolio-scoped tool routes through `assertOwnedPortfolio` (`src/lib/services/portfolio-service.ts`).
- Mutating tools call `revalidateMutated()` so UI caches stay consistent.
- Client config example:

```json
{
  "mcpServers": {
    "portfolio": {
      "type": "http",
      "url": "https://<host>/mcp",
      "headers": { "Authorization": "Bearer skp_..." }
    }
  }
}
```

## Releases

`main` releases via release-please (`.github/workflows/release.yml`). Write [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:` …) — the release PR's version bump and `CHANGELOG.md` derive from them. Merging the release PR tags `vX.Y.Z` and publishes multi-arch GHCR images (`X.Y.Z`, `X.Y`, `X`, `latest`); plain `main` pushes publish `edge` + `sha-…`. Never tag or bump versions by hand. Node runtime is pinned by `.nvmrc` (24) and `engines.node`.

## Deployment (Dokploy)

Compose project from this repo: `db` (postgres:16-alpine, volume `pgdata`) + `app` (built from `Dockerfile`). Required env in Dokploy UI: `POSTGRES_PASSWORD`, `AUTH_SECRET` (32+ random chars). Migrations run on boot via entrypoint; healthcheck hits `/api/health`; cron jobs start automatically with the server (`CRON_ENABLED=false` disables).
