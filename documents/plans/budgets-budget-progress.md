# Implementation Plan — Budgets & Budget Progress (Tier 1 #1)

## Goal

Let a user set a **monthly budget** (per-category and/or one overall budget) and render a **"spent vs. budget" progress bar** that reuses the existing this-month roll-up logic in `summarize.ts` / `SummaryCards.tsx`. Server state flows through the standard `Component → hooks.ts → api.ts → Supabase (RLS)` chain; the new `budgets` domain mirrors `features/expenses/` exactly.

This plan is written against the current codebase. Where a step depends on an unresolved product decision, it is marked **(contingent — see Open Decisions §X)**. The recommendations in "Open Decisions" are what the steps below assume unless the user overrides them.

---

## Step 1 — `budgets` table + RLS in `supabase/schema.sql`

**Skill:** `add-supabase-table`
**File touched:** `supabase/schema.sql` (append a new numbered section; do **not** create a new SQL file — the whole schema is one re-runnable script).

**Columns (assuming Open Decisions §a=both, §b=recurring monthly, §d=nullable category):**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `user_id` | `uuid` not null | FK → `auth.users(id) on delete cascade` |
| `category` | `text` **nullable** | one of `categories.ts` values, or `NULL` = the overall budget (Open Decisions §d) |
| `amount` | `numeric(12,2)` not null | `check (amount >= 0)` — mirrors `expenses.amount` |
| `created_at` | `timestamptz` not null | `default now()` |

**(Contingent — Open Decisions §b)** If the user chooses *per-month rows keyed by month* instead of a single recurring amount, add:
- `month` `date` not null `default date_trunc('month', current_date)::date` (always first-of-month), and fold `month` into the unique indexes and query below.

**Index (list ordering, per skill):**
- `budgets_user_id_created_at_idx` on `(user_id, created_at desc)`.

**Unique constraints — prevent duplicate budgets (Open Decisions §e).** Because Postgres treats `NULL`s as *distinct* in a plain `unique(user_id, category)`, a single unique constraint would still allow many "overall" rows. Use **two partial unique indexes**:
- Per-category: `create unique index if not exists budgets_user_category_uidx on public.budgets (user_id, category) where category is not null;`
- Overall (one per user): `create unique index if not exists budgets_user_overall_uidx on public.budgets (user_id) where category is null;`
- **(Contingent §b, per-month)**: add `month` to both — `(user_id, category, month)` and `(user_id, month) where category is null`.

**RLS — all four policies, each keyed on `auth.uid() = user_id`** (mirror the `expenses` block, `drop policy if exists` before each `create policy` so the script re-runs cleanly):
- `enable row level security`
- select → `using (auth.uid() = user_id)`
- insert → `with check (auth.uid() = user_id)`
- update → `using (...) with check (...)`
- delete → `using (...)`

**Action item for the user:** the schema is not auto-applied — remind them to run the updated `supabase/schema.sql` in the Supabase SQL editor. For the already-deployed DB, also hand them the additive statements (`create table if not exists ...`, `create unique index ...`, `alter table ... enable row level security`, the policies) so it applies without a full re-run.

---

## Step 2 — Mirror the table in `src/lib/database.types.ts`

**Skill:** `add-db-column` (its "type step") — this is the DB→client sync point.
**File touched:** `src/lib/database.types.ts` — add a `budgets` entry alongside `expenses` under `public.Tables`, with all three shapes:

- `Row`: `id: string`, `user_id: string`, `category: string | null`, `amount: number`, `created_at: string` *(+ `month: string` if §b=per-month)*.
- `Insert`: `id?: string`, `user_id: string`, `category?: string | null`, `amount: number`, `created_at?: string` *(+ `month?: string`)*.
- `Update`: every field optional (`?`).
- `Relationships: []`.

Nullability must match the SQL exactly (`category` nullable → `string | null`).

---

## Step 3 — New feature domain `src/features/budgets/`

**Skill:** `add-feature-domain`
**New files:**

