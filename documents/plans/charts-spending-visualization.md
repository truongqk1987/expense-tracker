# Implementation Plan — Charts / Spending Visualization (Tier 1 #2)

## Goal

Add two visualizations to the Dashboard: a **category-breakdown donut** and a
**spend-over-time trend** (bar or line). Both are pure-derivation views over the
expenses the user already sees — they **reuse/extend** the derivation layer in
`src/features/expenses/components/summarize.ts` (which now exports
`monthTotalsByCategory`) rather than duplicating grouping logic, they **respect
the active category/date filters** in `uiStore`, and they read data through the
existing `useExpenses()` hook. No schema change, no new query, no server data in
Zustand.

This plan is written against the current codebase. Where a step depends on an
unresolved product decision it is marked **(contingent — see Open Decisions §X)**.
The steps assume the recommendations in "Open Decisions" unless overridden.

> **Two grounding facts that shape this plan:**
> 1. **No charting library is currently a dependency** (`package.json` has React,
>    TanStack Query, Zustand, RHF, Zod, Supabase, react-router only). The build
>    already emits a ~600 kB chunk warning, so adding a chart lib is a real
>    bundle cost. → drives the Step-0 library decision.
> 2. **There is no `dataviz` skill file** under `.claude/skills/`, and
>    `src/index.css` currently defines **only a light theme** (an `@theme` block
>    with `--color-cat-*` tokens) — there is **no dark theme** in the app yet.
>    This plan therefore falls back to general dataviz color/accessibility
>    principles and makes charts **theme-agnostic by construction** (colors come
>    only from CSS variables), so they adapt automatically if/when a dark theme
>    is added.

---

## Decisions Locked (2026-07-16)

The user reviewed the Open Decisions and locked the following. **These override
the architect's recommendations where they differ** (notably charting tech):

1. **Charting tech = RECHARTS** (overrides the hand-rolled-SVG recommendation in
   Step 0). Install a **React 19-compatible Recharts 3.x** via `yarn add` (2.x has
   React 19 peer-dep friction). The bundle-size increase against the existing
   ~600 kB warning is accepted. **The derivation layer (Steps 1–2) is unchanged**;
   only the rendering primitives (Step 3) become thin Recharts wrappers instead of
   hand-rolled SVG.
2. **Trend granularity/window = ADAPTIVE (auto)** — window follows the active
   `uiStore` date filter; rolling 30 days when no filter; day/week/month bucket
   chosen from the span. **No `uiStore` change, no toggle UI** (Step 8 is dropped).
3. **Trend chart type = BAR** — one bar per bucket; zero-spend buckets show as gaps.
4. **Donut data scope = the filtered set** (not the this-month window).
5. **Empty state** — friendly placeholder matching `ExpenseList`'s empty state.
6. **Dark theme = out of scope**, but charts must be **theme-ready via CSS
   variables**.
7. **Placement** — full-width charts card **above `ExpenseList`** in `Dashboard.tsx`.

> **CRITICAL — dataviz color guidance still applies with Recharts:** donut slice
> colors and the bar series color MUST be driven by the existing `--color-cat-*`
> CSS variables mapped through `lib/categories.ts` (`getCategory`), **NOT**
> Recharts' default palette. Pass explicit `fill`/`color` values sourced from the
> tokens so a future dark theme recolors the charts for free.

---

## Step 0 — Charting approach decision (LOCKED: Recharts)

**Locked outcome: use Recharts 3.x** (React 19-compatible), installed via
`yarn add recharts`. This overrides the architect's original hand-rolled-SVG
recommendation below, which is retained only as rationale/context. Chart
primitives in `src/components/ui/` (the same home as `ProgressBar`) become thin
Recharts wrappers that receive the derived data plus explicit CSS-variable colors.

> **Original architect recommendation (superseded — kept for context):**
> hand-rolled inline SVG, no charting library, for both the donut and the trend.
> Add a thin, presentational SVG primitive per chart in `src/components/ui/`.

