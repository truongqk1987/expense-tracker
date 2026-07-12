import { describe, expect, it } from 'vitest'
import { expenseFormSchema } from './ExpenseForm.schema'

const valid = {
  amount: 12.5,
  category: 'food',
  spent_at: '2026-07-12',
  note: 'Lunch',
}

/** Return the first error message for a field, or undefined if it passed. */
function errorFor(input: unknown, path: string): string | undefined {
  const result = expenseFormSchema.safeParse(input)
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === path)?.message
}

describe('expenseFormSchema', () => {
  it('accepts a fully valid expense', () => {
    expect(expenseFormSchema.safeParse(valid).success).toBe(true)
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
    expect(errorFor({ ...valid, amount: NaN }, 'amount')).toBe('Enter an amount')
  })

  it('rejects a category outside the known list', () => {
    expect(expenseFormSchema.safeParse({ ...valid, category: 'nonsense' }).success).toBe(
      false,
    )
  })

  it('rejects an empty date', () => {
    expect(errorFor({ ...valid, spent_at: '' }, 'spent_at')).toBe('Pick a date')
  })

  it('rejects a note longer than 200 characters', () => {
    expect(errorFor({ ...valid, note: 'x'.repeat(201) }, 'note')).toBe(
      'Keep it under 200 characters',
    )
  })

  it('allows the note to be omitted', () => {
    const { note, ...withoutNote } = valid
    void note
    expect(expenseFormSchema.safeParse(withoutNote).success).toBe(true)
  })
})
