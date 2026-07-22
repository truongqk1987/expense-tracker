import { parseCsv, toCsv } from '../../lib/csv'
import { CATEGORY_VALUES } from '../../lib/categories'
import { expenseFormSchema } from './components/ExpenseForm.schema'
import type { Expense, ExpenseInput } from './types'

const HEADERS = ['date', 'category', 'amount', 'note']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Serialize expenses to CSV: `date,category,amount,note` — raw ISO date,
 *  raw category value (not the display label), raw number (never
 *  `formatCurrency`), RFC-4180 quoting via `lib/csv.ts`. */
export function expensesToCsv(expenses: Expense[]): string {
  const rows = expenses.map((expense) => [
    expense.spent_at,
    expense.category,
    String(expense.amount),
    expense.note ?? '',
  ])
  return toCsv(HEADERS, rows)
}

export interface ParseExpensesCsvError {
  line: number
  message: string
}

export interface ParseExpensesCsvResult {
  rows: ExpenseInput[]
  errors: ParseExpensesCsvError[]
}

const CATEGORY_SET = new Set<string>(CATEGORY_VALUES)

/** Parse an uploaded CSV into valid `ExpenseInput` rows plus a report of
 *  skipped rows. Header is matched case-insensitively; the date column may
 *  be named `date` or `spent_at`. Invalid rows are skipped, never reject
 *  the whole file. */
export function parseExpensesCsv(text: string): ParseExpensesCsvResult {
  const records = parseCsv(text)
  const rows: ExpenseInput[] = []
  const errors: ParseExpensesCsvError[] = []

  if (records.length === 0) return { rows, errors }

  const header = records[0].map((h) => h.trim().toLowerCase())
  const dateIdx = header.findIndex((h) => h === 'date' || h === 'spent_at')
  const categoryIdx = header.indexOf('category')
  const amountIdx = header.indexOf('amount')
  const noteIdx = header.indexOf('note')

  if (dateIdx === -1 || categoryIdx === -1 || amountIdx === -1) {
    errors.push({
      line: 1,
      message: 'Missing required column(s): date, category, amount',
    })
    return { rows, errors }
  }

  for (let i = 1; i < records.length; i++) {
    const record = records[i]
    const line = i + 1

    // Skip fully blank rows (e.g. a trailing newline artifact).
    if (record.length <= 1 && (record[0] ?? '').trim() === '') continue

    const rawDate = (record[dateIdx] ?? '').trim()
    const rawCategory = (record[categoryIdx] ?? '').trim()
    const rawAmount = (record[amountIdx] ?? '').trim()
    const rawNote = noteIdx === -1 ? '' : (record[noteIdx] ?? '').trim()

    if (!CATEGORY_SET.has(rawCategory)) {
      errors.push({ line, message: `Unknown category: "${rawCategory}"` })
      continue
    }
    if (!DATE_RE.test(rawDate)) {
      errors.push({ line, message: `Invalid date: "${rawDate}"` })
      continue
    }

    const candidate = {
      amount: rawAmount === '' ? NaN : Number(rawAmount),
      category: rawCategory,
      spent_at: rawDate,
      note: rawNote,
    }

    const parsed = expenseFormSchema.safeParse(candidate)
    if (!parsed.success) {
      errors.push({
        line,
        message: parsed.error.issues[0]?.message ?? 'Invalid row',
      })
      continue
    }

    rows.push({
      amount: parsed.data.amount,
      category: parsed.data.category,
      spent_at: rawDate,
      note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
    })
  }

  return { rows, errors }
}
