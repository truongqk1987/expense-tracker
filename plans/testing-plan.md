# Testing Plan — Unit & Integration Tests (Vitest + React Testing Library)

Goal: **useful tests that focus on business logic**, not implementation details or UI markup.
Every test below answers a question like *"does the money add up correctly?"* or *"can the user
actually add an expense?"* — never *"does this div have this class?"*.

## Guiding principles

1. **Test behavior, not internals.** Query by role/label/text the way a user sees it
   (`getByRole('button', { name: /add expense/i })`), never by CSS class or component state.
2. **Business logic first.** The highest-value targets are pure functions (money math, date
   handling, aggregation) and user flows (add / edit / delete / filter). Presentational components
   (`Button`, `Spinner`, `Card`) get **no dedicated tests** — they're covered indirectly.
3. **Mock only the boundary.** Mock exactly one thing: the Supabase client (`src/lib/supabase.ts`).
   Everything above it (hooks, stores, React Query, components) runs for real. This is what makes
   an "integration" test actually integrate.
4. **One assertion theme per test.** A test name should read like a spec sentence:
   *"rolls up the top category across multiple expenses"*.

---

## Setup (one-time)

Install dev dependencies:

```bash
yarn add -D vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Add to `vite.config.ts` (Vitest reads the same config):

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

Scripts in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:cov": "vitest run --coverage"
```

### Two shared test helpers (write these once)

**`src/test/renderWithProviders.tsx`** — wraps a component in a fresh React Query client
(retry off, so failures surface immediately) plus a router when needed:

```tsx
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
```

**`src/test/resetStores.ts`** — Zustand stores are module singletons; reset them between tests:

```ts
import { beforeEach } from 'vitest'
import { useUIStore } from '../stores/uiStore'
import { useToastStore } from '../stores/toastStore'

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState())
  useToastStore.setState({ toasts: [] })
})
```

### Mocking Supabase (the single boundary)

Because `api.ts` imports the real `supabase` client, mock that module. Prefer mocking the **api
layer** for component/integration tests (simpler), and mock the **supabase client** only when
testing `api.ts` itself.

```ts
// In an integration test — mock the api module:
import { vi } from 'vitest'
vi.mock('../features/expenses/api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))
```

---

## PART 1 — Unit tests (pure logic, fast, no DOM)

These are the cheapest, highest-signal tests. Start here.

### 1.1 `lib/format.ts` → `src/lib/format.test.ts`  ⭐ highest priority
Pure money/date functions with real edge cases and a **known bug risk** (timezone).

| Test | Why it matters |
|------|----------------|
| `formatCurrency(0)` → `"$0.00"` | zero is a real value on the summary cards |
| `formatCurrency(1234.5)` → `"$1,234.50"` | thousands separator + 2 decimals |
| `formatDate('2026-07-12')` renders July 12 2026 | **timezone-safe** parsing — a naive `new Date('2026-07-12')` would shift a day in negative-UTC zones; this test guards that |
| `formatDate('')` / malformed input returns the raw string | defensive fallback path |
| `todayISO()` returns `YYYY-MM-DD`, zero-padded | form default; pad logic for months/days < 10 |
| `startOfMonthISO()` ends in `-01` and matches current year/month | drives the "spent this month" window |

> Tip: to assert `todayISO`/`startOfMonthISO` deterministically, use `vi.useFakeTimers()` +
> `vi.setSystemTime(new Date(2026, 0, 5))` and check padding (`2026-01-05`, `2026-01-01`).

### 1.2 `lib/categories.ts` → `src/lib/categories.test.ts`
| Test | Why |
|------|-----|
| `getCategory('food')` returns the Food & Drink entry | the happy path used everywhere |
| `getCategory('unknown')` falls back to `{ label:'unknown', color: other }` | **guards the SummaryCards top-category path** for legacy/removed categories |
| `CATEGORY_VALUES` contains every `CATEGORIES` value | keeps the Zod enum in sync with the list |

### 1.3 `SummaryCards.summarize()` → export it, test in `SummaryCards.summary.test.ts`  ⭐ highest priority
This is the app's core business calculation. **Refactor:** export the `summarize` function so it
can be unit-tested without rendering. Build expenses with a small factory.

