import { describe, expect, it } from 'vitest'
import { expensesToCsv, parseExpensesCsv } from './csv'
import { makeExpense } from '../../test/factories'

describe('expensesToCsv', () => {
  it('writes the exact header `date,category,amount,note`', () => {
    const csv = expensesToCsv([])
    expect(csv).toBe('date,category,amount,note\n')
  })

  it('writes columns in date,category,amount,note order', () => {
    const csv = expensesToCsv([
      makeExpense({
        spent_at: '2026-07-01',
        category: 'food',
        amount: 12.5,
        note: 'Lunch',
      }),
    ])
    expect(csv).toBe('date,category,amount,note\n2026-07-01,food,12.5,Lunch\n')
  })

  it('writes the raw number, never formatCurrency', () => {
    const csv = expensesToCsv([makeExpense({ amount: 1234.5 })])
    expect(csv).toContain(',1234.5,')
    expect(csv).not.toContain('$')
  })

  it('writes the raw category value, not the display label', () => {
    const csv = expensesToCsv([makeExpense({ category: 'entertainment' })])
    expect(csv).toContain(',entertainment,')
    expect(csv).not.toContain('Entertainment')
  })

  it('writes an empty field for a null note', () => {
    const csv = expensesToCsv([makeExpense({ note: null })])
    expect(csv.trim().endsWith(',')).toBe(true)
  })
})

describe('parseExpensesCsv', () => {
  it('returns no rows and no errors for an empty file', () => {
    expect(parseExpensesCsv('')).toEqual({ rows: [], errors: [] })
  })

  it('parses valid rows into ExpenseInput', () => {
    const csv = 'date,category,amount,note\n2026-07-01,food,12.5,Lunch\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { amount: 12.5, category: 'food', spent_at: '2026-07-01', note: 'Lunch' },
    ])
  })

  it('treats an empty note as null', () => {
    const csv = 'date,category,amount,note\n2026-07-01,food,12.5,\n'
    const { rows } = parseExpensesCsv(csv)
    expect(rows[0].note).toBeNull()
  })

  it('accepts the `spent_at` header alias for the date column', () => {
    const csv = 'spent_at,category,amount,note\n2026-07-01,food,12.5,\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0].spent_at).toBe('2026-07-01')
  })

  it('matches the header case-insensitively', () => {
    const csv = 'Date,Category,Amount,Note\n2026-07-01,food,12.5,Lunch\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
  })

  it('skips a row with an unknown category and reports it', () => {
    const csv = 'date,category,amount,note\n2026-07-01,vacation,12.5,\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(rows).toEqual([])
    expect(errors).toEqual([
      { line: 2, message: expect.stringContaining('Unknown category') },
    ])
  })

  it('skips a row with a bad amount and reports it', () => {
    const csv = 'date,category,amount,note\n2026-07-01,food,notanumber,\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe(2)
  })

  it('skips a row with a negative or zero amount and reports it', () => {
    const csv = 'date,category,amount,note\n2026-07-01,food,0,\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('skips a row with a bad date and reports it', () => {
    const csv = 'date,category,amount,note\n07/01/2026,food,12.5,\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(rows).toEqual([])
    expect(errors).toEqual([
      { line: 2, message: expect.stringContaining('Invalid date') },
    ])
  })

  it('skips a row whose note exceeds 200 characters and reports it', () => {
    const longNote = 'x'.repeat(201)
    const csv = `date,category,amount,note\n2026-07-01,food,12.5,${longNote}\n`
    const { rows, errors } = parseExpensesCsv(csv)
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('reports skipped rows alongside valid ones, keeping the line numbers', () => {
    const csv =
      'date,category,amount,note\n' +
      '2026-07-01,food,12.5,Lunch\n' +
      '2026-07-02,vacation,5,\n' +
      '2026-07-03,transport,3,Bus\n'
    const { rows, errors } = parseExpensesCsv(csv)
    expect(rows).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe(3)
  })
})