**`src/features/budgets/types.ts`**
- `export type Budget = Database['public']['Tables']['budgets']['Row']`
- `export interface BudgetInput { category: string | null; amount: number }` — user-supplied fields only; **never** `user_id` (the insert stamps it). `category: null` represents the overall budget.

**`src/features/budgets/api.ts`** — thin Supabase facade, no React, no `user_id` filter on reads (RLS scopes it), normalize errors to `throw new Error(error.message)`:
- `listBudgets(): Promise<Budget[]>` — `.from('budgets').select('*').order('created_at', { ascending: false })`.
- `createBudget(input: BudgetInput): Promise<Budget>` — read `supabase.auth.getUser()`, throw `'You must be signed in.'` if absent, `.insert({ ...input, user_id: user.id }).select().single()`.
- `updateBudget(id: string, input: BudgetInput): Promise<Budget>` — `.update(input).eq('id', id).select().single()`.
- `deleteBudget(id: string): Promise<void>` — `.delete().eq('id', id)`.
- Note the unique indexes from Step 1 mean an insert that duplicates a budget will surface a Postgres error; it propagates as a toast via the standard `onError` path. (Optional hardening in Open Decisions §e.)

**`src/features/budgets/hooks.ts`** — query-key factory + `useInvalidate` (Template Method) + mutations-as-commands, mirroring `expenses/hooks.ts`:
- `const KEY = ['budgets'] as const`; `export function budgetsKey() { return [...KEY] as const }` (no filters — the budget list is small and unfiltered).
- `useBudgets()` → `useQuery({ queryKey: budgetsKey(), queryFn: () => listBudgets() })`.
- `useInvalidate()` → `qc.invalidateQueries({ queryKey: KEY })`.
- `useCreateBudget` / `useUpdateBudget({ id, input })` / `useDeleteBudget(id)` → each does **mutate → `invalidate()` → success toast**, with an error toast. Suggested toasts: `'Budget saved'` (create), `'Budget updated'`, `'Budget removed'`. Multi-arg mutation takes a single object arg, exactly like `useUpdateExpense`.

---

## Step 4 — Zod schema, budget management UI, uiStore additions

**Skills:** `add-feature-domain` (components/schema), plus this reuses `add-crud-mutation`'s container wiring.

**`src/features/budgets/components/BudgetForm.schema.ts`** (schema = single source of truth; type is `z.infer`):
- `amount`: `z.number({ message: 'Enter an amount' }).positive('Must be greater than 0')`.
- `category`: reuse the shared list but allow "overall". Recommended shape: `z.enum(['__overall__', ...CATEGORY_VALUES])` where the select's "Overall (all spending)" option carries the value `'__overall__'`. The container maps `'__overall__' → null` for `BudgetInput.category`. (This keeps the enum tied to `CATEGORY_VALUES` from `lib/categories.ts` — no hard-coded category strings. See Open Decisions §d.)
- `export type BudgetFormValues = z.infer<typeof budgetFormSchema>`.

**`src/features/budgets/components/BudgetForm.tsx`** — presentational (props/callbacks only, no stores/hooks), mirrors `ExpenseForm.tsx`:
- Props: `{ initial?: Budget | null; submitting: boolean; onSubmit: (input: BudgetInput) => void; onCancel: () => void }`.
- Fields: amount (`$` prefix input, `valueAsNumber`) and a category `<Select>` whose first option is "Overall (all spending)" (`value="__overall__"`) followed by `CATEGORIES.map(...)`.
- `defaultValues` derived from `initial` (map `initial.category ?? '__overall__'`).
- Submit maps `'__overall__' → null`.

**`src/features/budgets/components/BudgetFormModal.tsx`** — container (Container/Presentational split), mirrors `ExpenseFormModal.tsx`:
- Reads `uiStore.budgetFormOpen` / `budgetTarget` / `closeBudgetForm`.
- Calls `useCreateBudget` / `useUpdateBudget`; `key={target?.id ?? 'new'}` to reset form per target; closes on success.

