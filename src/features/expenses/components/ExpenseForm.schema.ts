import { z } from 'zod'
import { CATEGORY_VALUES } from '../../../lib/categories'

/** Validation rules for the expense form — shared with tests. */
export const expenseFormSchema = z.object({
  amount: z
    .number({ message: 'Enter an amount' })
    .positive('Must be greater than 0'),
  category: z.enum(CATEGORY_VALUES),
  spent_at: z.string().min(1, 'Pick a date'),
  note: z.string().max(200, 'Keep it under 200 characters').optional(),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>
