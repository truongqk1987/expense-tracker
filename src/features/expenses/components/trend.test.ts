import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bucketSpendOverTime,
  resolveTrendWindow,
  type Granularity,
} from './trend'
import { makeExpense } from '../../../test/factories'

// Pin "now" to 12 Jul 2026 (a Sunday) for resolveTrendWindow's default window.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 12, 9, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('bucketSpendOverTime', () => {
  it('returns [] when from/to are missing or inverted', () => {
    expect(
      bucketSpendOverTime([], { granularity: 'day', from: '', to: '' }),
    ).toEqual([])
    expect(
      bucketSpendOverTime([], {
        granularity: 'day',
        from: '2026-07-10',
        to: '2026-07-01',
      }),
    ).toEqual([])
  })

  it('day: emits a contiguous, zero-filled, oldest-to-newest series', () => {
    const buckets = bucketSpendOverTime(
      [
        makeExpense({ amount: 10, spent_at: '2026-07-01' }),
        makeExpense({ amount: 5, spent_at: '2026-07-03' }),
      ],
      { granularity: 'day', from: '2026-07-01', to: '2026-07-03' },
    )
    expect(buckets.map((b) => b.key)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ])
    expect(buckets.map((b) => b.total)).toEqual([10, 0, 5])
    expect(buckets[0].label).toBe('Jul 1')
  })

  it('day: sums multiple expenses landing on the same day', () => {
    const buckets = bucketSpendOverTime(
      [
        makeExpense({ amount: 10, spent_at: '2026-07-01' }),
        makeExpense({ amount: 5, spent_at: '2026-07-01' }),
      ],
      { granularity: 'day', from: '2026-07-01', to: '2026-07-01' },
    )
    expect(buckets).toEqual([
      { key: '2026-07-01', label: 'Jul 1', total: 15 },
    ])
  })

  it('week: buckets start on Monday and label "Wk of ..."', () => {
    // 2026-07-01 is a Wednesday; the week start is Mon 2026-06-29.
    const buckets = bucketSpendOverTime(
      [makeExpense({ amount: 10, spent_at: '2026-07-01' })],
      { granularity: 'week', from: '2026-07-01', to: '2026-07-08' },
    )
    expect(buckets[0].key).toBe('2026-06-29')
    expect(buckets[0].label).toBe('Wk of Jun 29')
    expect(buckets[0].total).toBe(10)
  })

  it('week: a spent_at on the boundary (Sunday) lands in the prior week bucket', () => {
    // Week 1: Mon 2026-06-29 .. Sun 2026-07-05. Week 2: Mon 2026-07-06 .. Sun 2026-07-12.
    const buckets = bucketSpendOverTime(
      [makeExpense({ amount: 20, spent_at: '2026-07-05' })], // Sunday, end of week 1
      { granularity: 'week', from: '2026-06-29', to: '2026-07-12' },
    )
    expect(buckets).toHaveLength(2)
    expect(buckets[0].key).toBe('2026-06-29')
    expect(buckets[0].total).toBe(20)
    expect(buckets[1].total).toBe(0)
  })

  it('month: buckets start on the 1st and label the short month name', () => {
    const buckets = bucketSpendOverTime(
      [
        makeExpense({ amount: 100, spent_at: '2026-06-15' }),
        makeExpense({ amount: 50, spent_at: '2026-07-02' }),
      ],
      { granularity: 'month', from: '2026-06-01', to: '2026-07-31' },
    )
    expect(buckets.map((b) => b.key)).toEqual(['2026-06-01', '2026-07-01'])
    expect(buckets.map((b) => b.label)).toEqual(['Jun', 'Jul'])
    expect(buckets.map((b) => b.total)).toEqual([100, 50])
  })

  it('month: stays contiguous and ordered across a Dec -> Jan year boundary', () => {
    const buckets = bucketSpendOverTime(
      [
        makeExpense({ amount: 40, spent_at: '2025-12-31' }),
        makeExpense({ amount: 60, spent_at: '2026-01-15' }),
      ],
      { granularity: 'month', from: '2025-11-01', to: '2026-01-31' },
    )
    expect(buckets.map((b) => b.key)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
    ])
    expect(buckets.map((b) => b.label)).toEqual(['Nov', 'Dec', 'Jan'])
    expect(buckets.map((b) => b.total)).toEqual([0, 40, 60])
  })

  it('a single-day window (from === to) yields exactly one bucket, at every granularity', () => {
    const day = bucketSpendOverTime(
      [makeExpense({ amount: 7, spent_at: '2026-07-01' })],
      { granularity: 'day', from: '2026-07-01', to: '2026-07-01' },
    )
    expect(day).toHaveLength(1)
    expect(day[0]).toEqual({ key: '2026-07-01', label: 'Jul 1', total: 7 })

    const week = bucketSpendOverTime(
      [makeExpense({ amount: 7, spent_at: '2026-07-01' })],
      { granularity: 'week', from: '2026-07-01', to: '2026-07-01' },
    )
    expect(week).toHaveLength(1)
    expect(week[0].total).toBe(7)

    const month = bucketSpendOverTime(
      [makeExpense({ amount: 7, spent_at: '2026-07-01' })],
      { granularity: 'month', from: '2026-07-01', to: '2026-07-01' },
    )
    expect(month).toHaveLength(1)
    expect(month[0].total).toBe(7)
  })

  it('includes expenses exactly on the `from` and `to` boundaries', () => {
    const buckets = bucketSpendOverTime(
      [
        makeExpense({ amount: 1, spent_at: '2026-07-01' }), // exactly `from`
        makeExpense({ amount: 2, spent_at: '2026-07-05' }), // exactly `to`
      ],
      { granularity: 'day', from: '2026-07-01', to: '2026-07-05' },
    )
    expect(buckets[0].total).toBe(1)
    expect(buckets[buckets.length - 1].total).toBe(2)
    expect(buckets.reduce((sum, b) => sum + b.total, 0)).toBe(3)
  })

  it('ignores expenses outside [from, to]', () => {
    const buckets = bucketSpendOverTime(
      [
        makeExpense({ amount: 999, spent_at: '2026-06-30' }),
        makeExpense({ amount: 999, spent_at: '2026-07-04' }),
        makeExpense({ amount: 10, spent_at: '2026-07-02' }),
      ],
      { granularity: 'day', from: '2026-07-01', to: '2026-07-03' },
    )
    expect(buckets.reduce((sum, b) => sum + b.total, 0)).toBe(10)
  })

  it('returns a zero-filled series over the window for empty input', () => {
    const buckets = bucketSpendOverTime([], {
      granularity: 'day',
      from: '2026-07-01',
      to: '2026-07-03',
    })
    expect(buckets).toHaveLength(3)
    expect(buckets.every((b) => b.total === 0)).toBe(true)
  })
})

