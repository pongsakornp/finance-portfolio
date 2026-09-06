# Finance Portfolio

Self-hosted multi-user tracker for stocks, ETFs and crypto. Ledger-based: you record transactions, the app computes holdings, P/L, allocation and performance. USD/THB display.

Stack: Next.js 16 · Tailwind CSS v4 · PostgreSQL + Drizzle · Auth.js v5 · Recharts · Dokploy/Docker.

## Quick start (local)

```bash
npx --yes pnpm@10 install
cp .env.example .env            # set DATABASE_URL + AUTH_SECRET + COINMARKETCAP_API_KEY
docker compose up -d db         # or point DATABASE_URL anywhere Postgres lives
npx --yes pnpm@10 db:migrate    # create tables
npx --yes pnpm@10 seed          # optional demo data
npx --yes pnpm@10 dev           # http://localhost:3000
```

Demo login after seeding: `demo@finance.local` / `demo1234`.

## Spinning up an isolated Docker test environment

`scripts/start.sh` builds and starts the whole app in an isolated Compose project, auto-picks free host ports, and seeds demo data:

```bash
./scripts/start.sh qa            # containers qa_app / qa_db
./scripts/start.sh qa no-seed    # skip seeding (re-run with existing data)
```

The environment name becomes the Compose project name, so containers and the DB volume are namespaced (`<env>_app`, `<env>_db`, `<env>_pgdata`). Multiple environments can run at once — each picks its own free ports (app from 3000, db from 5432). App URL and DB port are printed on success; login is `demo@finance.local` / `demo1234`. Requires `.env` (auto-created from `.env.example`, with `AUTH_SECRET` generated if unset).

## Docs

- [`AGENTS.md`](./AGENTS.md) — architecture rules & conventions (start here)
- [`DESIGN.md`](./design.md) — product spec, ERD, formulas, UI design system, deploy topology

## Deploy (Dokploy)

Create a Compose service from this repo; set env `POSTGRES_PASSWORD`, `AUTH_SECRET` (`openssl rand -base64 32`), and `COINMARKETCAP_API_KEY` (Startup or higher preserves five years of crypto history). The app container runs migrations on boot and exposes `/api/health`.

### Google and LINE sign-in

OAuth login is optional. Set both variables for a provider in Dokploy (or `.env`) to enable its button:

- Google: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`; add `https://<host>/api/auth/callback/google` as an authorized redirect URI in Google Cloud.
- LINE: `AUTH_LINE_ID`, `AUTH_LINE_SECRET`; activate the web app in the LINE Login channel, add `https://<host>/api/auth/callback/line` as its callback URL, and obtain Email address permission. LINE sign-in is rejected when it does not return an email address.

OAuth identities with an email matching an existing password account are linked automatically. New OAuth users are created without a local password.

## Verify before committing

```bash
npx --yes pnpm@10 typecheck && npx --yes pnpm@10 lint && npx --yes pnpm@10 test && npx --yes pnpm@10 build
```
