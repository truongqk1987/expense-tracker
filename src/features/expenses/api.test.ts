import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import {
  createExpense,
  createExpenses,
  deleteExpense,
  listExpenses,
  updateExpense,
} from './api'
import { makeExpense } from '../../test/factories'
import type { ExpenseFilters } from '../../stores/uiStore'

// Mock the Supabase client so we test *our* query-building and error handling,
// not the network. The builder is chainable and thenable, mirroring supabase-js.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}))

const mockSupabase = vi.mocked(supabase, true)

type Result = { data: unknown; error: { message: string } | null }

/** A chainable query builder whose every method returns itself and which
 *  resolves (when awaited) to `result`. */
function makeBuilder(result: Result) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: unknown
  } = {}
  for (const m of [
    'select',
    'order',
    'eq',
    'gte',
    'lte',
    'insert',
    'update',
    'delete',
    'single',
  ]) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = (resolve: (r: Result) => unknown) => resolve(result)
  return builder as unknown as Record<string, ReturnType<typeof vi.fn>>
}

const noFilters: ExpenseFilters = { category: '', from: '', to: '' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listExpenses', () => {
  it('does not add category/date clauses when no filters are set', () => {
    const builder = makeBuilder({ data: [], error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    return listExpenses(noFilters).then(() => {
      expect(builder.eq).not.toHaveBeenCalled()
      expect(builder.gte).not.toHaveBeenCalled()
      expect(builder.lte).not.toHaveBeenCalled()
    })
  })

  it('applies category, from and to clauses when filters are set', async () => {
    const builder = makeBuilder({ data: [], error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    await listExpenses({ category: 'food', from: '2026-07-01', to: '2026-07-31' })

    expect(builder.eq).toHaveBeenCalledWith('category', 'food')
    expect(builder.gte).toHaveBeenCalledWith('spent_at', '2026-07-01')
    expect(builder.lte).toHaveBeenCalledWith('spent_at', '2026-07-31')
  })

  it('returns an empty array when data is null', async () => {
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: null }) as never,
    )
    await expect(listExpenses(noFilters)).resolves.toEqual([])
  })

  it('throws with the Supabase error message on failure', async () => {
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'db down' } }) as never,
    )
    await expect(listExpenses(noFilters)).rejects.toThrow('db down')
  })
})

describe('createExpense', () => {
  const input = {
    amount: 10,
    category: 'food',
    note: null,
    spent_at: '2026-07-12',
  }

  it('throws when there is no signed-in user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    } as never)

    await expect(createExpense(input)).rejects.toThrow('You must be signed in.')
  })

  it('injects the current user id into the inserted row', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    } as never)
    const created = makeExpense({ user_id: 'user-42' })
    const builder = makeBuilder({ data: created, error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    const result = await createExpense(input)

    expect(builder.insert).toHaveBeenCalledWith({ ...input, user_id: 'user-42' })
    expect(result).toBe(created)
  })

  it('throws with the Supabase error message on insert failure', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    } as never)
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'insert failed' } }) as never,
    )

    await expect(createExpense(input)).rejects.toThrow('insert failed')
  })
})

describe('createExpenses', () => {
  const inputs = [
    { amount: 10, category: 'food', note: null, spent_at: '2026-07-12' },
    { amount: 20, category: 'transport', note: 'Bus', spent_at: '2026-07-13' },
  ]

  it('throws when there is no signed-in user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    } as never)

    await expect(createExpenses(inputs)).rejects.toThrow(
      'You must be signed in.',
    )
  })

  it('stamps user_id on every row and inserts them as a single array', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    } as never)
    const created = [
      makeExpense({ user_id: 'user-42' }),
      makeExpense({ user_id: 'user-42' }),
    ]
    const builder = makeBuilder({ data: created, error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    const result = await createExpenses(inputs)

    expect(builder.insert).toHaveBeenCalledWith([
      { ...inputs[0], user_id: 'user-42' },
      { ...inputs[1], user_id: 'user-42' },
    ])
    expect(result).toBe(created)
  })

  it('returns an empty array when data is null', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    } as never)
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: null }) as never,
    )
    await expect(createExpenses(inputs)).resolves.toEqual([])
  })

  it('throws with the Supabase error message on insert failure', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    } as never)
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'insert failed' } }) as never,
    )

    await expect(createExpenses(inputs)).rejects.toThrow('insert failed')
  })
})

describe('updateExpense', () => {
  it('targets the row by id and returns the updated row', async () => {
    const updated = makeExpense({ id: 'exp-9', amount: 99 })
    const builder = makeBuilder({ data: updated, error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    const result = await updateExpense('exp-9', {
      amount: 99,
      category: 'food',
      note: null,
      spent_at: '2026-07-12',
    })

    expect(builder.eq).toHaveBeenCalledWith('id', 'exp-9')
    expect(result).toBe(updated)
  })
})

describe('deleteExpense', () => {
  it('deletes the row by id', async () => {
    const builder = makeBuilder({ data: null, error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    await deleteExpense('exp-3')

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'exp-3')
  })

  it('throws with the Supabase error message on failure', async () => {
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'nope' } }) as never,
    )
    await expect(deleteExpense('exp-3')).rejects.toThrow('nope')
  })
})
