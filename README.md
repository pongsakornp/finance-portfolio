# Finance Portfolio

Self-hosted multi-user tracker for stocks, ETFs and crypto. Ledger-based: you record transactions, the app computes holdings, P/L, allocation and performance. USD/THB display.

Stack: Next.js 16 · Tailwind CSS v4 · PostgreSQL + Drizzle · Auth.js v5 · Recharts · Dokploy/Docker.

## Quick start (local)

```bash
npx --yes pnpm@10 install
cp .env.example .env            # set DATABASE_URL + AUTH_SECRET
docker compose up -d db         # or point DATABASE_URL anywhere Postgres lives
npx --yes pnpm@10 db:migrate    # create tables
npx --yes pnpm@10 seed          # optional demo data
npx --yes pnpm@10 dev           # http://localhost:3000
```

Demo login after seeding: `demo@finance.local` / `demo1234`.

## Docs

- [`AGENTS.md`](./AGENTS.md) — architecture rules & conventions (start here)
- [`DESIGN.md`](./design.md) — product spec, ERD, formulas, UI design system, deploy topology

## Deploy (Dokploy)

Create a Compose service from this repo; set env `POSTGRES_PASSWORD` and `AUTH_SECRET` (`openssl rand -base64 32`). The app container runs migrations on boot and exposes `/api/health`.

## Verify before committing

```bash
npx --yes pnpm@10 typecheck && npx --yes pnpm@10 lint && npx --yes pnpm@10 test && npx --yes pnpm@10 build
```
