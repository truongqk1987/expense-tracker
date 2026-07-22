const currencyFmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

export function formatCurrency(amount: number): string {
  return currencyFmt.format(amount)
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** Format an ISO date string (YYYY-MM-DD) for display, timezone-safe. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return dateFmt.format(new Date(y, m - 1, d))
}

/** Today's date as YYYY-MM-DD in the local timezone (for form defaults). */
export function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** First day of the current month as YYYY-MM-DD. */
export function startOfMonthISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

// --- ISO month-math helpers -------------------------------------------------
// Timezone-safe convention shared across the codebase: never hand an ISO date
// string straight to `new Date(iso)` (that parses as UTC midnight and can
// drift a day in negative-UTC zones); always split into numeric y/m/d first
// and construct a local `Date` from the parts.

/** Split a YYYY-MM-DD string into its numeric year/month/day parts. */
export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/** Build a YYYY-MM-DD string from possibly-overflowing y/m/d parts (lets
 * `Date` normalize e.g. day 32 or month 13). */
export function toISO(y: number, m: number, d: number): string {
  const dt = new Date(y, m - 1, d)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Add (or subtract, with a negative count) whole calendar days to an ISO date. */
export function addDaysISO(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso)
  return toISO(y, m, d + days)
}

/** Add (or subtract, with a negative count) whole calendar months to an ISO
 * date, preserving the day-of-month where possible (lets `Date` normalize
 * overflow when the target month is shorter). */
export function addMonthsISO(iso: string, months: number): string {
  const { y, m, d } = parseISO(iso)
  return toISO(y, m + months, d)
}

/** First day of the calendar month containing the given ISO date. */
export function startOfMonthOf(iso: string): string {
  const { y, m } = parseISO(iso)
  return toISO(y, m, 1)
}

/** Last day of the calendar month containing the given ISO date. */
export function endOfMonthOf(iso: string): string {
  const { y, m } = parseISO(iso)
  return toISO(y, m + 1, 0) // day 0 of next month = last day of this month
}
