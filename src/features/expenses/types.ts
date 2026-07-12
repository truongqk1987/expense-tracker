import type { Database } from '../../lib/database.types'

export type Expense = Database['public']['Tables']['expenses']['Row']

/** Fields the user supplies when creating/editing an expense. */
export interface ExpenseInput {
  amount: number
  category: string
  note: string | null
  spent_at: string
}