**Why, against this repo specifically:**

| Concern | Hand-rolled SVG | Library (see table below) |
|---|---|---|
| Bundle size (already a ~600 kB warning) | **0 KB added** | +30–150 KB gzipped |
| React 19 compatibility | **Guaranteed** (just JSX + SVG) | Peer-dep lag risk for several libs |
| Tailwind-token / CSS-variable theming | **Native** — `fill="var(--color-cat-food)"`, `stroke="var(--color-line)"` read tokens directly; auto theme-aware | Usually themed via JS props; reading CSS vars is awkward/partial |
| Tree-shaking | N/A (nothing to shake) | Varies; d3-based libs pull transitive deps |
| Effort | A donut = a handful of `<path>` arcs; bars = `<rect>`s; line = one `<polyline>`. Both are small, well-understood. | Lower initial code, higher long-term weight |
| Testability the project's way | Pure props-in SVG → assert `role="img"`/`aria-label`/legend text with Testing Library | Heavier DOM/canvas, more brittle |

**Trade-off table for the alternatives considered:**

| Option | Pros | Cons vs this repo | Verdict |
|---|---|---|---|
| **Hand-rolled SVG** | Zero deps, CSS-var theming for free, React-19-proof, tiny for these two simple charts, DOM-accessible | Must write arc math (donut) and axis/scale helpers ourselves | **Recommended** |
| Recharts | Declarative React components, popular | Adds ~100 KB+ (d3 modules); theming via props not CSS vars; React 19 peer-dep sometimes trails | Rejected (bundle + theming) |
| visx (@visx/*) | Low-level, tree-shakeable d3-as-React | Still adds d3 scale/shape deps; you hand-compose anyway — similar effort to pure SVG but with a dependency | Rejected (we'd write nearly as much, plus a dep) |
| Nivo | Beautiful defaults | Heavy (d3 + many packages), largest bundle hit | Rejected (bundle) |
| Chart.js + react-chartjs-2 | Compact-ish (~60 KB), mature | Canvas, not DOM → weaker a11y and no CSS-var theming; imperative wrapper | Rejected (a11y + theming) |

**Escape hatch:** if later we need rich interactivity (animated tooltips,
brushing, stacked multi-series), revisit **visx** — it's the lightest, most
tree-shakeable step up and keeps us in SVG. For a donut + a single-series trend,
hand-rolled SVG is the right call.

**This is Open Decision (i)** — get user sign-off before implementing.

---

## Step 1 — Extend the category derivation in `summarize.ts` (reuse, don't duplicate)

**Skill:** `write-colocated-test` (pure logic).
**File modified:** `src/features/expenses/components/summarize.ts`.

`summarize.ts` today has **two** category-grouping paths:
- `monthTotalsByCategory(expenses)` → `{ total, byCategory }` scoped to the
  **current calendar month** (used by `summarize` and `budgets/progress.ts`).
- an **inline** loop inside `summarize()` that sums `byCategory` over **all
  passed-in (already-filtered) rows** to find the top category — this map is not
  exported.

The donut needs the **filtered-set** grouping (see Open Decision (ii)), which is
exactly that inline loop. To avoid a third copy of "group expenses by category":

1. **Extract + export** a tiny pure helper, e.g.
   `sumByCategory(expenses: Expense[]): Map<string, number>` — the plain
   sum-by-category over whatever rows it's given (no date window). Have both
   `summarize()`'s internal top-category logic and (via `monthTotalsByCategory`,
   if convenient) reuse it so there is one grouping implementation.
2. **Add** a display-oriented derivation:
   `categoryBreakdown(expenses: Expense[]): CategorySlice[]` where
   `CategorySlice = { category: string; label: string; color: string; amount: number; pct: number }`.
   - Build from `sumByCategory(expenses)`.
   - `label`/`color` come from `getCategory(category)` (Null-Object fallback for
     unknown categories → `--color-cat-other`). **Never** hard-code category
     strings or colors.
   - `pct = total > 0 ? amount / total : 0`.
   - Sort **descending by amount** (largest slice first) for a stable, legible
     donut and legend order.
   - Return `[]` when there are no expenses (drives the empty state).

Keep `summarize()`'s existing output identical (no regression). `monthTotalsByCategory`
stays as-is — budgets and the "spent this month" card depend on it.

> **Why `summarize.ts` and not a new file for the donut derivation:** it is
> category grouping, which is exactly what this module already owns. This mirrors
> how `budgets/progress.ts` was built *on top of* `monthTotalsByCategory` instead
> of re-deriving the month window.

---

## Step 2 — New pure bucketing module for the trend: `trend.ts`

**Skill:** `write-colocated-test` (pure logic).
**File created:** `src/features/expenses/components/trend.ts` (colocated pure
module, mirroring where `summarize.ts` lives and how `budgets/progress.ts` is a
standalone pure derivation).

This is genuinely new logic (time bucketing) and a separate concern from category
grouping, so it gets its own module rather than bloating `summarize.ts`.

**Signature (recommended):**

```
type Granularity = 'day' | 'week' | 'month'

interface TrendBucket {
  key: string     // ISO start-of-bucket, YYYY-MM-DD (stable identity / x-order)
  label: string   // short human label for the axis (e.g. 'Jul 3', 'Wk of Jul 1', 'Jul')
  total: number   // summed expense amount that falls in [bucketStart, nextBucketStart)
}

function bucketSpendOverTime(
  expenses: Expense[],
  opts: { granularity: Granularity; from: string; to: string },
): TrendBucket[]
```

**Behavior contract:**
- Produces a **contiguous** series of buckets spanning `[from, to]` inclusive,
  **including empty buckets with `total: 0`** — so the chart has no gaps and the
  x-axis is evenly spaced. This is the key reason a bucketing function exists
  rather than a `groupBy`.
- Buckets ordered **oldest → newest**.
- Sums `expense.amount` for rows whose `spent_at` (a `YYYY-MM-DD` string) falls in
  the bucket. Use **string comparison on ISO dates** and the timezone-safe
  helpers in `lib/format.ts` (`todayISO`, `startOfMonthISO`) — **never** raw
  `new Date()` parsing of the ISO string for bucketing (mirrors the codebase's
  timezone-safe date discipline). A small internal date-add helper (add N days /
  start-of-week / start-of-month, all string-based) lives in this module or in
  `lib/format.ts` if it's generally useful.
- `week` buckets: pick a fixed week start (recommend Monday) and label "Wk of
  {date}".
- Pure, no React, no query — trivially unit-testable.

**How `from`/`to`/`granularity` are chosen** — see Open Decision (iii). Recommended
default: derive the window from the **active date filter** when set
(`filters.from`/`filters.to`), else a rolling **last 30 days** ending today; pick
granularity **adaptively** by span (≤ ~31 days → `day`, ≤ ~26 weeks → `week`, else
`month`). The container (Step 4) computes these and passes them in; `trend.ts`
stays a pure function of its args.

---

## Step 3 — Presentational Recharts chart primitives in `src/components/ui/`

**Skill:** `write-colocated-test` (pure component).
**Prereq:** `yarn add recharts` (React 19-compatible 3.x) — updates `yarn.lock`.
**Files created:**
- `src/components/ui/DonutChart.tsx` — Recharts `<PieChart>` + `<Pie innerRadius>`
- `src/components/ui/BarChart.tsx` — Recharts `<BarChart>` + `<Bar>` (LOCKED: bar)

These are **pure, props-in presentational primitives** (Container/Presentational
split), living alongside `ProgressBar` — which is already a dataviz primitive in
`components/ui/`. They know nothing about hooks, stores, Supabase, or the expense
domain; they wrap Recharts and receive numeric/label props plus **explicit
CSS-variable colors** (never Recharts' default palette). Wrap them in Recharts'
`<ResponsiveContainer>` so they fill the card. Set each `<Cell fill>` (donut) and
the `<Bar fill>` (trend) from the passed color tokens.

> **Recharts + CSS variables:** pass colors as `fill="var(--color-cat-food)"` etc.
> (sourced by the container from `getCategory`), so slices/bars read the theme
> tokens directly and a future dark theme recolors them automatically. The bar
> series uses `var(--color-brand)`. Do NOT let Recharts auto-assign colors.

**`DonutChart.tsx`**
- Props (shape, not code): `segments: { label: string; value: number; color: string }[]`,
  optional `size`, `thickness`, `ariaLabel`, `className`.
- Renders a ring of arc `<path>`s sized by each segment's share of the total;
  each arc's `stroke`/`fill` = the passed `color` (a `var(--color-cat-*)` token).
- Thin separator stroke between slices using `var(--color-surface)` for
  slice-to-slice contrast (accessibility — see Step 5).
- Optional center label slot (e.g. total) via `children` or a `centerLabel` prop.
- **Accessibility:** `role="img"` + a descriptive `aria-label`/`<title>`/`<desc>`
  summarizing the breakdown; the visible **legend is rendered by the container**
  (Step 4), not the primitive, so color is never the only signal.
- Degenerate cases: `segments` empty → render nothing (container shows empty
  state); a single non-zero segment → full ring.

**`BarChart.tsx`** *(recommended trend type)*
- Props: `bars: { label: string; value: number }[]`, optional `color`
  (default `var(--color-brand)`), `max`, `ariaLabel`, `className`.
- Renders `<rect>`s on a simple linear y-scale; x-axis tick labels from
  `bars[i].label` (thin the labels when dense); baseline/grid line in
  `var(--color-line)`, tick text in `var(--color-muted)`/`var(--color-faint)`.
- Zero-value buckets render as an empty slot (no bar) so gaps read as "no spend."
- `role="img"` + `aria-label`; optional `<title>`.
- *(If Open Decision (iv) = line/area: `LineChart.tsx` renders one `<polyline>`
  over the same scale, plus optional area fill at low opacity; same props shape
  keyed on `points`.)*

Both primitives use **only CSS-variable colors** (never hex literals), so they
inherit any future dark-theme token overrides automatically. Follow the existing
primitive conventions (`className` passthrough, `...rest` where sensible, Tailwind
utility classes bound to theme tokens) seen in `Button`/`Field`/`ProgressBar`.

---

## Step 4 — Feature container components (read filtered data, run derivations)

**Skill:** none new (component wiring). Uses `write-colocated-test` in Step 6.
**Files created (in `src/features/expenses/components/`):**
- `CategoryDonut.tsx`
- `SpendTrend.tsx`
- *(optional)* `ChartsPanel.tsx` — a light wrapper that lays out both charts in a
  card, matching the `rounded-card border border-line bg-surface` framing used by
  `ExpenseList`/`BudgetsPanel`.

**Data flow (identical to `SummaryCards`/`BudgetsPanel`):**
- Call `useExpenses()` — which already reads `uiStore.filters` and returns the
  **filtered** rows. **No new hook, no `api.ts` change, no new query key.**
- Compute derivations in `useMemo`:
  - `CategoryDonut`: `categoryBreakdown(data ?? [])` (Step 1) → pass `segments`
    to `<DonutChart>` and render a **legend** (color swatch + `getCategory` label +
    `formatCurrency(amount)` + `pct`). The legend is the not-color-alone channel.
  - `SpendTrend`: read `filters` from `uiStore` to compute `{ from, to, granularity }`
    (Open Decision (iii)), call `bucketSpendOverTime(data ?? [], opts)` (Step 2) →
    pass `bars`/`points` to `<BarChart>`/`<LineChart>`.
- Handle `isPending`/`isError` with the existing `Spinner` and a Retry button,
  mirroring `ExpenseList`/`BudgetsPanel`.
- **Empty state** (Open Decision (v)): when the filtered set is empty (or total is
  0), render a friendly placeholder consistent with `ExpenseList`'s `EmptyState`
  ("No data to chart" / "No expenses match your filters") instead of an empty SVG.

**Money** always via `formatCurrency`; **dates/labels** via `lib/format.ts`;
**categories/colors** always via `getCategory` / `CATEGORIES`. No hard-coded
strings.

> **Red-flag compliance:** containers import **hooks only** (`useExpenses`), never
> `api.ts` or the `supabase` client. Derived chart data is computed on the fly
> from TanStack Query cache — **never** stored in Zustand.

---

## Step 5 — Color & token strategy (dataviz principles)

> No `dataviz` skill file exists in this repo; the following applies the standard
> dataviz color/accessibility principles the roadmap references.

**Categorical palette (donut):** **Reuse the existing category tokens — do not
invent a parallel palette.** Each donut slice's color comes from
`getCategory(category).color`, i.e. the `--color-cat-food/-transport/-shopping/
-bills/-entertainment/-health/-other` tokens already defined in `index.css` and
mapped in `lib/categories.ts`. This is the single source of category color across
chips, the top-category dot, budget bars, and now the donut — guaranteeing visual
consistency. Unknown categories fall back to `--color-cat-other` via the
`getCategory` Null-Object.

**Sequential / trend color:** the trend is a **single series**, so it needs one
hue, not a ramp — use `var(--color-brand)` for bars/line (reuse `var(--color-danger)`
only if we later highlight over-budget periods). Axis/grid neutrals reuse
`var(--color-line)` (grid/baseline) and `var(--color-muted)`/`var(--color-faint)`
(tick text). **No new sequential ramp tokens are required.**

**Where the palette lives:** **nowhere new.** Category colors already live as
`@theme` tokens in `index.css` and are mapped in `lib/categories.ts`; charts
consume them through `getCategory`. Only add a token to `index.css` if a genuinely
chart-only neutral is needed that isn't already covered by
`--color-line`/`--color-muted`/`--color-faint` (prefer reusing those; adding a
token is a last resort, kept in the `@theme` block for consistency).

**Light + dark theme:** the app has **only a light theme today** (flag: no dark
theme exists in `index.css`). Because every chart color is a **CSS variable**
(never a hex literal), the charts are **theme-agnostic by construction** — if a
dark theme is later added by redefining the `--color-*` tokens under a `.dark`
selector or `prefers-color-scheme` media query, the donut and trend recolor
automatically with zero chart changes. Building an actual dark theme is **out of
scope** for this feature (separate roadmap work); the deliverable here is
theme-readiness. This is Open Decision (vi).

**Accessibility (not color alone + contrast + labels):**
- **Not color alone:** the donut always ships with a **legend** (swatch + label +
  amount + %); the trend always has **axis labels**. Screen-reader path: `role="img"`
  + descriptive `aria-label` on each SVG, plus a visually-hidden summary
  (`<title>`/`<desc>` and/or a visually-hidden `<ul>`/`<table>` of the same
  numbers) so the data is available without perceiving color.
- **Contrast / adjacency:** thin `var(--color-surface)` separator strokes between
  donut slices so same-family adjacent hues stay distinguishable; tick/label text
  uses `--color-ink`/`--color-muted` for adequate contrast on `--color-surface`.
- **Labels:** every value shown in the legend/axis uses `formatCurrency` /
  `lib/format.ts`, never raw numbers or `Date`.

---

## Step 6 — Colocated tests (the project's way)

**Skill:** `write-colocated-test` (Vitest + jsdom; `renderWithProviders`; mock the
**`api` module** for containers; `resetStores` when touching `uiStore`; use the
`makeExpense` object-mother).

**New / updated test files:**

1. **`src/features/expenses/components/summarize.test.ts`** *(update if present,
   else add — pure)* — cover the extracted `sumByCategory` and new
   `categoryBreakdown`: correct sums, `pct` totals to ~1, descending-by-amount
   order, unknown-category fallback color/label, empty input → `[]`; assert
   `summarize()`'s existing output is unchanged (no regression from the extract).
2. **`src/features/expenses/components/trend.test.ts`** *(pure)* — bucketing:
   daily/weekly/monthly grouping; **empty buckets are emitted as `0`** across the
   window; buckets are contiguous and oldest→newest; a `spent_at` on a bucket
   boundary lands in the right bucket; sums match; empty input yields a
   zero-filled series over the window. Use `makeExpense({ spent_at, amount })`.
3. **`src/components/ui/DonutChart.test.tsx`** *(pure component)* — renders one arc
   per segment; exposes `role="img"` + `aria-label`; renders nothing meaningful
   for empty segments; single-segment → full ring (assert path count/attrs).
4. **`src/components/ui/BarChart.test.tsx`** *(pure component)* — renders one bar
   per non-zero value, empty slot for zeros, `role="img"` + `aria-label`, axis
   labels present. *(Or `LineChart.test.tsx` if Decision (iv) = line.)*
5. **`src/features/expenses/components/CategoryDonut.test.tsx`** *(mock `../api`,
   `resetStores`)* — with mocked `listExpenses`, renders the donut + a legend row
   per category with `formatCurrency` amounts; **respects filters** (set
   `useUIStore.getState().setFilters({ category: 'food' })` and assert the donut
   reflects the refetched filtered set); empty/filtered-to-nothing → empty state.
6. **`src/features/expenses/components/SpendTrend.test.tsx`** *(mock `../api`,
   `resetStores`)* — renders bars for the window; changing the date filter changes
   the window/buckets; empty state when no data.

Keep `yarn test` and `yarn lint` green (CI and Render both run the suite).

---

## Step 7 — Mount on the Dashboard

**Skill:** none (wiring). Component imports containers, which import hooks.
**File modified:** `src/pages/Dashboard.tsx`.

- Mount `<CategoryDonut />` and `<SpendTrend />` (or a single `<ChartsPanel />`
  wrapping both). **Placement — Open Decision (vii):** recommended a **full-width
  charts card in the main content column, above `<ExpenseList />`** (charts need
  horizontal room; the left `<aside>` is a narrow 20rem rail holding
  Summary/Filters/Budgets). Alternative: a compact donut could sit in the aside
  under `SummaryCards`, with the trend full-width in the main column.
- **No routing change** — charts live on the existing single Dashboard screen,
  consistent with the app.
- No new modals/stores to mount (unless Decision (iii) adds a granularity toggle —
  see below).

---

## Step 8 — (Contingent) trend-granularity UI control

**(Contingent — Open Decision (iii).)** If the user wants a **manual**
day/week/month toggle (rather than fully adaptive), that toggle is **ephemeral
client UI state → `uiStore`**, never server data. Add a small slice:
`trendGranularity: Granularity` + `setTrendGranularity(g)` (default `'day'` or
`'auto'`). `SpendTrend` reads it and feeds `bucketSpendOverTime`. If we go fully
adaptive (recommended default), **skip this step** — no store change at all.

---

## Trade-off analysis (key decisions)

| Decision | Option A | Option B | Recommended | Reason |
|---|---|---|---|---|
| Charting tech | Hand-rolled SVG primitives | Charting library (Recharts/visx/Nivo/Chart.js) | **A** | Zero bundle cost (600 kB warning), React-19-proof, CSS-var theming for free, two simple charts |
| Donut data scope | Filtered set (matches `useExpenses`) | Current-month window (`monthTotalsByCategory`) | **A** | Charts "MUST respect active filters"; mirrors the "Total (filtered)" card; month view is already the budgets/summary story |
| Donut derivation home | Extend `summarize.ts` (`categoryBreakdown`) | New module | **A** | It's category grouping — `summarize.ts` already owns it; reuse the extracted `sumByCategory`, no duplication |
| Trend derivation home | New pure `trend.ts` | Extend `summarize.ts` | **A** | Time bucketing is a distinct concern; keep `summarize.ts` focused; mirrors standalone `budgets/progress.ts` |
| Chart component home | Primitives in `components/ui/`, containers in feature | All in feature folder | **A** | `ProgressBar` (a viz primitive) already lives in `ui/`; keeps Container/Presentational split and pure, testable SVG |
| Trend type | Bar | Line/area | **A (bar)** | Discrete per-period spend; empty buckets read clearly; simpler for sparse data (revisit line if the series is dense) |
| Granularity | Adaptive from window span | Manual toggle in `uiStore` | **A (adaptive), toggle optional** | Zero extra UI/state for the common case; toggle is a clean additive follow-up |
| Palette source | Reuse `--color-cat-*` via `getCategory` | New chart palette | **A** | Single source of category color across the app; no drift; theme-token-driven |

---

## Open Decisions for the user

Each states a recommendation, a one-line rationale, and where the plan is
contingent.

**(i) Charting library vs hand-rolled SVG.**
→ **Recommend hand-rolled inline SVG** (Step 0/Step 3). Rationale: zero bundle
cost against an existing ~600 kB warning, guaranteed React 19 compat, native
CSS-variable theming, and both charts are simple. *Contingent:* if a library is
chosen instead, Step 3 becomes "wrap the library," a new dependency is added
(justify the bundle hit), and the theming/a11y notes in Step 5 must be re-checked
against the library's capabilities.

**(ii) Donut data scope — filtered set vs this-month.**
→ **Recommend the filtered set** (the rows `useExpenses` returns), so the donut
honors the active category/date filters and matches the "Total (filtered)" card.
Rationale: the task requires charts to respect filters; the month view is already
told by SummaryCards/Budgets. *Contingent:* if "this month" is preferred instead,
`CategoryDonut` uses `monthTotalsByCategory(data)` and Step 1's `categoryBreakdown`
takes a pre-built map — but then the donut ignores date filters (call this out in
the UI, e.g. a "this month" label).

**(iii) Trend granularity + time window.**
→ **Recommend adaptive:** window = active date filter when set, else rolling last
30 days ending today; granularity by span (≤ ~31 days → daily, ≤ ~26 weeks →
weekly, else monthly). Rationale: sensible defaults with zero extra UI/state.
*Contingent:* a manual day/week/month toggle adds a `trendGranularity` slice to
`uiStore` (Step 8); the default rolling window length is itself tunable.

**(iv) Trend chart type — bar vs line/area.**
→ **Recommend bar.** Rationale: discrete per-period spend, empty periods read
clearly, robust for sparse data. *Contingent:* line/area swaps `BarChart` for
`LineChart` (same container, `points` instead of `bars`); consider line only if
the default window is dense (e.g. daily over a long range).

**(v) Empty-state handling (no expenses / filtered to nothing).**
→ **Recommend** a friendly placeholder consistent with `ExpenseList`'s
`EmptyState` ("No data to chart" when unfiltered-empty; "No expenses match your
filters" + clear-filters when filtered-empty); donut renders nothing for zero
total, single category renders a full ring. Rationale: consistent, no empty/blank
SVG. *Contingent:* copy/CTA wording.

**(vi) Dark theme (flag).**
→ **Recommend** shipping charts as **theme-agnostic by construction** (colors only
via CSS variables) and treating an actual dark theme as separate/out-of-scope,
since `index.css` has **no dark theme today**. Rationale: charts become dark-ready
for free without expanding this feature's scope. *Contingent:* if a dark theme is
in scope now, add token overrides in `index.css` (a `.dark`/media-query block) —
but that is a global change beyond charts.

**(vii) Where the charts mount on the Dashboard.**
→ **Recommend** a full-width charts card in the **main content column above
`<ExpenseList />`** (the left `aside` is a narrow 20rem rail). Rationale: charts
need horizontal room. *Contingent:* alternative is a compact donut in the aside +
full-width trend; affects only `Dashboard.tsx` layout.

---

## Summary of what to create vs modify

**Create:**
- `src/components/ui/DonutChart.tsx` (+ `DonutChart.test.tsx`)
- `src/components/ui/BarChart.tsx` *(or `LineChart.tsx`)* (+ test)
- `src/features/expenses/components/trend.ts` (+ `trend.test.ts`)
- `src/features/expenses/components/CategoryDonut.tsx` (+ `CategoryDonut.test.tsx`)
- `src/features/expenses/components/SpendTrend.tsx` (+ `SpendTrend.test.tsx`)
- *(optional)* `src/features/expenses/components/ChartsPanel.tsx`

**Modify:**
- `src/features/expenses/components/summarize.ts` — extract/export `sumByCategory`;
  add `categoryBreakdown` (reuse the month helper; no duplication)
- `src/features/expenses/components/summarize.test.ts` — cover the new/extracted
  helpers; assert no `summarize()` regression
- `src/pages/Dashboard.tsx` — mount the charts
- *(only if Decision (iii) = manual toggle)* `src/stores/uiStore.ts` —
  `trendGranularity` slice
- *(only if a genuinely chart-only neutral token is unavoidable)* `src/index.css`
  — add it to the `@theme` block (prefer reusing `--color-line`/`--color-muted`/
  `--color-faint`)

**Do NOT touch:**
- `supabase/schema.sql` — no DB change; charts derive from existing `expenses`
- `src/lib/database.types.ts` — no schema change
- `src/features/expenses/api.ts` and `hooks.ts` — no new query; reuse `useExpenses`
- `src/features/expenses/types.ts` — no new domain type
- `src/lib/categories.ts` — reuse `CATEGORIES`/`getCategory` as-is (palette source)
- `src/lib/supabase.ts`, `src/providers/*`, `src/routes/*`, `authStore`,
  `toastStore`, `render.yaml`, `.github/workflows/ci.yml` — no infra/auth/routing
  change

---

## Applicable skills per step

| Step | Skill | Note |
|---|---|---|
| 0 (library decision) | none | Architecture decision for the user |
| 1 (`summarize.ts` extend) | `write-colocated-test` | Pure logic |
| 2 (`trend.ts`) | `write-colocated-test` | Pure logic |
| 3 (SVG primitives) | `write-colocated-test` | Pure component |
| 4 (containers) | `write-colocated-test` (in Step 6) | Component wiring |
| 6 (tests) | `write-colocated-test` | Mock `api` for containers; `resetStores`; `makeExpense` |
| 7 (mount) | none | Wiring |

**Not applicable:** `add-supabase-table`, `add-db-column`, `add-feature-domain`,
`add-crud-mutation` — there is **no new server data, no schema change, and no new
feature domain** (charts live inside the existing `expenses` feature). *(The
`dataviz` skill referenced by the roadmap does not exist in `.claude/skills/`;
this plan applies general dataviz color/accessibility principles in Step 5.)*

---

## Red-flag self-check (all clear)

- Containers call **hooks only** (`useExpenses`); never import `api.ts` or the
  `supabase` client.
- **No server data in Zustand** — chart data is derived from the TanStack Query
  cache; only an optional `trendGranularity` (pure UI state) would go in `uiStore`.
- Reads never filter by `user_id` (RLS scopes them); no inserts here, so no
  `user_id` stamping needed.
- **No new table** → no RLS work; `schema.sql` untouched.
- **No column change** → all four sync points untouched.
- No mutations → no invalidation needed; existing `['expenses']` invalidation on
  expense CRUD already refreshes the charts (they read the same cache).
- Category colors come from `lib/categories.ts`/`--color-cat-*`; money via
  `formatCurrency`; dates via `lib/format.ts` — no hard-coded strings or raw
  `Date` formatting.
- **No new dependency** (hand-rolled SVG); grouping/month-window logic is reused,
  not duplicated; no circular imports (`ui/` primitives are leaf, feature
  containers depend on them + hooks + `summarize`/`trend`).
