import { getCategory } from '../../lib/categories'
import { monthTotalsByCategory } from '../expenses/components/summarize'
import type { Expense } from '../expenses/types'
import type { Budget } from './types'

export interface BudgetProgress {
  budget: number
  spent: number
  remaining: number
  pct: number
  over: boolean
  label: string
  color: string
  category: string | null
}

/**
 * Derive spent-vs-budget progress for each budget row, using the current
 * calendar-month roll-up from `summarize.ts` as the single source of the
 * "this month" window (no duplicated date-window logic). The result array is
 * in the same order as `budgets`, so callers can zip by index for id/actions.
 */
export function computeBudgetProgress(
  expenses: Expense[],
  budgets: Budget[],
): BudgetProgress[] {
  const { total, byCategory } = monthTotalsByCategory(expenses)

  return budgets.map(({ category, amount }) => {
    const spent = category === null ? total : (byCategory.get(category) ?? 0)
    const { label, color } =
      category === null
        ? { label: 'Overall', color: 'var(--color-brand)' }
        : getCategory(category)

    return {
      budget: amount,
      spent,
      remaining: amount - spent,
      pct: amount > 0 ? spent / amount : 0,
      over: spent > amount,
      label,
      color,
      category,
    }
  })
}
