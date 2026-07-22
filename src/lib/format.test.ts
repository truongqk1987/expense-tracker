import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDaysISO,
  addMonthsISO,
  endOfMonthOf,
  formatCurrency,
  formatDate,
  startOfMonthISO,
  startOfMonthOf,
  todayISO,
} from './format'

describe('formatCurrency', () => {
  it('formats zero with two decimals', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('adds a thousands separator and pads to two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('rounds to cents', () => {
    expect(formatCurrency(9.999)).toBe('$10.00')
  })
})

describe('formatDate', () => {
  it('renders an ISO date in the local calendar (timezone-safe)', () => {
    // A naive `new Date('2026-07-12')` parses as UTC midnight and can render as
    // Jul 11 in negative-UTC zones. formatDate builds a local Date to avoid that.
    expect(formatDate('2026-07-12')).toBe('Jul 12, 2026')
  })

  it('renders the first of the month without off-by-one drift', () => {
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
  })

  it('returns the raw string when the input is empty', () => {
    expect(formatDate('')).toBe('')
  })

  it('returns the raw string when the input is malformed', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

describe('todayISO / startOfMonthISO', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 5 Jan 2026 — single-digit month and day to exercise zero-padding.
    vi.setSystemTime(new Date(2026, 0, 5, 13, 30))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('todayISO returns a zero-padded YYYY-MM-DD', () => {
    expect(todayISO()).toBe('2026-01-05')
  })

  it('startOfMonthISO returns the first day of the current month', () => {
    expect(startOfMonthISO()).toBe('2026-01-01')
  })
})

describe('addDaysISO', () => {
  it('adds whole days, rolling over a month boundary', () => {
    expect(addDaysISO('2026-01-30', 3)).toBe('2026-02-02')
  })

  it('subtracts whole days with a negative count, rolling back a year boundary', () => {
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('addMonthsISO', () => {
  it('adds whole months, preserving the day-of-month', () => {
    expect(addMonthsISO('2026-06-12', 1)).toBe('2026-07-12')
  })

  it('subtracts whole months across a year boundary', () => {
    expect(addMonthsISO('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('lets Date normalize overflow when the target month is shorter (Jan 31 - 1 month)', () => {
    // Dec has 31 days, so this one doesn't overflow...
    expect(addMonthsISO('2026-01-31', -1)).toBe('2025-12-31')
    // ...but Feb (28 days in 2026) does: day 31 rolls into March.
    expect(addMonthsISO('2026-03-31', -1)).toBe('2026-03-03')
  })
})

describe('startOfMonthOf', () => {
  it('returns the first day of the month containing the given date', () => {
    expect(startOfMonthOf('2026-07-12')).toBe('2026-07-01')
  })
})

describe('endOfMonthOf', () => {
  it('returns the last day of a 31-day month', () => {
    expect(endOfMonthOf('2026-07-12')).toBe('2026-07-31')
  })

  it('returns the last day of February in a non-leap year', () => {
    expect(endOfMonthOf('2026-02-01')).toBe('2026-02-28')
  })

  it('returns the last day of February in a leap year', () => {
    expect(endOfMonthOf('2028-02-15')).toBe('2028-02-29')
  })
})
