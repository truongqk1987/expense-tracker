import { z } from 'zod'
import { CATEGORY_VALUES } from '../../../lib/categories'

/** Sentinel select value representing the overall (all-spending) budget. */
export const OVERALL_VALUE = '__overall__' as const

/** Validation rules for the budget form — shared with tests. */
export const budgetFormSchema = z.object({
  amount: z
    .number({ message: 'Enter an amount' })
    .positive('Must be greater than 0'),
  category: z.enum([OVERALL_VALUE, ...CATEGORY_VALUES]),
})

export type BudgetFormValues = z.infer<typeof budgetFormSchema>
