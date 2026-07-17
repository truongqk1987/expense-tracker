import type { Database } from '../../lib/database.types'

export type Budget = Database['public']['Tables']['budgets']['Row']

/**
 * Fields the user supplies when creating/editing a budget.
 * `category: null` represents the overall (all-spending) budget.
 */
export interface BudgetInput {
  category: string | null
  amount: number
}
