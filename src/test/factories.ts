import type { Expense } from '../features/expenses/types'

let seq = 0

/**
 * Build an Expense row for tests. Every field has a sensible default; pass
 * `overrides` to set only what a given test cares about.
 */
export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  seq += 1
  return {
    id: `exp-${seq}`,
    user_id: 'user-1',
    amount: 10,
    category: 'food',
    note: null,
    spent_at: '2026-07-12',
    created_at: '2026-07-12T00:00:00.000Z',
    ...overrides,
  }
}
