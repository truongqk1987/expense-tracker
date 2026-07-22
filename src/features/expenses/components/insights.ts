import { getCategory } from '../../../lib/categories'
import {
  addMonthsISO,
  endOfMonthOf,
  startOfMonthISO,
  todayISO,
} from '../../../lib/format'
import type { Expense } from '../types'
import { totalsInWindow } from './summarize'

export interface CategoryDelta {
  category: string
  label: string
  color: string
  thisMonth: number
  lastMonth: number
  deltaAbs: number
  /** `null` when there was no spend in this category last month at all —
   * render "new this month" rather than a divide-by-zero percentage. */
  deltaPct: number | null
}

export interface Insights {
  /** The category with the largest |deltaAbs|, or `null` when there's no
   * prior-month data to compare against at all. */
  topMover: CategoryDelta | null
  categoryDeltas: CategoryDelta[]
  biggest: Expense | null
  dailyAverage: { total: number; days: number; average: number }
  hasPriorMonth: boolean
}

/**
 * This month's window is always `[startOfMonth, today]`. The comparison
 * window is the *same-elapsed-days* slice of last month — e.g. on Jul 12,
 * compare Jul 1-12 against Jun 1-12, not the whole of June — clamped to the
 * last day of last month when today's day-of-month doesn't exist there (e.g.
 * Mar 31 -> Feb 28). ISO strings are zero-padded, so a plain string `<`
 * comparison is a valid chronological comparison for the clamp.
 */
function priorMonthWindow(): { from: string; to: string } {
  const today = todayISO()
  const lastMonthStart = addMonthsISO(startOfMonthISO(), -1)
  const lastMonthEnd = endOfMonthOf(lastMonthStart)
  const sameElapsedDay = addMonthsISO(today, -1)
  const to = sameElapsedDay < lastMonthEnd ? sameElapsedDay : lastMonthEnd
  return { from: lastMonthStart, to }
}

/**
 * Per-category month-over-month deltas: this month's `[startOfMonth, today]`
 * window vs. the same-elapsed-days slice of last month (see
 * `priorMonthWindow`), sorted by `|deltaAbs|` descending (biggest mover
 * first, in dollars — not by percentage, which would over-rank tiny
 * categories).
 */
export function categoryDeltas(expenses: Expense[]): CategoryDelta[] {
  const thisMonth = totalsInWindow(expenses, startOfMonthISO(), todayISO())
  const { from, to } = priorMonthWindow()
  const lastMonth = totalsInWindow(expenses, from, to)

  const categories = new Set([
    ...thisMonth.byCategory.keys(),
    ...lastMonth.byCategory.keys(),
  ])

  const deltas: CategoryDelta[] = []
  for (const category of categories) {
    const thisAmount = thisMonth.byCategory.get(category) ?? 0
    const lastAmount = lastMonth.byCategory.get(category) ?? 0
    const deltaAbs = thisAmount - lastAmount
    const deltaPct = lastAmount > 0 ? deltaAbs / lastAmount : null
    const { label, color } = getCategory(category)
    deltas.push({
      category,
      label,
      color,
      thisMonth: thisAmount,
      lastMonth: lastAmount,
      deltaAbs,
      deltaPct,
    })
  }

  return deltas.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs))
}

/**
 * The single largest expense within this month's `[startOfMonth, today]`
 * window, or `null` when there are none. Ties broken by first-seen order
 * (strict `>` never replaces an equal-amount incumbent).
 */
export function biggestExpense(expenses: Expense[]): Expense | null {
  const monthStart = startOfMonthISO()
  const today = todayISO()

  let biggest: Expense | null = null
  for (const e of expenses) {
    if (e.spent_at < monthStart || e.spent_at > today) continue
    if (!biggest || e.amount > biggest.amount) biggest = e
  }
  return biggest
}

/**
 * This month's total divided by elapsed calendar days — today's
 * day-of-month, which is always >= 1, so this never divides by zero (even on
 * the 1st, `days` is 1).
 */
export function dailyAverage(expenses: Expense[]): {
  total: number
  days: number
  average: number
} {
  const { total } = totalsInWindow(expenses, startOfMonthISO(), todayISO())
  const days = Number(todayISO().split('-')[2])
  return { total, days, average: days > 0 ? total / days : 0 }
}

/**
 * Roll everything up for the dashboard insights panel: the biggest
 * month-over-month category mover, the full per-category delta list, this
 * month's single largest expense, and the daily-average pace. `hasPriorMonth`
 * flags whether there's any spend at all in last month's comparison window,
 * so the UI can show "not enough history yet" instead of a misleading
 * top mover pulled from an all-zero comparison.
 */
export function computeInsights(expenses: Expense[]): Insights {
  const deltas = categoryDeltas(expenses)
  const hasPriorMonth = deltas.some((d) => d.lastMonth > 0)

  return {
    topMover: hasPriorMonth ? (deltas[0] ?? null) : null,
    categoryDeltas: deltas,
    biggest: biggestExpense(expenses),
    dailyAverage: dailyAverage(expenses),
    hasPriorMonth,
  }
}
