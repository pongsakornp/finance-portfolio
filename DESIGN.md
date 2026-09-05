# DESIGN.md — UI/UX Design Language

Companion to [`AGENTS.md`](./AGENTS.md) (operational & architecture rules). This document specifies the visual language: the vibe, the tokens, the layout, and the components. It does not describe data flow, the ERD, or deployment — those live in AGENTS.md.

---

## 1. Design vibe

A calm, terminal-adjacent finance tool. It should feel like a well-made private spreadsheet: dense, accurate, quietly confident. No marketing chrome, no surface-level "fintech dashboard" clichés. The interface gets out of the way of the numbers.

### Principles

1. **Numbers are the product.** Dense tabular data, generous number typography, zero decorative chrome. Every pixel either carries data or organizes it.
2. **Semantic color only.** Green/red are reserved *exclusively* for gain/loss, and always rendered through `<PL>` / `<PLPct>`. If a color appears, it means something.
3. **Server-rendered by default.** Interactivity is limited to forms, dialogs, charts, and the theme toggle.
4. **Dark mode is first-class.** Every screen is authored in both themes, never bolted on.
5. **Quiet motion.** Transitions are short and subtle, present only to orient, never to show off.

### Tone of voice

Muted, plain-English labels. "Add transaction", "Imported 12 rows", "No open positions yet". Avoid dramatic language, jargon, or financial-guru phrasing. Prices are informational, not motivational.

## 2. Tokens (defined in `src/app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` / `foreground` | white / near-black | near-black / white | page |
| `card` | white | elevated dark | panels |
| `muted-foreground` | gray | gray | labels, secondary text |
| `primary` | black | white | main actions |
| `success` | oklch(0.62 0.17 149) | lighter variant | gains only |
| `destructive` | red | brighter red | losses, destructive actions |
| `warning` | amber | amber | sells, triggered-alerts |
| `chart-1..5` | grayscale ramp | grayscale ramp | donut + line series |
| `radius` | 0.625rem | same | all corners |

Never hardcode hex; reference semantic classes (`bg-card`, `text-success`, …).

## 3. Typography & spacing

- Font: Inter (UI, via next/font `--font-sans`); Geist Mono for code-ish / monotone numerics where it aids alignment.
- Page title: `text-2xl font-semibold tracking-tight`. Card titles: `text-base`. Labels/meta: `text-xs/text-sm text-muted-foreground`.
- All numerics in tables/stat cards use `tabular-nums` so columns align and digits don't wiggle.
- Spacing on a 4px grid; page container `max-w-6xl mx-auto p-4 md:p-6`; card grid `gap-4`.

## 4. Layout anatomy

```
┌ sidebar 224px (md+) ┐┌ header 56px: [mobile menu] …… [currency switch][theme][sign out]
│ logo                ││
│ nav (6 items)       ││  <main max-w-6xl>
│                     ││    h1 + primary action row
└─────────────────────┘┘    stat cards grid (2×2 sm, 4 lg)
                           charts row: perf chart (2/3) + allocation (1/3)
                           data table(s) in cards
```

Mobile: sidebar collapses into a left Sheet; stat cards stack 2-up; data tables become stacked card-lists below `md` (desktop tables stay `md:`).

## 5. Component inventory (all in `src/components/`)

**Rule: compose from shadcn/ui; never hand-roll custom UI.** Add primitives with `pnpm dlx shadcn@latest add <component>`; use the right one for the job.

- `ui/*` — vendored shadcn primitives, Base UI, style `base-rhea`: button, card, input, label, select, table, dialog, sheet, dropdown-menu, tabs, badge, separator, skeleton, textarea, sonner, **empty, checkbox, toggle-group, chart, field, sidebar, tooltip**. Compose from these; don't restyle ad hoc.
- `pl.tsx` — `<PL>` signed colored amount, `<PLPct>` percent. **Every** gain/loss renders through these (the one deliberate custom component).
- `charts/allocation-donut` — shadcn `Chart` donut by asset class (wraps Recharts).
- `charts/performance-chart` — shadcn `Chart` area (portfolio % change) + dashed S&P 500 line, `ToggleGroup` range 1M/3M/6M/1Y, `Checkbox` benchmark toggle.
- `features/add-transaction-dialog` — `Field`/`FieldGroup` form: portfolio select, action select (buy/sell/dividend), asset class, symbol (CoinMarketCap crypto autocomplete), qty/price/fee/date. Dividend mode hides price/fee and relabels quantity as cash amount.
- `features/import-client` — CSV upload → parse preview (first 20 rows) → target portfolio → import; template download link. Rendered inside the Settings page's Import / Export card.
- `features/delete-button`, `toggle-alert-button` — icon buttons wired to bound server actions with confirm + toast.
- `currency-switcher` — global USD/THB display toggle (persists to user profile).
- `sidebar-nav` + app `Sidebar` — shadcn `Sidebar` (desktop rail + mobile sheet via `SidebarTrigger`).

## 6. States every screen must define

| State | Treatment |
|---|---|
| Empty | shadcn `Empty` + `EmptyDescription` inside the card ("No open positions yet — add your first transaction.") |
| Loading (charts) | Inline "Loading chart…" text block (server pages render data directly) |
| Error (quotes) | Stale cached price served silently; missing quote → em-dash cells, never a crash |
| Triggered alert | Amber `Triggered <date>` badge; pause/re-arm icons in row actions |

## 7. Wireframes (reference screens)

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

## 8. Manual smoke checklist (visual)

Before release: register→create portfolio→add buy/sell/dividend→dashboard math sanity→CSV round-trip→THB switch→dark mode→mobile layout.
