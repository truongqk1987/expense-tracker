import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatCurrency,
  formatDate,
  startOfMonthISO,
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