describe('resolveTrendWindow', () => {
  it('defaults to a rolling last-30-days window ending today when no filter is set', () => {
    const w = resolveTrendWindow({ from: '', to: '' })
    expect(w.to).toBe('2026-07-12')
    expect(w.from).toBe('2026-06-13')
    expect(w.granularity).toBe('day')
  })

  it('uses the active date filter when both bounds are set', () => {
    const w = resolveTrendWindow({ from: '2026-01-01', to: '2026-07-12' })
    expect(w.from).toBe('2026-01-01')
    expect(w.to).toBe('2026-07-12')
  })

  it('fills in today as `to` when only `from` is set', () => {
    const w = resolveTrendWindow({ from: '2026-07-01', to: '' })
    expect(w.from).toBe('2026-07-01')
    expect(w.to).toBe('2026-07-12')
  })

  it('fills in a 30-day lookback as `from` when only `to` is set', () => {
    const w = resolveTrendWindow({ from: '', to: '2026-07-05' })
    expect(w.to).toBe('2026-07-05')
    expect(w.from).toBe('2026-06-06')
  })

  it.each<[number, Granularity]>([
    [10, 'day'],
    [31, 'day'],
    [32, 'week'],
    [182, 'week'],
    [183, 'month'],
  ])('picks %i-day span -> %s granularity', (days, expected) => {
    const to = '2026-12-31'
    const from = new Date(2026, 11, 31 - (days - 1))
    const fromISO = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
    const w = resolveTrendWindow({ from: fromISO, to })
    expect(w.granularity).toBe(expected)
  })
})
