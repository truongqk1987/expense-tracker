import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { summarize } from './summarize'
import { makeExpense } from '../../../test/factories'

// Pin "now" to 12 Jul 2026 so the month window is [2026-07-01, 2026-07-12].
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 12, 9, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('summarize', () => {
  it('returns zeros and no top category for an empty list', () => {
    const s = summarize([])
    expect(s).toEqual({
      monthTotal: 0,
      filteredTotal: 0,
      count: 0,
      topCategory: null,
    })
  })

  it('sums every row into filteredTotal and counts them', () => {
    const s = summarize([
      makeExpense({ amount: 10 }),
      makeExpense({ amount: 5.5 }),
      makeExpense({ amount: 4.5 }),
    ])
    expect(s.filteredTotal).toBe(20)
    expect(s.count).toBe(3)
  })

  it('counts only rows within [startOfMonth, today] toward monthTotal', () => {
    const s = summarize([
      makeExpense({ amount: 100, spent_at: '2026-07-05' }), // this month → in
      makeExpense({ amount: 40, spent_at: '2026-07-12' }), // today (boundary) → in
      makeExpense({ amount: 999, spent_at: '2026-06-30' }), // last month → out
      makeExpense({ amount: 999, spent_at: '2026-07-20' }), // future → out
    ])
    expect(s.monthTotal).toBe(140)
    // filteredTotal still includes the out-of-window rows.
    expect(s.filteredTotal).toBe(2138)
  })

  it('picks the top category by summed amount, not by largest single row', () => {
    const s = summarize([
      makeExpense({ category: 'food', amount: 10 }),
      makeExpense({ category: 'food', amount: 10 }),
      makeExpense({ category: 'food', amount: 10 }), // food total = 30
      makeExpense({ category: 'bills', amount: 25 }), // bills total = 25
    ])
    expect(s.topCategory?.label).toBe('Food & Drink')
    expect(s.topCategory?.amount).toBe(30)
  })

  it('reports the single category as top when only one is present', () => {
    const s = summarize([makeExpense({ category: 'transport', amount: 12 })])
    expect(s.topCategory?.label).toBe('Transport')
    expect(s.topCategory?.amount).toBe(12)
  })
})
