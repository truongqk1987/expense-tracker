# Expense Tracker — Build Plan

A simple expense tracker with Auth and CRUD, built on the existing Vite + React scaffold.

## Stack summary

| Concern | Choice |
|---|---|
| UI | React 19 + TypeScript (existing Vite scaffold) |
| Styling | TailwindCSS v4 (via `@tailwindcss/vite` — CSS-based config, fits Vite 8) |
| Auth + DB | Supabase (Postgres + Auth + Row Level Security) |
| Server state | TanStack Query (fetch/cache/mutate expenses) |
| Client state | Zustand (session/user + UI state like modals, filters) |
| Forms/validation | React Hook Form + Zod |
| Routing | React Router v7 |
| Design | Flat UI, easy to use, responsive (desktop + mobile) — Tailwind utility classes |

## UI / Design requirements
- **Flat UI:** no skeuomorphism or heavy shadows/gradients — solid fills, clear borders, generous whitespace, a small consistent color palette, and simple flat icons (an SVG sprite already lives in `public/icons.svg`).
- **Easy to use:** minimal steps to add an expense (single primary action always visible), clear labels, obvious empty/loading states, sensible defaults (e.g. date = today).
- **Responsive (desktop + mobile):** mobile-first Tailwind breakpoints (`sm/md/lg`). On desktop use a multi-column layout (sidebar/summary + list); on mobile stack to a single column with a bottom or floating "+ Add" action and touch-friendly hit targets (min 44px).
- Define the palette and spacing as Tailwind theme tokens (in `src/index.css` via the v4 `@theme` block) so styling stays consistent across components.

## Phase 1 — Foundation & tooling
1. Install deps: `@supabase/supabase-js @tanstack/react-query zustand react-router-dom react-hook-form zod @hookform/resolvers`
2. Install Tailwind v4: `tailwindcss @tailwindcss/vite`, add the plugin to `vite.config.ts`, and put `@import "tailwindcss";` at the top of `src/index.css`. Delete the boilerplate `App.css` and template markup.
3. Add `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and `.env.example`). Confirm `.env.local` is gitignored.

## Phase 2 — Supabase setup (dashboard, no backend code)
1. Create project. Create an `expenses` table:
   - `id uuid pk default gen_random_uuid()`, `user_id uuid references auth.users`, `amount numeric`, `category text`, `note text`, `spent_at date`, `created_at timestamptz default now()`
2. Enable **Row Level Security** and add a policy so users only see/write their own rows: `auth.uid() = user_id`. This is the security backbone — it makes CRUD safe without a custom backend.
3. Create `src/lib/supabase.ts` exporting a typed client.

## Phase 3 — Auth
1. `AuthProvider` + a Zustand `authStore` holding `session`/`user`; subscribe to `supabase.auth.onAuthStateChange`.
2. Pages: `Login`, `SignUp` (email/password via `supabase.auth.signInWithPassword` / `signUp`).
3. `ProtectedRoute` wrapper redirecting unauthenticated users to `/login`.

## Phase 4 — Expenses CRUD (the core)
1. `src/features/expenses/api.ts` — thin functions: `listExpenses`, `createExpense`, `updateExpense`, `deleteExpense` (all scoped by RLS automatically).
2. `src/features/expenses/hooks.ts` — TanStack Query hooks: `useExpenses` (query) + `useCreate/useUpdate/useDelete` (mutations that invalidate the `['expenses']` query).
3. UI: expense list, add/edit form (RHF + Zod), delete confirm. Category filter + date range in Zustand UI store.

## Phase 5 — Dashboard & polish
1. Summary cards (total this month, by category) derived from cached query data.
2. Loading/empty/error states, basic toast on mutations.
3. **Responsive flat-UI layout:** desktop two-column (summary + expense list), mobile single-column with a floating "+ Add" button. Verify both breakpoints. Consistent flat components from `components/ui/`.

## Proposed structure
```
src/
  lib/supabase.ts
  stores/authStore.ts, uiStore.ts        # Zustand
  providers/QueryProvider.tsx, AuthProvider.tsx
  routes/                                 # ProtectedRoute, router
  features/expenses/                      # api.ts, hooks.ts, components
  pages/                                  # Login, SignUp, Dashboard
  components/ui/                          # shared buttons/inputs
```

## Build order
Phase 1 → 2 → 3 → 4 → 5. Auth before CRUD, because RLS relies on the logged-in user.

## Notes
- Generate **Supabase TypeScript types** from the schema so the DB and client stay in sync.
- React Hook Form + Zod give typed, validated forms — keeps the CRUD forms clean.
