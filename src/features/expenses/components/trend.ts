import {
  addDaysISO,
  addMonthsISO,
  parseISO,
  startOfMonthOf,
  todayISO,
} from '../../../lib/format'
import type { ExpenseFilters } from '../../../stores/uiStore'
import type { Expense } from '../types'

export type Granularity = 'day' | 'week' | 'month'

export interface TrendBucket {
  /** ISO start-of-bucket, YYYY-MM-DD — stable identity / x-order. */
  key: string
  /** Short human label for the axis, e.g. 'Jul 3', 'Wk of Jul 1', 'Jul'. */
  label: string
  /** Summed expense amount that falls in this bucket. */
  total: number
}

// --- string-based ISO (YYYY-MM-DD) date helpers -----------------------------
// parseISO/addDaysISO/addMonthsISO/startOfMonthOf come from lib/format.ts (the
// single source of ISO month-math); only the trend-specific helpers below
// (week bucketing, span sizing, axis labels) live here.

/** Start of the ISO week (Monday) containing the given date. */
function startOfWeekISO(iso: string): string {
  const { y, m, d } = parseISO(iso)
  const dow = new Date(y, m - 1, d).getDay() // 0 = Sun ... 6 = Sat
  const daysSinceMonday = (dow + 6) % 7
  return addDaysISO(iso, -daysSinceMonday)
}

/** Whole calendar days between two ISO dates (b - a), for span sizing only. */
function daysBetweenISO(a: string, b: string): number {
  const pa = parseISO(a)
  const pb = parseISO(b)
  const da = Date.UTC(pa.y, pa.m - 1, pa.d)
  const db = Date.UTC(pb.y, pb.m - 1, pb.d)
  return Math.round((db - da) / 86_400_000)
}

const dayLabelFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})
const monthLabelFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })

function dayLabel(iso: string): string {
  const { y, m, d } = parseISO(iso)
  return dayLabelFmt.format(new Date(y, m - 1, d))
}

function monthLabel(iso: string): string {
  const { y, m } = parseISO(iso)
  return monthLabelFmt.format(new Date(y, m - 1, 1))
}

function bucketLabel(start: string, granularity: Granularity): string {
  if (granularity === 'day') return dayLabel(start)
  if (granularity === 'week') return `Wk of ${dayLabel(start)}`
  return monthLabel(start)
}

function periodKeyFor(granularity: Granularity): (iso: string) => string {
  if (granularity === 'day') return (iso) => iso
  if (granularity === 'week') return startOfWeekISO
  return startOfMonthOf
}

function bucketStarts(
  granularity: Granularity,
  from: string,
  to: string,
): string[] {
  const step =
    granularity === 'day'
      ? (s: string) => addDaysISO(s, 1)
      : granularity === 'week'
        ? (s: string) => addDaysISO(s, 7)
        : (s: string) => addMonthsISO(s, 1)

  let cur =
    granularity === 'day'
      ? from
      : granularity === 'week'
        ? startOfWeekISO(from)
        : startOfMonthOf(from)

  const starts: string[] = []
  while (cur <= to) {
    starts.push(cur)
    cur = step(cur)
  }
  return starts
}

/**
 * Bucket expense spend over time into a contiguous, zero-filled series
 * spanning `[from, to]` inclusive, oldest → newest. Rows whose `spent_at`
 * falls outside `[from, to]` are ignored (the container is expected to pass
 * the already-filtered rows). Pure, no React, no query.
 */
export function bucketSpendOverTime(
  expenses: Expense[],
  opts: { granularity: Granularity; from: string; to: string },
): TrendBucket[] {
  const { granularity, from, to } = opts
  if (!from || !to || from > to) return []

  const periodKey = periodKeyFor(granularity)
  const totals = new Map<string, number>()
  for (const e of expenses) {
    if (e.spent_at < from || e.spent_at > to) continue
    const key = periodKey(e.spent_at)
    totals.set(key, (totals.get(key) ?? 0) + e.amount)
  }

  return bucketStarts(granularity, from, to).map((start) => ({
    key: start,
    label: bucketLabel(start, granularity),
    total: totals.get(start) ?? 0,
  }))
}

const ROLLING_WINDOW_DAYS = 30
const DAY_GRANULARITY_MAX_SPAN = 31
const WEEK_GRANULARITY_MAX_SPAN = 26 * 7 // ~26 weeks

/**
 * Pick the adaptive trend window + granularity: the active `uiStore` date
 * filter when set (either bound), else a rolling last-30-days window ending
 * today; granularity is chosen from the resulting span. Pure and
 * unit-testable — the container just wires this to `bucketSpendOverTime`.
 */
export function resolveTrendWindow(
  filters: Pick<ExpenseFilters, 'from' | 'to'>,
): { granularity: Granularity; from: string; to: string } {
  const today = todayISO()
  const hasFilter = Boolean(filters.from || filters.to)

  const to = hasFilter ? filters.to || today : today
  const from = hasFilter
    ? filters.from || addDaysISO(to, -(ROLLING_WINDOW_DAYS - 1))
    : addDaysISO(today, -(ROLLING_WINDOW_DAYS - 1))

  const span = daysBetweenISO(from, to) + 1
  const granularity: Granularity =
    span <= DAY_GRANULARITY_MAX_SPAN
      ? 'day'
      : span <= WEEK_GRANULARITY_MAX_SPAN
        ? 'week'
        : 'month'

  return { granularity, from, to }
}
