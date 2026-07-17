import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import { createBudget, deleteBudget, listBudgets, updateBudget } from './api'
import { makeBudget } from '../../test/factories'

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
  for (const m of ['select', 'order', 'eq', 'insert', 'update', 'delete', 'single']) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = (resolve: (r: Result) => unknown) => resolve(result)
  return builder as unknown as Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listBudgets', () => {
  it('orders by created_at descending', async () => {
    const builder = makeBuilder({ data: [], error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    await listBudgets()

    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    })
  })

  it('returns an empty array when data is null', async () => {
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: null }) as never,
    )
    await expect(listBudgets()).resolves.toEqual([])
  })

  it('throws with the Supabase error message on failure', async () => {
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'db down' } }) as never,
    )
    await expect(listBudgets()).rejects.toThrow('db down')
  })
})

describe('createBudget', () => {
  const input = { category: 'food', amount: 500 }

  it('throws when there is no signed-in user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    } as never)

    await expect(createBudget(input)).rejects.toThrow(
      'You must be signed in.',
    )
  })

  it('stamps the current user id onto the inserted row', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    } as never)
    const created = makeBudget({ user_id: 'user-42' })
    const builder = makeBuilder({ data: created, error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    const result = await createBudget(input)

    expect(builder.insert).toHaveBeenCalledWith({
      ...input,
      user_id: 'user-42',
    })
    expect(result).toBe(created)
  })

  it('throws with the Supabase error message on insert failure', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    } as never)
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'insert failed' } }) as never,
    )

    await expect(createBudget(input)).rejects.toThrow('insert failed')
  })
})

describe('updateBudget', () => {
  it('targets the row by id and returns the updated row', async () => {
    const updated = makeBudget({ id: 'budget-9', amount: 999 })
    const builder = makeBuilder({ data: updated, error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    const result = await updateBudget('budget-9', {
      category: 'food',
      amount: 999,
    })

    expect(builder.eq).toHaveBeenCalledWith('id', 'budget-9')
    expect(result).toBe(updated)
  })

  it('throws with the Supabase error message on failure', async () => {
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'update failed' } }) as never,
    )
    await expect(
      updateBudget('budget-9', { category: 'food', amount: 999 }),
    ).rejects.toThrow('update failed')
  })
})

describe('deleteBudget', () => {
  it('deletes the row by id', async () => {
    const builder = makeBuilder({ data: null, error: null })
    mockSupabase.from.mockReturnValue(builder as never)

    await deleteBudget('budget-3')

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'budget-3')
  })

  it('throws with the Supabase error message on failure', async () => {
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'nope' } }) as never,
    )
    await expect(deleteBudget('budget-3')).rejects.toThrow('nope')
  })
})
