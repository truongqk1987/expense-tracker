import { getCategory } from '../../../lib/categories'
import { startOfMonthISO, todayISO } from '../../../lib/format'
import type { Expense } from '../types'

export interface Summary {
  monthTotal: number
  filteredTotal: number
  count: number
  topCategory: { label: string; color: string; amount: number } | null
}

export interface MonthTotals {
  total: number
  byCategory: Map<string, number>
}

export interface CategorySlice {
  category: string
  label: string
  color: string
  amount: number
  pct: number
}

/**
 * Plain sum-by-category over whatever rows are passed in — no date window.
 * The single grouping implementation reused by `summarize()`'s top-category
 * logic and by `categoryBreakdown()` below.
 */
export function sumByCategory(expenses: Expense[]): Map<string, number> {
  const byCategory = new Map<string, number>()
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
  }
  return byCategory
}

/**
 * Roll expenses up into the current calendar-month window: the total spend
 * this month, and a per-category breakdown of that same window. This is the
 * single source of the "this month" roll-up — reused by `summarize()` and by
 * `features/budgets/progress.ts` so the two never drift apart.
 */
export function monthTotalsByCategory(expenses: Expense[]): MonthTotals {
  const monthStart = startOfMonthISO()
  const today = todayISO()

  const inWindow = expenses.filter(
    (e) => e.spent_at >= monthStart && e.spent_at <= today,
  )
  const byCategory = sumByCategory(inWindow)
  let total = 0
  for (const amount of byCategory.values()) total += amount

  return { total, byCategory }
}

/**
 * Roll a list of expenses up into the dashboard summary: total spent this
 * calendar month, total across the currently-filtered rows, the row count, and
 * the single category with the highest summed spend.
 */
export function summarize(expenses: Expense[]): Summary {
  const { total: monthTotal } = monthTotalsByCategory(expenses)

  let filteredTotal = 0
  for (const e of expenses) filteredTotal += e.amount

  const byCategory = sumByCategory(expenses)

  let topCategory: Summary['topCategory'] = null
  for (const [value, amount] of byCategory) {
    if (!topCategory || amount > topCategory.amount) {
      const c = getCategory(value)
      topCategory = { label: c.label, color: c.color, amount }
    }
  }

  return { monthTotal, filteredTotal, count: expenses.length, topCategory }
}

/**
 * Category breakdown of the given (already-filtered) rows, for the donut
 * chart + legend: each category's summed amount and share of the total,
 * sorted descending by amount. `[]` for an empty input drives the empty
 * state. Labels/colors come from `getCategory` (Null-Object fallback for
 * unknown categories) — never hard-coded.
 */
export function categoryBreakdown(expenses: Expense[]): CategorySlice[] {
  const byCategory = sumByCategory(expenses)

  let total = 0
  for (const amount of byCategory.values()) total += amount

  const slices: CategorySlice[] = []
  for (const [category, amount] of byCategory) {
    const { label, color } = getCategory(category)
    slices.push({
      category,
      label,
      color,
      amount,
      pct: total > 0 ? amount / total : 0,
    })
  }

  return slices.sort((a, b) => b.amount - a.amount)
}
