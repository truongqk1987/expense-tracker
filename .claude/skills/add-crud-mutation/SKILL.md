---
name: add-crud-mutation
description: Add one new query or mutation to an EXISTING feature domain — a function in api.ts plus its TanStack Query hook in hooks.ts following the facade → mutate/invalidate/toast chain. Use for extending expenses (or another domain) with a new operation, not for scaffolding a whole domain (use add-feature-domain) or a schema change (use add-db-column).
---

# Add a CRUD operation to an existing domain

Two files, always in this order: a **facade function** in `api.ts`, then a
**hook** in `hooks.ts`. Components only ever call the hook.

## 1. Facade function (`api.ts`)

- Reads are auto-scoped by RLS — **do not** filter by `user_id`.
- Inserts must stamp `user_id` from `supabase.auth.getUser()` (the insert
  policy's `with check` requires it); throw `'You must be signed in.'` if absent.
- Always unwrap `{ data, error }` and normalize: `if (error) throw new
  Error(error.message)`.
- Use `.select().single()` when returning the affected row.

```ts
// example: archive an expense (a targeted update)
export async function archiveExpense(id: string): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update({ archived: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

## 2. Hook (`hooks.ts`)

**Query** → add to the existing key factory so it shares invalidation:

```ts
export function useThing(id: string) {
  return useQuery({ queryKey: [...KEY, id], queryFn: () => getThing(id) })
}
```

**Mutation** → follow the exact skeleton the other mutations use — *mutate →
`invalidate()` → success toast*, with an error toast. Reuse the existing
`useInvalidate()` (do not re-create it). Wrap multi-arg calls in a single object
arg, like `useUpdateExpense`:

```ts
export function useArchiveExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => archiveExpense(id),
    onSuccess: () => {
      invalidate()
      toast.success('Expense archived')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
```

## 3. Wire it up

Call from a **container** component: `archive.mutate(id)`, optionally with a
per-call `{ onSuccess }` (e.g. to close a modal) — the hook's own `onSuccess`
still runs. Never call `api.ts` or `supabase` from a component directly.

## 4. Test

Add colocated tests (see `write-colocated-test`): an `api.ts` test asserting the
built query + error path, and/or a component test mocking the `api` module.

## Checklist

- [ ] `api.ts` fn: unwraps `{ data, error }`, throws `error.message`
- [ ] inserts stamp `user_id`; reads don't filter by it
- [ ] hook reuses `KEY` / `useInvalidate`; mutations toast on success **and** error
- [ ] multi-arg mutation takes a single object arg
- [ ] component calls the hook, not `api`/`supabase`
- [ ] colocated tests added; `yarn test` green
