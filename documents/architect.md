# Architecture — Expense Tracker

> A reference for AI agents (and humans) working in this repo. Read this first to
> plan and implement tasks quickly without re-deriving the system from scratch.

## 1. What this is

A single-page **expense tracker**: users sign up / sign in, then record, filter,
edit and delete their own expenses. Each expense has an amount, category, date
and optional note. A summary panel rolls the list up into this-month total,
filtered total, count, and top category.

There is **no custom backend**. The app talks directly to **Supabase**
(Postgres + Auth). Data isolation between users is enforced by **Postgres Row
Level Security (RLS)**, not by application code.

## 2. Tech stack

| Concern            | Choice                                   |
| ------------------ | ---------------------------------------- |
| UI framework       | React 19 + TypeScript, Vite 8 SPA        |
| Styling            | Tailwind CSS v4 (`@tailwindcss/vite`), theme tokens in `src/index.css` |
| Routing            | `react-router-dom` v7 (`BrowserRouter`)  |
| Server state / cache | TanStack Query v5                      |
| Client/UI state    | Zustand v5 (three stores)                |
| Forms + validation | react-hook-form + Zod (`@hookform/resolvers`) |
| Backend            | Supabase (`@supabase/supabase-js`) — Auth + Postgres + RLS |
| Testing            | Vitest + Testing Library (jsdom)         |
| Hosting            | Render static site (see `render.yaml`)   |
| CI                 | GitHub Actions (`.github/workflows/ci.yml`) |

Package manager is **yarn** (there is a `yarn.lock`; do not use npm).

## 3. Directory map

```
src/
  main.tsx                 # React root → <App/>
  App.tsx                  # Provider stack: QueryProvider → AuthProvider → AppRoutes + Toaster
  index.css                # Tailwind + design tokens (--color-brand, --color-cat-*, etc.)

  lib/                     # Framework-agnostic helpers
    supabase.ts            # Singleton Supabase client + isSupabaseConfigured flag
    database.types.ts      # Generated Supabase DB types (source of truth for row shapes)
    categories.ts          # CATEGORIES list + getCategory(); shared by form/filter/list
    format.ts              # formatCurrency, formatDate, todayISO, startOfMonthISO

  providers/
    QueryProvider.tsx      # TanStack QueryClient (staleTime 30s, retry 1, no refetch-on-focus)
    AuthProvider.tsx       # Bootstraps session + subscribes to Supabase auth changes → authStore

  stores/                  # Zustand — client state only, never server data
    authStore.ts           # { session, user, loading }
    uiStore.ts             # Form modal target, delete target, list filters
    toastStore.ts          # Toast queue + toast.success/error helpers (usable outside React)

  routes/
    AppRoutes.tsx          # Route table
    ProtectedRoute.tsx     # Gate: requires a session, else → /login
    PublicOnlyRoute.tsx    # Gate: redirects authed users away from /login, /signup

  pages/
    AuthShell.tsx          # Shared layout/branding for auth pages
    Login.tsx              # signInWithPassword
    SignUp.tsx             # signUp (handles email-confirmation vs instant-session)
    Dashboard.tsx          # Main authed screen: Header + Summary + Filters + List + modals

  components/
    Header.tsx             # App bar: add-expense, user email, sign out
    Toaster.tsx            # Renders toastStore queue
    ui/                    # Presentational primitives: Button, Field, Modal, Spinner

  features/expenses/       # The one feature domain (feature-folder pattern)
    types.ts               # Expense (= DB row) and ExpenseInput (form payload)
    api.ts                 # Supabase CRUD: list/create/update/deleteExpense
    hooks.ts               # TanStack Query hooks: useExpenses + create/update/delete mutations
    components/
      Filters.tsx          # Category + date-range filter controls (→ uiStore)
      SummaryCards.tsx     # Renders summarize() output
      summarize.ts         # Pure roll-up of Expense[] → Summary
      ExpenseList.tsx      # Query + list rendering
      ExpenseRow.tsx       # Single row + edit/delete actions
      ExpenseFormModal.tsx # Create/edit modal shell (reads uiStore.formTarget)
      ExpenseForm.tsx      # The form itself
      ExpenseForm.schema.ts# Zod schema for the expense form
      DeleteConfirm.tsx    # Delete confirmation modal (reads uiStore.deleteTarget)

  test/                    # Test infra: renderWithProviders, factories, resetStores, setup

supabase/schema.sql        # Table + indexes + RLS policies (run in Supabase SQL editor)
```

