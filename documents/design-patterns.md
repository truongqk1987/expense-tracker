# Design Patterns in the Expense Tracker

A step-by-step walkthrough of the design patterns used in this codebase, each with
what it is, where it lives, the actual code, and why it was chosen.

> Reading note: this is a modern React + TypeScript app, so several classic
> (Gang-of-Four) patterns show up as *framework idioms* rather than hand-rolled
> class hierarchies. Where that's the case it's called out honestly under
> **"Deliberate vs. idiomatic"** so you can tell which choices were intentional
> design decisions and which come for free with the stack.

---

## Table of contents

**Creational**
1. [Factory / Factory Method](#1-factory--factory-method)
2. [Singleton](#2-singleton)
3. [Object Mother (test factory)](#3-object-mother-test-factory)

**Structural**
4. [Facade](#4-facade)
5. [Adapter](#5-adapter)
6. [Decorator / Wrapper](#6-decorator--wrapper)
7. [Composite (provider & route composition)](#7-composite-provider--route-composition)

**Behavioral**
8. [Observer / Publish–Subscribe](#8-observer--publishsubscribe)
9. [Strategy](#9-strategy)
10. [Command](#10-command)
11. [Template Method (shared hook step)](#11-template-method-shared-hook-step)
12. [Null Object](#12-null-object)

**Cross-cutting / architectural**
13. [Schema as Single Source of Truth](#13-schema-as-single-source-of-truth)
14. [Container / Presentational split](#14-container--presentational-split)

15. [What's intentionally *not* here](#15-whats-intentionally-not-here)

---

## Creational

### 1. Factory / Factory Method

**What it is:** a function that constructs and returns objects, hiding the
construction details from callers.

**Where:** `src/features/expenses/hooks.ts`, `src/lib/supabase.ts`, the Zustand
stores.

**Step by step — the query-key factory:**

```ts
// src/features/expenses/hooks.ts
const KEY = ['expenses'] as const

export function expensesKey(filters: ExpenseFilters) {
  return [...KEY, filters] as const
}
```

1. TanStack Query identifies every cached query by an array "key".
2. Rather than sprinkling `['expenses', filters]` literals across the code (easy
   to typo, hard to change), a single factory function produces the key.
3. `useExpenses()` builds its key with it, and `useInvalidate()` invalidates
   using the shared `KEY` prefix — so *one* factory keeps read and invalidation
   in agreement.

**Other factories in the project:**

```ts
// src/lib/supabase.ts — factory constructs the typed client
export const supabase = createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', { … })
```

```ts
// stores — create(...) is Zustand's store factory
export const useUIStore = create<UIState>((set) => ({ … }))
```

**Why:** centralizes construction, removes duplicated literals, and makes the
cache-key contract a single, testable unit.

---

### 2. Singleton

**What it is:** exactly one shared instance of something, reused everywhere.

**Where:** the Supabase client and all three Zustand stores.

**Step by step:**

```ts
// src/lib/supabase.ts
export const supabase = createClient<Database>(…)   // created once at module load
```

1. Because it's a module-level `export const`, Node/Vite's module cache
   guarantees the client is instantiated **once**. Every `import { supabase }`
   gets the same instance — one connection pool, one auth session.

2. The Zustand stores are the same idea for state:

```ts
export const useUIStore   = create<UIState>(…)
export const useToastStore = create<ToastState>(…)
export const useAuthStore  = create<AuthState>(…)
```

**The tell that this is a real singleton (not just a module export):** the test
suite has to actively *reset* the shared instance between cases —

```ts
// src/test/resetStores.ts
beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true)
  useToastStore.setState({ toasts: [] })
})
```

The comment even names it: *"Zustand stores are module-level singletons that
persist across tests."* Global shared state is the defining property of the
Singleton pattern, and here it's managed explicitly.

**Why:** a single auth/session source of truth and a single UI-state instance the
whole tree can read and mutate consistently.

---

### 3. Object Mother (test factory)

**What it is:** a helper that builds fully-formed domain objects for tests, with
sensible defaults and per-test overrides. (A specialized creational pattern.)

**Where:** `src/test/factories.ts`.

**Step by step:**

```ts
let seq = 0
export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  seq += 1
  return {
    id: `exp-${seq}`, user_id: 'user-1', amount: 10, category: 'food',
    note: null, spent_at: '2026-07-12', created_at: '2026-07-12T00:00:00.000Z',
    ...overrides,
  }
}
```

1. Every field gets a valid default, so a test that doesn't care about most
   fields writes `makeExpense()`.
2. A test that cares about one field writes `makeExpense({ amount: 99 })` — the
   spread lets overrides win.
3. The `seq` counter guarantees unique `id`s across a test file.

**Why:** tests stay focused on the one thing under test; adding a field to
`Expense` means editing one factory, not fifty test setups.

---

## Structural

### 4. Facade

**What it is:** a small, clean interface in front of a more complicated
subsystem.

**Where:** `src/features/expenses/api.ts` (over the Supabase query builder) and
the `toast` helper (over the toast store).

**Step by step — the API facade:**

```ts
// src/features/expenses/api.ts
export async function listExpenses(filters: ExpenseFilters): Promise<Expense[]> {
  let query = supabase.from('expenses').select('*')
    .order('spent_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.from) query = query.gte('spent_at', filters.from)
  if (filters.to)   query = query.lte('spent_at', filters.to)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}
```

1. Callers (the hooks) never see `.from().select().eq().gte()` chains or the
   `{ data, error }` envelope.
2. They call four plain, typed functions: `listExpenses`, `createExpense`,
   `updateExpense`, `deleteExpense`.
3. The facade also normalizes errors uniformly (`throw new Error(error.message)`)
   so upstream code always deals with plain `Error`s.

**Step by step — the toast facade:**

```ts
// src/stores/toastStore.ts
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error:   (message: string) => useToastStore.getState().push('error', message),
}
```

Turns the multi-step "reach into the store singleton and push a typed record"
into `toast.success('Expense added')` — usable even outside React components.

**Why:** the rest of the app depends on a stable, minimal surface; the messy
subsystem details stay in one place.

---

### 5. Adapter

**What it is:** makes one interface work with another that expects a different
shape.

**Where:** form validation and the auth bridge.

**Step by step — Zod ↔ React Hook Form:**

```ts
// src/features/expenses/components/ExpenseForm.tsx
useForm<FormValues>({
  resolver: zodResolver(expenseFormSchema),
  …
})
```

`react-hook-form` doesn't know what a Zod schema is; it expects a "resolver"
function. `zodResolver(...)` is an **adapter** that presents the Zod schema
through the resolver interface RHF understands.

**Step by step — Supabase auth → Zustand:**

```ts
// src/providers/AuthProvider.tsx
supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session)
  setLoading(false)
})
```

`AuthProvider` adapts Supabase's event-callback API into calls on the app's own
`authStore` interface — two systems that don't know about each other, joined by
an adapter layer.

**Why:** lets independently-designed libraries collaborate without either one
knowing about the other.

---

### 6. Decorator / Wrapper

**What it is:** wrap something to add behavior while preserving its original
interface.

**Where:** the `Button` and `Input`/`Select` primitives, and the route guards.

**Step by step — `Button` decorates `<button>`:**

```ts
// src/components/ui/Button.tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; children: ReactNode
}

export function Button({ variant='primary', size='md', loading=false, disabled, className='', children, ...rest }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || loading} {...rest}>
      {loading && <span className="… animate-spin …" />}
      {children}
    </button>
  )
}
```

1. `extends ButtonHTMLAttributes<…>` + `{...rest}` means it keeps the *entire*
   native button interface (onClick, type, aria-*, …).
2. It *adds* styling variants, a `loading` spinner, and the loading→disabled
   rule — behavior the native element doesn't have.
3. `Input` and `Select` in `Field.tsx` do the same, adding an `invalid` styling
   prop over the native controls.

**Step by step — route guards decorate a page:**

```ts
// src/routes/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)
  if (loading)  return <Spinner … />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

`<ProtectedRoute><Dashboard/></ProtectedRoute>` wraps the page with an auth gate
without the page knowing anything about auth.

**Why:** add cross-cutting behavior (styling, loading, auth) without modifying or
subclassing the thing being wrapped.

---

### 7. Composite (provider & route composition)

**What it is:** compose objects into tree structures and treat the composition
uniformly.

**Where:** `src/App.tsx` and `src/routes/AppRoutes.tsx`.

**Step by step:**

```tsx
// src/App.tsx
export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryProvider>
  )
}
```

1. The app is assembled as a tree of nested providers, each contributing one
   capability (server-cache, auth, routing, toasts).
2. Every layer has the same `{ children }` shape, so they nest uniformly and the
   order expresses dependency (Query is outermost because Auth uses it).

**Why:** capabilities compose cleanly and the composition root reads top-to-bottom
as "what wraps what."

---

## Behavioral

### 8. Observer / Publish–Subscribe

**What it is:** subscribers register interest; when the subject changes, they're
notified.

**Where:** Zustand selectors, the Supabase auth subscription, and Query cache
invalidation.

**Step by step — store subscription via selectors:**

```ts
// components subscribe to a *slice* of the store
const filters = useUIStore((s) => s.filters)
const open    = useUIStore((s) => s.formOpen)
```

1. Each selector subscribes the component to just that slice of state.
2. When `setFilters(...)` runs, only components observing `filters` re-render —
   classic observer with fine-grained notifications.

**Step by step — the auth event subscription (with cleanup):**

```ts
// src/providers/AuthProvider.tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange(…)
return () => { active = false; subscription.unsubscribe() }
```

Registers an observer on login/logout/token-refresh, and — importantly —
*unsubscribes* on unmount to avoid leaks.

**Step by step — cache invalidation as notification:**

```ts
// src/features/expenses/hooks.ts
const qc = useQueryClient()
return () => qc.invalidateQueries({ queryKey: KEY })
```

After a mutation, invalidation "notifies" every query observing the `expenses`
key to refetch.

**Why:** decouples state producers from consumers; the UI reacts to change without
manual wiring.

---

### 9. Strategy

**What it is:** select one of several interchangeable behaviors at runtime.

**Where:** the `variants`/`sizes` maps in `Button`, `invalid` styling in
`Field`, and query building in `listExpenses`.

**Step by step — styling strategy by prop:**

```ts
// src/components/ui/Button.tsx
const variants: Record<Variant, string> = {
  primary:   'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  danger:    'bg-danger text-white hover:bg-red-700',
  ghost:     'bg-transparent text-muted hover:bg-canvas',
}
// chosen at render: variants[variant]
```

The `variant` prop picks a styling "strategy" from a lookup table — no `if/else`
ladder, and adding a variant is a one-line entry.

**Step by step — query strategy from filters:**

```ts
// src/features/expenses/api.ts
if (filters.category) query = query.eq('category', filters.category)
if (filters.from)     query = query.gte('spent_at', filters.from)
if (filters.to)       query = query.lte('spent_at', filters.to)
```

The active filters compose which query strategy runs.

**Why:** interchangeable behaviors stay open for extension and free of branching
sprawl.

---

### 10. Command

**What it is:** encapsulate an action (and its handlers) as an object you can
pass around and invoke later.

**Where:** the mutation hooks and the store actions.

**Step by step — mutations as commands:**

```ts
// src/features/expenses/hooks.ts
export function useCreateExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    onSuccess: () => { invalidate(); toast.success('Expense added') },
    onError:   (e: Error) => toast.error(e.message),
  })
}
```

1. Each hook returns a command object carrying the action (`mutationFn`) plus its
   success/failure handlers.
2. The caller triggers it later, decoupled from the "how":

```ts
// src/features/expenses/components/ExpenseFormModal.tsx
create.mutate(input, { onSuccess: () => close() })
update.mutate({ id: target.id, input }, { onSuccess: () => close() })
```

**Step by step — store actions as commands:**

```ts
// src/stores/uiStore.ts
openCreateForm: () => set({ formOpen: true, formTarget: null }),
requestDelete:  (expense) => set({ deleteTarget: expense }),
setFilters:     (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
```

Each is a named, self-contained state-change command the UI invokes by name.

**Why:** actions become first-class values — passable, composable, and testable
independent of where they're triggered.

---

### 11. Template Method (shared hook step)

**What it is:** define a fixed skeleton of steps, letting the shared part be
reused across variants.

**Where:** `useInvalidate` reused by all three mutation hooks.

**Step by step:**

```ts
// src/features/expenses/hooks.ts
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: KEY })
}
```

1. Create / update / delete each follow the same skeleton: *do the mutation →
   invalidate the cache → toast*.
2. The invariant middle step ("invalidate the `expenses` key") is factored into
   one reusable unit; each mutation only supplies its own `mutationFn` and toast
   message.

**Why:** the common workflow lives in one place; the three mutations differ only
where they must.

---

### 12. Null Object

**What it is:** return a safe, do-nothing/default object instead of `null` so
callers don't have to special-case absence.

**Where:** `getCategory` in `src/lib/categories.ts`.

**Step by step:**

```ts
// src/lib/categories.ts
const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.value, c]))

export function getCategory(value: string): Category {
  return CATEGORY_MAP.get(value) ?? {
    value, label: value, color: 'var(--color-cat-other)',
  }
}
```

1. A known category returns its full record.
2. An **unknown** category returns a valid fallback `Category` (labeled by its own
   value, neutral color) instead of `null`.
3. Callers can always render a color + label — no null checks, no crashes on
   legacy/unexpected data.

(The `Map` here is also a small optimization — O(1) lookups instead of scanning
the `CATEGORIES` array each call.)

**Why:** eliminates a whole class of "forgot to handle missing category" bugs at
the UI layer.

---

## Cross-cutting / architectural

### 13. Schema as Single Source of Truth

**What it is:** declare the data shape once and *derive* both runtime validation
and the static type from it (rather than writing the type and the validator
separately and keeping them in sync by hand).

**Where:** `ExpenseForm.schema.ts`.

**Step by step:**

```ts
// src/features/expenses/components/ExpenseForm.schema.ts
export const expenseFormSchema = z.object({
  amount:   z.number({ message: 'Enter an amount' }).positive('Must be greater than 0'),
  category: z.enum(CATEGORY_VALUES),
  spent_at: z.string().min(1, 'Pick a date'),
  note:     z.string().max(200, 'Keep it under 200 characters').optional(),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>
```

1. The Zod object is the *one* declaration of the form's rules.
2. `z.infer<…>` derives the TypeScript type from it — the type can never drift
   from the validation.
3. `CATEGORY_VALUES` (derived from the shared `CATEGORIES` list) feeds the enum,
   so form options, filter options, and validation all trace back to one list.

**Why:** no double-maintenance of "the type" and "the validator"; change a rule in
one place and both runtime + compile-time follow.

---

### 14. Container / Presentational split

**What it is:** separate components that *fetch/coordinate* (containers) from
components that *render* (presentational).

**Where:** `ExpenseFormModal` (container) vs. `ExpenseForm` (presentational).

**Step by step:**

```tsx
// container — knows about stores + mutations
// src/features/expenses/components/ExpenseFormModal.tsx
const target = useUIStore((s) => s.formTarget)
const create = useCreateExpense()
const update = useUpdateExpense()
…
<ExpenseForm key={target?.id ?? 'new'} initial={target}
             submitting={create.isPending || update.isPending}
             onSubmit={handleSubmit} onCancel={close} />
```

```tsx
// presentational — pure, only props in / callbacks out
// src/features/expenses/components/ExpenseForm.tsx
interface ExpenseFormProps {
  initial?: Expense | null
  submitting: boolean
  onSubmit: (input: ExpenseInput) => void
  onCancel: () => void
}
```

1. `ExpenseForm` has no knowledge of stores, mutations, or Supabase — it takes
   data + callbacks and renders. That makes it trivial to test in isolation.
2. `ExpenseFormModal` does all the wiring: reads the UI store, picks
   create-vs-update, tracks `isPending`, closes on success.
3. Bonus idiom: `key={target?.id ?? 'new'}` forces a remount so the form's
   default values reset when the edit target changes.

**Why:** rendering logic stays pure and reusable; coordination logic stays in one
clearly-responsible place.

---

## 15. What's intentionally *not* here

Worth knowing which patterns were skipped, and why it's reasonable:

- **Repository pattern (missing).** `api.ts` is a facade but is hard-wired to
  Supabase. There's no interface abstracting the data source, so swapping
  backends would touch this file directly. For an app of this size that's a fair
  trade — but it's the first abstraction to add if a second backend or heavy
  mocking need appears. (Tests currently mock the `api` module instead.)
- **Deliberate vs. idiomatic.** The most *intentional* pattern choices in this
  repo are the **query-key factory**, the **facade data layer**, the
  **schema-as-source-of-truth**, the **Strategy variant maps**, and the
  **Null Object** in `getCategory`. Others — Observer (via hooks/selectors),
  Composite (provider nesting), Singleton (module exports) — are largely React /
  Zustand / ES-module idioms that *embody* the pattern rather than being
  hand-built. Both count, but it's honest to know the difference.

---

*Generated as a reading companion to the source. File references are accurate as
of the current `main` branch; if the code moves, re-check the paths.*