**`src/features/budgets/components/BudgetDeleteConfirm.tsx`** — mirrors `DeleteConfirm.tsx`, reads `uiStore.budgetDeleteTarget` / `cancelBudgetDelete`, calls `useDeleteBudget`. Uses `getCategory(target.category).label` (or "Overall" when `category` is null) and `formatCurrency`.

**`src/features/budgets/components/BudgetsPanel.tsx`** — container/list, mirrors `ExpenseList` + `Filters` framing:
- Calls `useBudgets()` and `useExpenses()`, computes progress via Step 5's helper.
- Renders a header with an **"Add budget"** button (`openCreateBudget`), an empty state, and a row per budget: category label (or "Overall"), a `ProgressBar`, `spent / budget` via `formatCurrency`, plus edit (`openEditBudget`) and delete (`requestBudgetDelete`) actions.

**`src/stores/uiStore.ts`** additions — this is the right home for budget modal/delete targets (ephemeral **client** UI state, exactly like the expense modal; **never** server data). Add to `UIState`:
- `budgetFormOpen: boolean`, `budgetTarget: Budget | null`, `openCreateBudget()`, `openEditBudget(budget)`, `closeBudgetForm()`.
- `budgetDeleteTarget: Budget | null`, `requestBudgetDelete(budget)`, `cancelBudgetDelete()`.
- Import `Budget` from `../features/budgets/types`. (No budget *filters* slice — the list is unfiltered.)

---

## Step 5 — Derive "spent vs budget" + a reusable `ProgressBar`

**Skill:** `add-feature-domain` (pure helper colocated in the domain) + `write-colocated-test`.

**Reuse, don't duplicate, the month-window logic.** `summarize.ts` already computes the current-month window (`startOfMonthISO()`..`todayISO()`) and a `byCategory` map. To avoid a second copy of that logic:

- **Modify `src/features/expenses/components/summarize.ts`**: extract and `export` a small pure helper, e.g. `monthTotalsByCategory(expenses: Expense[]): { total: number; byCategory: Map<string, number> }`, and have `summarize()` call it internally (behavior unchanged; existing tests stay green). This becomes the single source of the "this month" roll-up.

- **New file `src/features/budgets/progress.ts`** — pure function, no React:
  - `computeBudgetProgress(expenses: Expense[], budgets: Budget[]): BudgetProgress[]` (and/or an `overall` entry).
  - Uses `monthTotalsByCategory(expenses)` for spent figures.
  - For each budget row: `spent` = overall month total when `category === null`, else `byCategory.get(category) ?? 0`; then `{ budget: amount, spent, remaining: amount - spent, pct: amount > 0 ? spent / amount : 0, over: spent > amount, label, color }` (label/color via `getCategory`, "Overall" + a neutral token for the null case).
  - Keep it a pure array/`Map` transform — trivially unit-testable, no query.

**New UI primitive `src/components/ui/ProgressBar.tsx`** — presentational, mirrors the `Button`/`Field` primitive style (Strategy variant map, theme tokens, `{...rest}` passthrough):
- Props: `{ value: number; max: number; variant?: 'normal' | 'over'; label?: string }` (or a precomputed `pct`).
- Renders a track + fill; **clamps the fill at 100%** even when over budget; `variant="over"` switches the fill to `--color-danger` (Open Decisions §c). Include `role="progressbar"` + `aria-valuenow/min/max` for the test to assert against.

---

## Step 6 — Wire progress bars into `SummaryCards` and mount management UI in `Dashboard`

**Skill:** `add-crud-mutation` wiring conventions (component calls hooks, never `api.ts`/`supabase`).