## 4. Provider / render tree

```
<App>
 └ QueryProvider          (TanStack QueryClient)
    └ AuthProvider        (loads session, syncs authStore)
       ├ AppRoutes        (BrowserRouter + route gates)
       │   ├ /login   → PublicOnlyRoute → Login
       │   ├ /signup  → PublicOnlyRoute → SignUp
       │   ├ /        → ProtectedRoute  → Dashboard
       │   └ *        → redirect to /
       └ Toaster        (global toast outlet)
```

## 5. Authentication flow

Auth is fully delegated to Supabase Auth (email + password). The client keeps a
persisted, auto-refreshing session (`persistSession`, `autoRefreshToken`,
`detectSessionInUrl` — see `src/lib/supabase.ts`).

**Session bootstrap (`AuthProvider`)**
1. On mount, calls `supabase.auth.getSession()` → seeds `authStore` and flips
   `loading` to `false`.
2. Subscribes via `supabase.auth.onAuthStateChange(...)` so login, logout and
   token refresh keep `authStore.session` / `authStore.user` current.
3. Unsubscribes on unmount.

**Route gating**
- `authStore.loading` starts `true`. While loading, `ProtectedRoute` shows a
  spinner (prevents a flash-redirect to /login before the session is known).
- `ProtectedRoute`: no session → `<Navigate to="/login">`.
- `PublicOnlyRoute`: has session → `<Navigate to="/">` (keeps logged-in users
  off the auth pages).

**Sign in** — `Login.tsx` → `supabase.auth.signInWithPassword` → on success
navigate to `/`. `onAuthStateChange` updates the store in the background.

**Sign up** — `SignUp.tsx` → `supabase.auth.signUp`. Two outcomes:
- Email confirmation **disabled** → a session is returned → navigate to `/`.
- Email confirmation **enabled** → no session yet → toast "check your email" and
  navigate to `/login`.

**Sign out** — `Header.tsx` → `supabase.auth.signOut()`; the auth listener clears
the store and the route gate bounces the user to `/login`.

