# Feature Roadmap — Expense Tracker

> Proposed new features, grounded in the current architecture (see `architect.md`).
>
> **Current state:** a working single-user expense tracker — Supabase auth + RLS,
> expense CRUD (amount, category, note, date), category/date-range filters, and a
> summary panel (this-month total, filtered total, count, top category).

Tiers are ordered by value-to-effort. Each item notes what already exists that it
builds on, so we can implement without re-deriving the system.

## Tier 1 — high value, low effort

Natural extensions of what's already built.

### 1. Budgets & budget progress
Let users set a monthly budget per category (or overall). `SummaryCards` already
computes month totals — add a "spent vs. budget" progress bar.
- **Needs:** a `budgets` table (RLS-scoped like `expenses`), a progress-bar component.

### 2. Charts / spending visualization — Shipped
Category breakdown (donut) and spend-over-time trend (bar chart), both pure
derivations over the existing `useExpenses()` cache — no new query, no schema
change. See `documents/architect.md` §3/§7.
- **Built on:** `summarize.ts`'s category grouping (extracted into shared
  `sumByCategory()`, plus new `categoryBreakdown()`) and a new `trend.ts`
  (mirrors `budgets/progress.ts`).
- Colors are the existing `--color-cat-*` tokens via `getCategory` — never
  Recharts' default palette.

### 3. CSV export / import
Export the currently-filtered expenses to CSV (one Dashboard button, reuses the
active filter state). Import is a follow-up — parse CSV → bulk `insert`.
- **Value:** high real-world utility, small surface area.

### 4. Recurring expenses
Mark an expense as recurring (rent, subscriptions) and auto-generate entries.
- **Start simple:** a `recurring` flag + interval, plus a "duplicate to this month"
  action, before doing full automation.

## Tier 2 — medium effort, strong product value

### 5. Custom categories
Categories are currently a hardcoded list in `categories.ts`. Let users add / edit /
color their own.
- **Needs:** move categories into a table + a management UI.
- **Touches:** forms, filters, and the summary.

### 6. Search & richer filters
Add free-text search over notes and an amount-range filter alongside the existing
category/date filters in `uiStore`.
- **Value:** cheap; makes the list usable at scale.

### 7. Multi-currency support
`formatCurrency` is centralized, so a per-expense or per-user currency is contained.
Optional FX conversion is a larger add-on.

### 8. Dashboard insights
"You spent 30% more on Food than last month," biggest expense, daily average —
comparative analytics built on the existing month rollups.

## Tier 3 — larger, differentiating

### 9. Shared / household accounts
Split expenses across members. Biggest architectural change — RLS policies move from
per-user to per-group.

### 10. Receipt attachments
Supabase Storage + upload UI; optional OCR later.

### 11. PWA / offline mode
Installable, offline entry with sync.

### 12. Notifications & reports
Weekly email summary or budget-threshold alerts (Supabase Edge Functions + cron).

## Suggested first slice

Start with **Budgets + Charts + CSV export** — the most visible value, built directly
on the existing `summarize` / filter layer, with minimal schema change (one `budgets`
table).
