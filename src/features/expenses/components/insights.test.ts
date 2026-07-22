import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  biggestExpense,
  categoryDeltas,
  computeInsights,
  dailyAverage,
} from './insights'
import { makeExpense } from '../../../test/factories'

// Pin "now" to 12 Jul 2026 so this month's window is [2026-07-01, 2026-07-12]
// and the same-elapsed-days baseline is [2026-06-01, 2026-06-12].
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 12, 9, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('categoryDeltas', () => {
  it('computes an upward month-over-month delta with the correct deltaPct', () => {
    const deltas = categoryDeltas([
      makeExpense({ category: 'food', amount: 130, spent_at: '2026-07-05' }),
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-06-05' }),
    ])
    const food = deltas.find((d) => d.category === 'food')
    expect(food?.thisMonth).toBe(130)
    expect(food?.lastMonth).toBe(100)
    expect(food?.deltaAbs).toBe(30)
    expect(food?.deltaPct).toBeCloseTo(0.3)
  })

  it('computes a downward month-over-month delta with the correct deltaPct', () => {
    const deltas = categoryDeltas([
      makeExpense({ category: 'bills', amount: 50, spent_at: '2026-07-03' }),
      makeExpense({ category: 'bills', amount: 100, spent_at: '2026-06-03' }),
    ])
    const bills = deltas.find((d) => d.category === 'bills')
    expect(bills?.deltaAbs).toBe(-50)
    expect(bills?.deltaPct).toBeCloseTo(-0.5)
  })

  it('returns deltaPct: null (not a divide-by-zero) when lastMonth is 0 — "new this month"', () => {
    const deltas = categoryDeltas([
      makeExpense({
        category: 'entertainment',
        amount: 40,
        spent_at: '2026-07-04',
      }),
    ])
    const entertainment = deltas.find((d) => d.category === 'entertainment')
    expect(entertainment?.lastMonth).toBe(0)
    expect(entertainment?.thisMonth).toBe(40)
    expect(entertainment?.deltaPct).toBeNull()
  })

  it('reports -100% when thisMonth is 0 but lastMonth was > 0', () => {
    const deltas = categoryDeltas([
      makeExpense({ category: 'health', amount: 20, spent_at: '2026-06-06' }),
    ])
    const health = deltas.find((d) => d.category === 'health')
    expect(health?.thisMonth).toBe(0)
    expect(health?.lastMonth).toBe(20)
    expect(health?.deltaAbs).toBe(-20)
    expect(health?.deltaPct).toBeCloseTo(-1)
  })

  it('sorts descending by |deltaAbs| in dollars, not by percentage', () => {
    const deltas = categoryDeltas([
      // bills: |deltaAbs| = 50
      makeExpense({ category: 'bills', amount: 50, spent_at: '2026-07-03' }),
      makeExpense({ category: 'bills', amount: 100, spent_at: '2026-06-03' }),
      // entertainment: new this month, |deltaAbs| = 40
      makeExpense({
        category: 'entertainment',
        amount: 40,
        spent_at: '2026-07-04',
      }),
      // food: |deltaAbs| = 30
      makeExpense({ category: 'food', amount: 130, spent_at: '2026-07-05' }),
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-06-05' }),
      // health: |deltaAbs| = 20
      makeExpense({ category: 'health', amount: 20, spent_at: '2026-06-06' }),
    ])
    expect(deltas.map((d) => d.category)).toEqual([
      'bills',
      'entertainment',
      'food',
      'health',
    ])
  })

  it('excludes a same-numbered-day-but-later row from the baseline (Jun 20 when today is Jul 12)', () => {
    const deltas = categoryDeltas([
      // Within the Jun 1-12 baseline slice.
      makeExpense({
        category: 'transport',
        amount: 10,
        spent_at: '2026-06-05',
      }),
      // Outside the same-elapsed-days slice (Jun 20 > Jun 12) — must not count.
      makeExpense({
        category: 'transport',
        amount: 999,
        spent_at: '2026-06-20',
      }),
    ])
    const transport = deltas.find((d) => d.category === 'transport')
    expect(transport?.lastMonth).toBe(10)
  })

  it('compares against December of the previous year across a Jan boundary', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0)) // 15 Jan 2026
    const deltas = categoryDeltas([
      makeExpense({ category: 'food', amount: 50, spent_at: '2026-01-10' }),
      makeExpense({ category: 'food', amount: 20, spent_at: '2025-12-10' }), // in the Dec 1-15 slice
      makeExpense({ category: 'food', amount: 999, spent_at: '2025-12-20' }), // outside the slice
    ])
    const food = deltas.find((d) => d.category === 'food')
    expect(food?.thisMonth).toBe(50)
    expect(food?.lastMonth).toBe(20)
    expect(food?.deltaPct).toBeCloseTo(1.5)
  })

  it('clamps the baseline to the last day of last month when today has no equivalent day (Mar 31 -> Feb 28)', () => {
    vi.setSystemTime(new Date(2026, 2, 31, 9, 0)) // 31 Mar 2026 (2026 is not a leap year)
    const deltas = categoryDeltas([
      makeExpense({ category: 'shopping', amount: 30, spent_at: '2026-03-31' }),
      makeExpense({ category: 'shopping', amount: 15, spent_at: '2026-02-28' }), // last day of Feb — included
      // Would land in the (buggy, unclamped) baseline window if the clamp
      // were missing, since a naive "same day last month" overflows to
      // 2026-03-03 for a Feb-less day 31 — must be excluded from lastMonth.
      makeExpense({ category: 'health', amount: 999, spent_at: '2026-03-02' }),
    ])
    const shopping = deltas.find((d) => d.category === 'shopping')
    expect(shopping?.lastMonth).toBe(15)
    expect(shopping?.deltaAbs).toBe(15)

    const health = deltas.find((d) => d.category === 'health')
    expect(health?.thisMonth).toBe(999)
    expect(health?.lastMonth).toBe(0)
  })
})

