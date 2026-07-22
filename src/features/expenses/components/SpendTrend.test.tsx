import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { makeExpense } from '../../../test/factories'
import { useUIStore } from '../../../stores/uiStore'
import { SpendTrend } from './SpendTrend'
import * as api from '../api'

vi.mock('../api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

const mockApi = vi.mocked(api)

// Pin "now" to 12 Jul 2026 so the default (unfiltered) window is the rolling
// 30 days ending 2026-07-12.
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 6, 12, 9, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SpendTrend', () => {
  it('shows a spinner while the query is pending', () => {
    mockApi.listExpenses.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithProviders(<SpendTrend />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows an error with a Retry button that refetches', async () => {
    mockApi.listExpenses.mockRejectedValueOnce(new Error('load failed'))
    renderWithProviders(<SpendTrend />)

    expect(await screen.findByText('load failed')).toBeInTheDocument()

    mockApi.listExpenses.mockResolvedValueOnce([
      makeExpense({ amount: 10, spent_at: '2026-07-10' }),
    ])
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByRole('img')).toBeInTheDocument()
  })

  it('renders bars with an axis label per bucket in the resolved window', async () => {
    mockApi.listExpenses.mockResolvedValue([
      makeExpense({ amount: 10, spent_at: '2026-07-10' }),
    ])
    renderWithProviders(<SpendTrend />)

    const img = await screen.findByRole('img')
    // Rolling 30-day window ending 12 Jul is daily granularity; the chart's
    // accessible label carries a bucket for the day the expense falls into.
    // (Assert on aria-label, not a rendered XAxis tick — Recharts only lays
    // out tick <text> when the SVG has real dimensions, which jsdom lacks.)
    expect(img.getAttribute('aria-label')).toContain('Jul 10')
  })

  it('shows the unfiltered empty state when there is no data', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    renderWithProviders(<SpendTrend />)

    expect(await screen.findByText('No data to chart')).toBeInTheDocument()
  })

  it('shows the filtered empty state when a filter yields nothing', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    useUIStore.getState().setFilters({ category: 'food' })
    renderWithProviders(<SpendTrend />)

    expect(
      await screen.findByText('No expenses match your filters'),
    ).toBeInTheDocument()
  })

  it('shows the empty state (not an all-zero chart) when fetched expenses fall outside the active window', async () => {
    // Rolling 30-day window ends 2026-07-12, so anything before ~2026-06-13
    // is outside it — the derived buckets should sum to zero even though the
    // fetch itself returned rows.
    mockApi.listExpenses.mockResolvedValue([
      makeExpense({ amount: 25, spent_at: '2025-01-05' }),
    ])
    renderWithProviders(<SpendTrend />)

    expect(await screen.findByText('No data to chart')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the filtered empty state when an explicit date filter excludes all fetched expenses', async () => {
    mockApi.listExpenses.mockResolvedValue([
      makeExpense({ amount: 25, spent_at: '2025-01-05' }),
    ])
    useUIStore.getState().setFilters({ from: '2026-06-01', to: '2026-06-30' })
    renderWithProviders(<SpendTrend />)

    expect(
      await screen.findByText('No expenses match your filters'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('changes the window and granularity when the date filter changes', async () => {
    mockApi.listExpenses.mockResolvedValueOnce([
      makeExpense({ amount: 10, spent_at: '2026-07-10' }),
    ])
    renderWithProviders(<SpendTrend />)
    const firstImg = await screen.findByRole('img')
    // Rolling 30-day window -> daily granularity -> "Jul 10 10" in the
    // accessible summary.
    expect(firstImg.getAttribute('aria-label')).toContain('Jul 10 10')

    // A multi-year filter forces monthly granularity ("May 10" instead of a
    // "Jul 10"-style daily bucket), proving the window is filter-driven.
    mockApi.listExpenses.mockResolvedValueOnce([
      makeExpense({ amount: 10, spent_at: '2023-05-10' }),
    ])
    useUIStore.getState().setFilters({ from: '2020-01-01', to: '2026-07-01' })

    await waitFor(() => {
      expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
        'May 10',
      )
    })
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain(
      'Jul 10 10',
    )
  })
})
