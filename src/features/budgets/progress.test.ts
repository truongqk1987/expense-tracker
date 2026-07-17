import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeBudgetProgress } from './progress'
import { makeBudget, makeExpense } from '../../test/factories'

// Pin "now" to 12 Jul 2026 so the month window is [2026-07-01, 2026-07-12].
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 12, 9, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('computeBudgetProgress', () => {
  it('counts only the matching category toward a per-category budget', () => {
    const expenses = [
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-07-05' }),
      makeExpense({ category: 'bills', amount: 999, spent_at: '2026-07-06' }),
    ]
    const budgets = [makeBudget({ category: 'food', amount: 500 })]

    const [p] = computeBudgetProgress(expenses, budgets)
    expect(p.spent).toBe(100)
    expect(p.budget).toBe(500)
  })

  it('sums all this-month spend for the overall (null category) budget', () => {
    const expenses = [
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-07-05' }),
      makeExpense({ category: 'bills', amount: 50, spent_at: '2026-07-06' }),
    ]
    const budgets = [makeBudget({ category: null, amount: 1000 })]

    const [p] = computeBudgetProgress(expenses, budgets)
    expect(p.spent).toBe(150)
    expect(p.label).toBe('Overall')
  })

  it('flips the over flag when spent exceeds the budget', () => {
    const under = computeBudgetProgress(
      [makeExpense({ category: 'food', amount: 100, spent_at: '2026-07-05' })],
      [makeBudget({ category: 'food', amount: 500 })],
    )
    expect(under[0].over).toBe(false)

    const over = computeBudgetProgress(
      [makeExpense({ category: 'food', amount: 600, spent_at: '2026-07-05' })],
      [makeBudget({ category: 'food', amount: 500 })],
    )
    expect(over[0].over).toBe(true)
    expect(over[0].remaining).toBe(-100)
  })

  it('excludes expenses dated outside the current month', () => {
    const expenses = [
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-06-30' }), // last month
      makeExpense({ category: 'food', amount: 999, spent_at: '2026-07-20' }), // future
      makeExpense({ category: 'food', amount: 50, spent_at: '2026-07-12' }), // today
    ]
    const budgets = [makeBudget({ category: 'food', amount: 500 })]

    const [p] = computeBudgetProgress(expenses, budgets)
    expect(p.spent).toBe(50)
  })

  it('guards pct against a zero-amount budget instead of dividing by zero', () => {
    const [p] = computeBudgetProgress(
      [makeExpense({ category: 'food', amount: 50, spent_at: '2026-07-05' })],
      [makeBudget({ category: 'food', amount: 0 })],
    )
    expect(p.pct).toBe(0)
    expect(Number.isFinite(p.pct)).toBe(true)
  })

  it('returns an empty array when there are no budgets', () => {
    expect(computeBudgetProgress([makeExpense()], [])).toEqual([])
  })
})
