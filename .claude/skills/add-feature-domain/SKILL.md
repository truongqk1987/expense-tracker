---
name: add-feature-domain
description: Scaffold a new feature domain under src/features/<name>/ the way expenses/ is built — types.ts, api.ts (Supabase facade), hooks.ts (query-key factory + useInvalidate + toasts), and components/. Use when adding a whole new area (budgets, categories, recurring, etc.), not a single field. Follows architect.md §9 and the project's facade/command/query-key patterns.
---

# Add a feature domain

New domains mirror `src/features/expenses/`. Components import **hooks**, never
`api.ts` or the `supabase` client directly (auth pages are the only exception).
Server data lives **only** in TanStack Query — never in Zustand.

## Prerequisite

If the domain needs a new table, run **`add-supabase-table`** first, then wire the
client type via **`add-db-column`**'s type step. `types.ts` below assumes the row
exists in `database.types.ts`.

## Files to create

Replace `things` / `Thing` with the domain name.

### 1. `types.ts` — derive the row, define the input

```ts
import type { Database } from '../../lib/database.types'

export type Thing = Database['public']['Tables']['things']['Row']

/** Fields the user supplies when creating/editing a thing. */
export interface ThingInput {
  label: string
  amount: number
  // ...user-supplied fields only; never user_id (RLS/insert stamps it)
}
```

### 2. `api.ts` — Supabase facade (never used directly by components)

- Queries are auto-scoped to the user by RLS — **do not** filter by `user_id` on
  reads.
- On **insert**, stamp `user_id` from `supabase.auth.getUser()` (the insert
  policy's `with check` requires it).
- Normalize every error to `throw new Error(error.message)`.

```ts
import { supabase } from '../../lib/supabase'
import type { Thing, ThingInput } from './types'

export async function listThings(): Promise<Thing[]> {
  const { data, error } = await supabase
    .from('things')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createThing(input: ThingInput): Promise<Thing> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')
  const { data, error } = await supabase
    .from('things')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateThing(id: string, input: ThingInput): Promise<Thing> {
  const { data, error } = await supabase
    .from('things').update(input).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteThing(id: string): Promise<void> {
  const { error } = await supabase.from('things').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

### 3. `hooks.ts` — query-key factory + mutations-as-commands

Every mutation follows the same skeleton: **mutate → invalidate the key → toast**.
Factor the invalidation into one `useInvalidate` (Template Method); build keys with
one factory so reads and invalidation stay in agreement.

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../stores/toastStore'
import { createThing, deleteThing, listThings, updateThing } from './api'
import type { ThingInput } from './types'

const KEY = ['things'] as const
export function thingsKey() { return [...KEY] as const }

export function useThings() {
  return useQuery({ queryKey: thingsKey(), queryFn: () => listThings() })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: KEY })
}

export function useCreateThing() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: ThingInput) => createThing(input),
    onSuccess: () => { invalidate(); toast.success('Thing added') },
    onError: (e: Error) => toast.error(e.message),
  })
}
// useUpdateThing({ id, input }) and useDeleteThing(id) follow the same shape.
```

> If the list takes filters, add a `ThingFilters` slice to `uiStore`, thread it
> through `thingsKey(filters)` / `listThings(filters)`, and read it in `useThings`
> — exactly like `expenses`. Changing filters changes the key → auto refetch.

### 4. `components/`

Split container vs. presentational: a container reads stores + calls hooks and
tracks `isPending`; a presentational component takes props/callbacks only and is
pure (trivially testable). Validation goes in a colocated `*.schema.ts` Zod file
whose type is `z.infer<...>`. Reuse `ui/` primitives (`Button`, `Field`, `Modal`,
`Spinner`) and `lib/format.ts` for money/dates.

## Rules (from architect.md §9)

- Components import hooks, **never** `api.ts` or `supabase` directly.
- **Never** store server data in Zustand; **never** filter by `user_id` on reads.
- Stamp `user_id` on inserts.
- Dates are `YYYY-MM-DD` strings — use `format.ts` helpers, not raw `Date`.
- Add colocated `*.test.ts[x]`; mock the `api` module, not `supabase`. Keep
  `yarn test` green.

## Checklist

- [ ] table exists with RLS (`add-supabase-table`) + row type in `database.types.ts`
- [ ] `types.ts`, `api.ts`, `hooks.ts`, `components/` created mirroring `expenses/`
- [ ] one query-key factory; `useInvalidate` shared across mutations
- [ ] inserts stamp `user_id`; reads don't filter by it
- [ ] container/presentational split; Zod schema colocated
- [ ] colocated tests added; lint + tests green