| Test | Why it matters |
|------|----------------|
| empty array → all zeros, `count 0`, `topCategory null` | empty-state correctness |
| `filteredTotal` sums **all** rows passed in | this is the total-of-current-filter number |
| `monthTotal` includes only rows within `[startOfMonth, today]` | date-window logic — include a last-month and a future-dated row and assert they're excluded |
| `topCategory` picks the category with the **highest summed** amount, not highest single row | aggregation correctness (e.g. 3×$10 food beats 1×$25 bills) |
| ties / single category resolve sensibly | boundary behavior |

> Use fake timers here too so "this month" is deterministic.

### 1.4 Zod form schema → `ExpenseForm.schema.test.ts`
Export the `schema` from `ExpenseForm.tsx` (or hoist it to a sibling file) and test it directly —
validation *is* business logic and is far cheaper to test as data than through the DOM.

| Input | Expected |
|-------|----------|
| `amount: 0` | fails — "Must be greater than 0" |
| `amount: -5` | fails — positive constraint |
| `amount: NaN` (empty field via `valueAsNumber`) | fails — "Enter an amount" |
| valid food/date/amount | passes |
| `category: 'nonsense'` | fails — enum guard |
| `note` of 201 chars | fails — "under 200 characters" |
| `note` omitted | passes — optional |

### 1.5 Zustand stores → `uiStore.test.ts`, `toastStore.test.ts`
Test the state machine directly via `store.getState()` — no rendering.

