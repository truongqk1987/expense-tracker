import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  categoryBreakdown,
  monthTotalsByCategory,
  sumByCategory,
  summarize,
} from './summarize'
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

describe('monthTotalsByCategory', () => {
  it('returns a zero total and an empty map for an empty list', () => {
    const m = monthTotalsByCategory([])
    expect(m.total).toBe(0)
    expect(m.byCategory.size).toBe(0)
  })

  it('sums each category separately within the current-month window', () => {
    const m = monthTotalsByCategory([
      makeExpense({ category: 'food', amount: 30, spent_at: '2026-07-05' }),
      makeExpense({ category: 'food', amount: 20, spent_at: '2026-07-06' }),
      makeExpense({ category: 'bills', amount: 15, spent_at: '2026-07-07' }),
    ])
    expect(m.byCategory.get('food')).toBe(50)
    expect(m.byCategory.get('bills')).toBe(15)
    expect(m.total).toBe(65)
  })

  it('excludes rows outside [startOfMonth, today] from both total and byCategory', () => {
    const m = monthTotalsByCategory([
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-07-05' }), // in
      makeExpense({ category: 'food', amount: 999, spent_at: '2026-06-30' }), // out (last month)
      makeExpense({ category: 'food', amount: 999, spent_at: '2026-07-20' }), // out (future)
    ])
    expect(m.total).toBe(100)
    expect(m.byCategory.get('food')).toBe(100)
  })

  it('is the source that summarize() uses for monthTotal (no regression)', () => {
    const expenses = [
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-07-05' }),
      makeExpense({ category: 'bills', amount: 999, spent_at: '2026-06-30' }),
    ]
    expect(summarize(expenses).monthTotal).toBe(
      monthTotalsByCategory(expenses).total,
    )
  })
})

describe('sumByCategory', () => {
  it('returns an empty map for an empty list', () => {
    expect(sumByCategory([]).size).toBe(0)
  })

  it('sums amounts per category with no date window (unlike monthTotalsByCategory)', () => {
    const m = sumByCategory([
      makeExpense({ category: 'food', amount: 10, spent_at: '2020-01-01' }),
      makeExpense({ category: 'food', amount: 5, spent_at: '2026-07-20' }), // future
      makeExpense({ category: 'bills', amount: 7 }),
    ])
    expect(m.get('food')).toBe(15)
    expect(m.get('bills')).toBe(7)
  })
})

describe('categoryBreakdown', () => {
  it('returns [] for an empty list', () => {
    expect(categoryBreakdown([])).toEqual([])
  })

  it('sums each category and sorts descending by amount', () => {
    const slices = categoryBreakdown([
      makeExpense({ category: 'food', amount: 10 }),
      makeExpense({ category: 'food', amount: 10 }), // food total = 20
      makeExpense({ category: 'bills', amount: 30 }), // bills total = 30
      makeExpense({ category: 'health', amount: 5 }),
    ])
    expect(slices.map((s) => s.category)).toEqual(['bills', 'food', 'health'])
    expect(slices[0].amount).toBe(30)
    expect(slices[1].amount).toBe(20)
  })

  it('pct values sum to ~1 across all slices', () => {
    const slices = categoryBreakdown([
      makeExpense({ category: 'food', amount: 30 }),
      makeExpense({ category: 'bills', amount: 70 }),
    ])
    const totalPct = slices.reduce((sum, s) => sum + s.pct, 0)
    expect(totalPct).toBeCloseTo(1)
    expect(slices.find((s) => s.category === 'food')?.pct).toBeCloseTo(0.3)
  })

  it('breaks amount ties deterministically, preserving first-seen category order', () => {
    // 'bills' and 'food' both total 20; 'bills' is seen first in the input so
    // a stable sort must keep it ahead of 'food' at the tie.
    const slices = categoryBreakdown([
      makeExpense({ category: 'bills', amount: 20 }),
      makeExpense({ category: 'food', amount: 20 }),
      makeExpense({ category: 'health', amount: 5 }),
    ])
    expect(slices.map((s) => s.category)).toEqual(['bills', 'food', 'health'])

    // Re-running with the tied categories introduced in the opposite order
    // still keeps whichever was seen first ahead — proving the ordering is a
    // stable function of input order, not incidental map iteration.
    const reordered = categoryBreakdown([
      makeExpense({ category: 'food', amount: 20 }),
      makeExpense({ category: 'bills', amount: 20 }),
      makeExpense({ category: 'health', amount: 5 }),
    ])
    expect(reordered.map((s) => s.category)).toEqual([
      'food',
      'bills',
      'health',
    ])
  })

  it('uses getCategory label/color, falling back to the "other" token for unknown categories', () => {
    const [known] = categoryBreakdown([
      makeExpense({ category: 'transport', amount: 10 }),
    ])
    expect(known.label).toBe('Transport')
    expect(known.color).toBe('var(--color-cat-transport)')

    const [unknown] = categoryBreakdown([
      makeExpense({ category: 'made-up', amount: 10 }),
    ])
    expect(unknown.label).toBe('made-up')
    expect(unknown.color).toBe('var(--color-cat-other)')
  })
})