describe('biggestExpense', () => {
  it('returns the single largest expense within this month', () => {
    const biggest = biggestExpense([
      makeExpense({ amount: 10, spent_at: '2026-07-01' }),
      makeExpense({ amount: 50, spent_at: '2026-07-05' }),
      makeExpense({ amount: 30, spent_at: '2026-07-08' }),
    ])
    expect(biggest?.amount).toBe(50)
  })

  it('ignores rows outside [startOfMonth, today]', () => {
    const biggest = biggestExpense([
      makeExpense({ amount: 50, spent_at: '2026-07-05' }),
      makeExpense({ amount: 999, spent_at: '2026-06-30' }), // last month
      makeExpense({ amount: 999, spent_at: '2026-07-20' }), // future
    ])
    expect(biggest?.amount).toBe(50)
  })

  it('breaks ties deterministically, keeping the first-seen row', () => {
    const first = makeExpense({
      id: 'first',
      amount: 50,
      spent_at: '2026-07-01',
    })
    const second = makeExpense({
      id: 'second',
      amount: 50,
      spent_at: '2026-07-08',
    })
    const biggest = biggestExpense([first, second])
    expect(biggest?.id).toBe('first')
  })

  it('returns null for an empty list', () => {
    expect(biggestExpense([])).toBeNull()
  })
})

describe('dailyAverage', () => {
  it('divides this-month total by the day-of-month (12 on Jul 12)', () => {
    const result = dailyAverage([
      makeExpense({ amount: 60, spent_at: '2026-07-01' }),
      makeExpense({ amount: 60, spent_at: '2026-07-10' }),
    ])
    expect(result.total).toBe(120)
    expect(result.days).toBe(12)
    expect(result.average).toBe(10)
  })

  it('divides by 1 on the 1st of the month (single-day window)', () => {
    vi.setSystemTime(new Date(2026, 7, 1, 9, 0)) // 1 Aug 2026
    const result = dailyAverage([
      makeExpense({ amount: 50, spent_at: '2026-08-01' }),
    ])
    expect(result.days).toBe(1)
    expect(result.average).toBe(50)
  })

  it('never divides by zero — 0 total and 0 average for an empty list', () => {
    const result = dailyAverage([])
    expect(result.total).toBe(0)
    expect(result.days).toBe(12)
    expect(result.average).toBe(0)
    expect(Number.isFinite(result.average)).toBe(true)
  })
})

describe('computeInsights', () => {
  it('returns the full shape for an empty list, with hasPriorMonth false and topMover null', () => {
    const insights = computeInsights([])
    expect(insights).toEqual({
      topMover: null,
      categoryDeltas: [],
      biggest: null,
      dailyAverage: { total: 0, days: 12, average: 0 },
      hasPriorMonth: false,
    })
  })

  it('sets hasPriorMonth: false and topMover: null when there is this-month data but no prior month at all', () => {
    const insights = computeInsights([
      makeExpense({ category: 'food', amount: 40, spent_at: '2026-07-05' }),
    ])
    expect(insights.hasPriorMonth).toBe(false)
    expect(insights.topMover).toBeNull()
    expect(insights.biggest?.amount).toBe(40)
  })

  it('sets hasPriorMonth: true and topMover to the biggest |deltaAbs| mover when prior data exists', () => {
    const expenses = [
      makeExpense({ category: 'bills', amount: 50, spent_at: '2026-07-03' }),
      makeExpense({ category: 'bills', amount: 100, spent_at: '2026-06-03' }),
      makeExpense({ category: 'food', amount: 130, spent_at: '2026-07-05' }),
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-06-05' }),
    ]
    const insights = computeInsights(expenses)
    expect(insights.hasPriorMonth).toBe(true)
    expect(insights.topMover?.category).toBe('bills')
    expect(insights.topMover).toEqual(insights.categoryDeltas[0])
  })
})