**`src/features/expenses/components/SummaryCards.tsx`** — add the **overall** budget bar:
- Also call `useBudgets()`; find the overall budget (`category === null`); if present, render a `ProgressBar` under the "Spent this month" card showing `summary.monthTotal` vs the overall amount, using `computeBudgetProgress` (or a direct compare for the single overall row). If no overall budget is set, render nothing extra (graceful, matches the app's minimal empty states).
- Per-category bars stay in `BudgetsPanel` (Step 4) to keep the summary column uncluttered.

**`src/pages/Dashboard.tsx`** — mount the budgets feature:
- Add `<BudgetsPanel />` in the left `<aside>` (below `<Filters />`), and mount `<BudgetFormModal />` + `<BudgetDeleteConfirm />` next to the existing `<ExpenseFormModal />` / `<DeleteConfirm />` at the bottom.
- No routing changes — budgets live on the existing Dashboard, consistent with the single-screen app.

---

## Step 7 — Colocated tests

**Skill:** `write-colocated-test` (Vitest + jsdom; `renderWithProviders`; mock the **`api` module** for components, mock **`supabase`** only for the api-facade test; `resetStores` when touching stores).

**New / updated test files:**

1. **`src/features/budgets/components/BudgetForm.schema.test.ts`** *(pure)* — valid input passes; non-positive `amount` fails; `'__overall__'` and each `CATEGORY_VALUES` entry accepted; unknown category rejected.
2. **`src/features/budgets/progress.test.ts`** *(pure)* — spent-vs-budget derivation: category budget matches only that category's month spend; overall budget sums all this-month spend; `over` flag flips when spent > budget; expenses outside the current month are excluded (proves it uses the month window); `pct` guards `amount === 0`.
3. **`src/features/expenses/components/summarize.test.ts`** *(update if present, else add)* — assert the extracted `monthTotalsByCategory` and that `summarize()` output is unchanged (no regression from the refactor).
4. **`src/features/budgets/api.test.ts`** *(mock `supabase`)* — `createBudget` stamps `user_id` and throws `'You must be signed in.'` when no user; `listBudgets` orders by `created_at desc`; error path `{ error: { message } }` → `rejects.toThrow(message)`.
5. **`src/features/budgets/components/BudgetsPanel.test.tsx`** *(mock `../api`, `resetStores`)* — renders a bar per budget with `spent / budget` text; "Add budget" opens the form (drive via store/`user-event`); delete flow calls the mutation and shows the toast; empty state when no budgets.
6. **`src/components/ui/ProgressBar.test.tsx`** *(pure component)* — renders correct `aria-valuenow`; clamps fill at 100% when `value > max`; applies the `over` variant styling.
7. **`src/test/factories.ts`** *(update)* — add a `makeBudget(overrides)` object-mother (defaults: `category: 'food'`, `amount: 500`, valid `user_id`/`id`/`created_at`), used by the budget tests instead of hand-built objects.

Keep `yarn test` and `yarn lint` green (CI and Render both run the suite).

---

## Trade-off analysis (key decisions)

| Decision | Option A | Option B | Recommended | Reason |
|---|---|---|---|---|
| Table shape | One `budgets` table, nullable `category` (NULL = overall) | Separate `overall_budgets` + `category_budgets` tables | **A** | One RLS block, one domain, one query; "overall" is just a row where `category IS NULL`. |
| Period model | Single recurring monthly amount (one row per category) | Per-month row keyed by `month` | **A (v1)** | Simplest; matches "spent vs budget *this month*". Adding `month` later is a clean `add-db-column` change. |
| Where per-category bars render | Inside `SummaryCards` | In a dedicated `BudgetsPanel` | **B** (overall bar in SummaryCards, category bars in panel) | Keeps the summary column readable; the panel owns budget CRUD anyway. |
| Month roll-up source | Duplicate the window logic in `progress.ts` | Extract/export a helper from `summarize.ts` and reuse | **B** | Single source of the "this month" window; no drift between summary and progress. |
| Overall-in-form representation | Sentinel select value `'__overall__'` → `null` | Nullable field with a checkbox toggle | **A** | One `<Select>` reusing `CATEGORIES`; maps cleanly to the nullable column; no extra control. |

---

## Open decisions for the user

Each item states the recommendation, its one-line rationale, and where the plan is contingent.

**(a) Per-category vs single overall vs both.**
→ **Recommend both**, via one `budgets` table with a nullable `category` (NULL = overall). Rationale: covers the most useful case with one table/domain and no schema fork. *Contingent:* if "overall only", drop the category column, the per-category partial index, and the category select; if "per-category only", make `category` `not null` and remove the overall row/bar.

**(b) Budget period model — single recurring monthly amount vs per-month row keyed by month.**
→ **Recommend a single recurring monthly amount** (one row per category/overall). Rationale: simplest model that satisfies "monthly budget vs this-month spend"; historical per-month budgets can be added later without rework. *Contingent:* Steps 1, 2, 3(input type), and 5 all change if per-month — add a `month` column, thread it into the unique indexes, the row/insert/update types, `BudgetInput`, and the progress lookup.

**(c) How over-budget is displayed.**
→ **Recommend clamp the bar fill at 100% and switch it to the danger color, with a "$X over" note**. Rationale: unambiguous, uses the existing `--color-danger` token, no layout overflow. *Contingent:* the `ProgressBar` `variant`/clamp logic in Step 5 and the `over` flag from `computeBudgetProgress`.

**(d) Reuse `CATEGORIES` enum, and how "overall" is represented.**
→ **Recommend reuse `CATEGORY_VALUES`** for validation and options, and represent overall as a **nullable `category` column** (`NULL` = overall), surfaced in the form as a sentinel `'__overall__'` option that maps to `null`. Rationale: no hard-coded category strings; overall is a data state, not a new enum member. *Contingent:* the Zod enum shape, the form select, and the `'__overall__' ↔ null` mapping in the container.

**(e) Unique-constraint shape (implied by §b).**
→ **Recommend two partial unique indexes**: `(user_id, category) where category is not null` and `(user_id) where category is null`. Rationale: a plain `unique(user_id, category)` lets duplicate "overall" rows through because Postgres treats NULLs as distinct. *Contingent:* if §b=per-month, add `month` to both indexes. Optionally, `createBudget` can be hardened to an upsert on the conflict target, or map the Postgres unique-violation to a friendly toast ("You already have a budget for this category").

---

## Summary of what to create vs modify

**Create:**
- `src/features/budgets/types.ts`, `api.ts`, `hooks.ts`
- `src/features/budgets/progress.ts`
- `src/features/budgets/components/`: `BudgetForm.schema.ts`, `BudgetForm.tsx`, `BudgetFormModal.tsx`, `BudgetDeleteConfirm.tsx`, `BudgetsPanel.tsx`
- `src/components/ui/ProgressBar.tsx`
- Tests: `BudgetForm.schema.test.ts`, `progress.test.ts`, `budgets/api.test.ts`, `BudgetsPanel.test.tsx`, `ProgressBar.test.tsx`

**Modify:**
- `supabase/schema.sql` (append `budgets` + indexes + 4 RLS policies)
- `src/lib/database.types.ts` (add `budgets` Row/Insert/Update)
- `src/features/expenses/components/summarize.ts` (extract/export `monthTotalsByCategory`)
- `src/features/expenses/components/SummaryCards.tsx` (overall progress bar)
- `src/stores/uiStore.ts` (budget modal + delete targets)
- `src/pages/Dashboard.tsx` (mount `BudgetsPanel`, `BudgetFormModal`, `BudgetDeleteConfirm`)
- `src/test/factories.ts` (add `makeBudget`)

**Do NOT touch:** `src/lib/supabase.ts`, `src/providers/*`, `src/routes/*`, `render.yaml`, `.github/workflows/ci.yml`, `authStore`/`toastStore` — no infra, auth, or routing change is needed.

---

## Red-flag self-check (all clear)

- Components call **hooks only**; `api.ts` is never imported by a component.
- Server data (budgets) lives in **TanStack Query**, not Zustand; only modal/delete targets go in `uiStore`.
- Reads never filter by `user_id` (RLS scopes them); `createBudget` **stamps** `user_id` on insert.
- New table ships with **all four `auth.uid() = user_id` RLS policies**.
- Column changes hit **all four sync points** (schema.sql, database.types.ts, `BudgetInput`, Zod schema).
- Every mutation **invalidates `['budgets']`** and toasts.
- Categories come from `lib/categories.ts`; money via `formatCurrency`; dates via `format.ts` helpers.
- No new dependency introduced; month-window logic is reused (not duplicated).
