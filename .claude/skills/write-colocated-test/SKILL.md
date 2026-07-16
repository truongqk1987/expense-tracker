---
name: write-colocated-test
description: Write a Vitest test the project's way — colocated *.test.ts[x], using renderWithProviders, the makeExpense object-mother factory, resetStores for Zustand, and mocking the api module (not the supabase client) for components. Use whenever adding behavior that needs a test. CI and Render both run yarn test, so keep the suite green.
---

# Write a colocated test

Tests live **next to** the code (`Foo.tsx` → `Foo.test.tsx`). Vitest + jsdom;
Testing Library for components. Pick the layer you're testing and follow its
recipe.

## Choose the layer

- **Pure logic** (`summarize`, `format`, a Zod schema): import and assert
  directly — no providers, no mocks.
- **Component**: render with `renderWithProviders`, mock the feature `api`
  module, drive with `@testing-library/user-event`, assert on visible
  role/text.
- **`api.ts` facade**: mock `../../lib/supabase` with a chainable builder and
  assert the query it builds + its error handling.

## Shared infra (`src/test/`)

- `renderWithProviders(ui, { route })` — wraps in a fresh QueryClient (retries
  off) + `MemoryRouter`. Returns `{ queryClient, ...renderResult }`.
- `makeExpense(overrides)` — object-mother factory; every field defaulted, pass
  only what the test cares about: `makeExpense({ amount: 30, note: 'Bus' })`.
- `import '../../../test/resetStores'` (side-effect import) — add to **any** test
  that touches `uiStore`/`toastStore`; it resets the singleton stores in
  `beforeEach`.

## Component test template

Mock the **api module**, never the `supabase` client, for component/hook tests:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../test/resetStores'            // only if the test touches stores
import { renderWithProviders } from '../../../test/renderWithProviders'
import { makeExpense } from '../../../test/factories'
import { ExpenseList } from './ExpenseList'
import * as api from '../api'

vi.mock('../api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))
const mockApi = vi.mocked(api)

beforeEach(() => { vi.clearAllMocks() })

describe('ExpenseList', () => {
  it('renders a row per expense', async () => {
    mockApi.listExpenses.mockResolvedValue([makeExpense({ note: 'Bus', amount: 2.5 })])
    renderWithProviders(<ExpenseList />)
    expect(await screen.findByText('Bus')).toBeInTheDocument()
    expect(screen.getByText('$2.50')).toBeInTheDocument()
  })
})
```

Patterns worth copying from the real suite:
- Pending state: `mockResolvedValue`/`mockReturnValue(new Promise(() => {}))`
  (never resolves) to assert a spinner.
- Retry: `mockRejectedValueOnce(...)` then `mockResolvedValueOnce(...)` and click
  Retry to prove a refetch.
- Drive UI state through the store's actions, e.g.
  `useUIStore.getState().setFilters({ category: 'food' })`.

## api-facade test template

Mock the Supabase client with a chainable, thenable builder — test *your* query
building and error normalization, not the network:

```ts
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn() } },
}))
const mockSupabase = vi.mocked(supabase, true)

function makeBuilder(result) {           // every method returns the builder;
  const b = {}                           // awaiting it resolves to `result`
  for (const m of ['select','order','eq','gte','lte','insert','update','delete','single'])
    b[m] = vi.fn(() => b)
  b.then = (resolve) => resolve(result)
  return b
}
// mockSupabase.from.mockReturnValue(makeBuilder({ data: [...], error: null }))
// then assert builder.eq / builder.insert calls, and rejects.toThrow(msg) on error
```

Assert both the happy path (right `.eq/.insert` args, returned row) and the
error path (`{ error: { message } }` → `rejects.toThrow(message)`).

## Rules & checklist

- [ ] file colocated as `*.test.ts[x]`
- [ ] components mock the `api` module; only api-facade tests mock `supabase`
- [ ] `resetStores` imported if stores are touched
- [ ] use `makeExpense` for fixtures, not hand-built objects
- [ ] assert on user-visible role/text; drive with `user-event`
- [ ] cover the error/empty path, not just the happy one
- [ ] `yarn test` green (CI + Render both run it)
