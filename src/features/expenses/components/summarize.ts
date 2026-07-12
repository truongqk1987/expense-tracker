import { getCategory } from '../../../lib/categories'
import { startOfMonthISO, todayISO } from '../../../lib/format'
import type { Expense } from '../types'

export interface Summary {
  monthTotal: number
  filteredTotal: number
  count: number
  topCategory: { label: string; color: string; amount: number } | null
}

/**
 * Roll a list of expenses up into the dashboard summary: total spent this
 * calendar month, total across the currently-filtered rows, the row count, and
 * the single category with the highest summed spend.
 */
export function summarize(expenses: Expense[]): Summary {
  const monthStart = startOfMonthISO()
  const today = todayISO()

  let monthTotal = 0
  let filteredTotal = 0
  const byCategory = new Map<string, number>()

  for (const e of expenses) {
    filteredTotal += e.amount
    if (e.spent_at >= monthStart && e.spent_at <= today) monthTotal += e.amount
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
  }

  let topCategory: Summary['topCategory'] = null
  for (const [value, amount] of byCategory) {
    if (!topCategory || amount > topCategory.amount) {
      const c = getCategory(value)
      topCategory = { label: c.label, color: c.color, amount }
    }
  }

  return { monthTotal, filteredTotal, count: expenses.length, topCategory }
}
