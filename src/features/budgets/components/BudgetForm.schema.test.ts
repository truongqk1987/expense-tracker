import { describe, expect, it } from 'vitest'
import { CATEGORY_VALUES } from '../../../lib/categories'
import { budgetFormSchema, OVERALL_VALUE } from './BudgetForm.schema'

const valid = {
  amount: 500,
  category: 'food',
}

/** Return the first error message for a field, or undefined if it passed. */
function errorFor(input: unknown, path: string): string | undefined {
  const result = budgetFormSchema.safeParse(input)
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === path)?.message
}

describe('budgetFormSchema', () => {
  it('accepts a fully valid budget', () => {
    expect(budgetFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a zero amount', () => {
    expect(errorFor({ ...valid, amount: 0 }, 'amount')).toBe(
      'Must be greater than 0',
    )
  })

  it('rejects a negative amount', () => {
    expect(errorFor({ ...valid, amount: -5 }, 'amount')).toBe(
      'Must be greater than 0',
    )
  })

  it('rejects a missing/NaN amount with the "Enter an amount" message', () => {
    // react-hook-form's valueAsNumber yields NaN for an empty number field.
    expect(errorFor({ ...valid, amount: NaN }, 'amount')).toBe(
      'Enter an amount',
    )
  })

  it('accepts the overall sentinel value for category', () => {
    expect(
      budgetFormSchema.safeParse({ ...valid, category: OVERALL_VALUE }).success,
    ).toBe(true)
  })

  it.each(CATEGORY_VALUES)('accepts %s as a valid category', (value) => {
    expect(budgetFormSchema.safeParse({ ...valid, category: value }).success).toBe(
      true,
    )
  })

  it('rejects a category outside the known list and the sentinel', () => {
    expect(
      budgetFormSchema.safeParse({ ...valid, category: 'nonsense' }).success,
    ).toBe(false)
  })
})