**Authorization / data isolation** — enforced in the database, not the client.
Every table query is auto-scoped to `auth.uid()` by RLS policies, so the client
never filters by `user_id` on reads. `createExpense` does stamp `user_id` on
insert (required by the insert policy's `with check`).

## 6. Data model & backend

Single table `public.expenses` (`supabase/schema.sql`):

| Column       | Type            | Notes                                  |
| ------------ | --------------- | -------------------------------------- |
| `id`         | uuid PK         | `gen_random_uuid()`                    |
| `user_id`    | uuid FK         | → `auth.users(id)`, `on delete cascade`|
| `amount`     | numeric(12,2)   | `check (amount >= 0)`                   |
| `category`   | text            | one of `categories.ts` values          |
| `note`       | text nullable   |                                        |
| `spent_at`   | date            | default `current_date`                 |
| `created_at` | timestamptz     | default `now()`                        |

Index: `(user_id, spent_at desc)` for the default list ordering.

**Row Level Security** is enabled with four policies (select / insert / update /
delete), each keyed on `auth.uid() = user_id`. This is the security backbone —
never bypass or weaken it.

`src/lib/database.types.ts` is the generated type mirror of this schema and the
source of truth for `Expense` (`types.ts` derives `Expense` from it).

## 7. Data flow — server state (the CRUD loop)

Server state lives **only** in TanStack Query; Zustand never stores expense data.

```
Component → hooks.ts (useQuery/useMutation) → api.ts → supabase-js → Postgres (RLS)
```

- **Read**: `useExpenses()` reads `uiStore.filters`, builds a query key
  `['expenses', filters]`, and calls `listExpenses(filters)`. Changing filters
  changes the key → automatic refetch/caching.
- **Write**: `useCreateExpense` / `useUpdateExpense` / `useDeleteExpense` wrap the
  matching `api.ts` call. On success they **invalidate `['expenses']`** (all
  filter variants) and fire a success toast; on error they toast the message.
- **Derived data**: `summarize()` is a pure function over the fetched
  `Expense[]`; `SummaryCards` renders it. No separate query.

Query defaults (`QueryProvider`): `staleTime` 30s, `retry` 1, no refetch on
window focus.

## 8. Data flow — client/UI state (Zustand)

- **`uiStore`** drives ephemeral UI: `openCreateForm()` / `openEditForm(expense)`
  set `formTarget` (null = create, expense = edit) consumed by `ExpenseFormModal`;
  `requestDelete(expense)` / `cancelDelete()` drive `DeleteConfirm`; `filters` +
  `setFilters()` / `resetFilters()` drive `Filters` and feed `useExpenses`.
- **`toastStore`** is a self-dismissing (3.5s) queue. Import the `toast` helper to
  notify from anywhere — including non-React code like mutation callbacks.
- **`authStore`** is written only by `AuthProvider`; components read from it.

## 9. Conventions for making changes

- **New feature domain** → add a folder under `src/features/<name>/` mirroring
  `expenses/` (`types.ts`, `api.ts`, `hooks.ts`, `components/`).
- **Talking to Supabase** → put raw calls in a feature `api.ts`; wrap them in
  TanStack Query hooks in `hooks.ts`. Components import hooks, never `api.ts` or
  the `supabase` client directly (auth pages are the exception — they call
  `supabase.auth.*`).
- **After a mutation**, invalidate the relevant query key so the list refreshes.
- **Never store server data in Zustand**; never filter by `user_id` on the client
  (RLS does it). Do stamp `user_id` on inserts.
- **Categories** are centralized in `lib/categories.ts` — reuse `CATEGORIES` /
  `getCategory`; don't hard-code category strings in UI.
- **Dates** are `YYYY-MM-DD` strings; use `format.ts` helpers (timezone-safe) for
  display and defaults rather than raw `Date` formatting.
- **Validation** lives in Zod schemas next to the form; infer the TS type from the
  schema.
- **Adding a DB column** → update `supabase/schema.sql`, regenerate/adjust
  `database.types.ts`, then `ExpenseInput` and the form schema.

## 10. Environment, build & deploy

- **Env vars** (Vite, must be prefixed `VITE_`): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`. Copy `.env.example` → `.env.local` for local dev.
  `isSupabaseConfigured` gates a friendly warning when they're missing.
- **Scripts**: `yarn dev` (HMR), `yarn build` (`tsc -b && vite build` → `dist/`),
  `yarn lint`, `yarn preview`, `yarn test`, `yarn test:watch`, `yarn test:cov`.
- **CI** (`.github/workflows/ci.yml`) on push/PR to `main`: install → lint → test
  → build (Node 22).
- **Deploy** (`render.yaml`): Render **static site**, `buildCommand: yarn test &&
  yarn build`, publish `./dist`, SPA rewrite `/*` → `/index.html`, PR previews on.
  Supabase env vars are set in the Render dashboard (`sync: false` — never
  committed). Node 22 is required by `@supabase/supabase-js`.

## 11. Testing

- Vitest + jsdom; setup in `src/test/setup.ts`, config in `vite.config.ts`.
- `src/test/renderWithProviders.tsx` wraps components in the Query/Router/etc.
  providers; `factories.ts` builds `Expense` fixtures; `resetStores.ts` clears
  Zustand stores between tests.
- Tests are colocated (`*.test.ts[x]`). Pure logic (`summarize`, `format`,
  `categories`, form schema) and components/api are covered. When adding
  behavior, add a colocated test and keep the suite green (CI + Render both run
  it).
```

Key entry points to open first when planning a task: `src/App.tsx` (wiring),
`src/features/expenses/hooks.ts` + `api.ts` (data), `supabase/schema.sql` (model
& security), and this document.