**uiStore:**
- `openCreateForm()` → `formOpen true, formTarget null` (create mode)
- `openEditForm(expense)` → `formOpen true, formTarget === expense` (edit mode)
- `closeForm()` clears both
- `requestDelete` / `cancelDelete` toggle `deleteTarget`
- `setFilters({ category:'food' })` **merges** (doesn't drop `from`/`to`); `resetFilters()` restores empty

**toastStore** (use fake timers):
- `push('success','x')` appends a toast with an incrementing id + correct kind
- auto-dismiss removes it after 3500ms (`vi.advanceTimersByTime(3500)`)
- `dismiss(id)` removes the right toast; `toast.success/error` helpers push the correct kind

### 1.6 `api.ts` → `api.test.ts` (mock the supabase client)
Mock `src/lib/supabase.ts` with a chainable query-builder stub. Assert **our logic**, not Supabase:

| Test | Why |
|------|-----|
| `listExpenses` applies `.eq('category', …)` only when `filters.category` is set; same for `gte`/`lte` on from/to | **the conditional filter-building is our logic** |
| `listExpenses` returns `[]` when data is null | null-guard |
| any query error → throws `Error(error.message)` | error contract the hooks rely on |
| `createExpense` throws "You must be signed in." when `getUser()` returns no user | auth guard |
| `createExpense` injects `user_id` from the session into the insert | ownership correctness (pairs with RLS) |

---

## PART 2 — Integration tests (component + hooks + store + React Query)

Render real component trees, mock only the api module, and drive them with `userEvent`. These
prove the **user-facing flows** work end to end (minus the network).

### 2.1 ExpenseForm interaction → `ExpenseForm.test.tsx`  ⭐ highest priority
Render `<ExpenseForm>` with spy `onSubmit`/`onCancel`.

- **Validation blocks submit:** submit empty → `onSubmit` NOT called, "Enter an amount" shown.
- **Valid create:** type amount, pick category/date, submit → `onSubmit` called once with a
  correctly shaped `ExpenseInput` (number amount, chosen category, iso date).
- **Note trimming → null:** enter `"   "` (whitespace) → submitted `note` is `null`;
  enter `"  Lunch "` → submitted `note` is `"Lunch"` (trimmed). *(This is real business logic.)*
- **Edit mode prefill:** pass `initial={expense}` → fields show existing values and button reads
  "Save changes" instead of "Add expense".
- **Cancel:** click Cancel → `onCancel` called, `onSubmit` not.

### 2.2 Add-expense flow → `ExpenseFormModal.test.tsx`  ⭐ highest priority
The real create path: modal + form + `useCreateExpense` + React Query + toast.

- Open create form (`useUIStore.getState().openCreateForm()`), fill valid values, submit.
- Assert `createExpense` (mocked) called with the right input.
- On resolve: modal closes (`formOpen` false) **and** a success toast "Expense added" appears.
- **Edit path:** with `formTarget` set, submit calls `updateExpense(id, input)` and toasts
  "Expense updated".
- **Error path:** make the mock reject with `new Error('boom')` → an error toast "boom" appears
  and the modal stays open. *(Verifies the `onError` → `toast.error` wiring.)*

### 2.3 Expense list states → `ExpenseList.test.tsx`
Drive the four render states through the `useExpenses` query (mock `listExpenses`):

| State | Setup | Assert |
|-------|-------|--------|
| loading | pending promise | spinner shown |
| error | reject | error message + Retry button; clicking Retry refetches |
| empty (no filters) | resolve `[]`, filters empty | "No expenses yet" + Add button |
| empty (filtered) | resolve `[]`, set a filter | "No expenses match your filters" + Clear button |
| populated | resolve 2 rows | 2 list items rendered with their amounts/categories |

### 2.4 Filters drive the query → `Filters.test.tsx` (+ list)  ⭐ high value
This proves filters actually change what's fetched — the crux of the filter feature.

- Render `<Filters>` + `<ExpenseList>` together with a `listExpenses` mock that inspects its args.
- Select category "Food" → assert `listExpenses` re-called with `filters.category === 'food'`
  (React Query refetches because the query key includes filters — verify that contract).
- Set From/To dates → assert they reach the query; note the From `max`/To `min` cross-constraint.
- "Clear" appears only when a filter is active and resets the store to empty.

### 2.5 Delete flow → `DeleteConfirm.test.tsx`
- `requestDelete(expense)` opens the confirm; Cancel → `cancelDelete`, no api call.
- Confirm → `deleteExpense(id)` called, toast "Expense deleted", target cleared.

---

## What NOT to test (deliberately, to keep tests useful)

- **Presentational UI** (`Button`, `Spinner`, `Field`, `Card`, `Header`, `Modal` chrome) — no
  behavior of their own; covered indirectly by flows above. Testing their classes is noise.
- **Supabase itself / RLS** — that's enforced in the database, not the client; verify it in the
  Supabase dashboard (see the deployment plan), not in RTL.
- **Routing guards** (`ProtectedRoute`, `PublicOnlyRoute`) — thin wrappers over auth state; one
  small optional test each at most, not a priority.
- **Exact styling, colors, animation, toast timers in the DOM** — brittle, low value.

---

## Suggested execution order (by value/effort)

1. `format.test.ts` + `categories.test.ts` — pure, instant, catch the timezone/fallback bugs. ⭐
2. Extract & test `summarize()` — the core money aggregation. ⭐
3. `uiStore` / `toastStore` / Zod `schema` — pure state & validation logic.
4. `ExpenseForm.test.tsx` — note-trimming + validation gate. ⭐
5. `ExpenseFormModal.test.tsx` — full add/edit/error flow with toasts. ⭐
6. `ExpenseList` + `Filters` integration — states and filter-driven fetching.
7. `api.test.ts` + delete flow — round out the boundary and remaining mutation.

## Small refactors this plan asks for (all low-risk, improve testability)

- **Export `summarize`** from `SummaryCards.tsx` (currently module-private).
- **Export the Zod `schema`** from `ExpenseForm.tsx` (or move to `ExpenseForm.schema.ts`).
- Optionally add a tiny **`makeExpense(overrides)` factory** in `src/test/factories.ts` so tests
  build `Expense` rows without repeating all fields.

## A realistic coverage target

Aim for **high coverage on `lib/`, `stores/`, `features/expenses/{api,hooks}` and the form/summary
logic (the business core)** — ~90%+ there. Let presentational components sit low; overall line
coverage is a vanity metric. The point is that **every rule that decides money, dates, ownership,
validation, and the add/edit/delete/filter flows has a test that would fail if the rule broke.**
