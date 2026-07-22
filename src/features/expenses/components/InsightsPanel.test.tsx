import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { makeExpense } from '../../../test/factories'
import { InsightsPanel } from './InsightsPanel'
import * as api from '../api'

vi.mock('../api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

const mockApi = vi.mocked(api)

// Pin "now" to 12 Jul 2026 so this month is [Jul 1, Jul 12] and the baseline
// is the same-elapsed-days slice of last month [Jun 1, Jun 12]. Only `Date`
// is faked (not setTimeout/setInterval) so Testing Library's `findByText` /
// `waitFor` polling — which relies on real timers — still resolves.
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 6, 12, 9, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('InsightsPanel', () => {
  it('shows a spinner while the query is pending', () => {
    mockApi.listExpenses.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithProviders(<InsightsPanel />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows an error with a Retry button that refetches', async () => {
    mockApi.listExpenses.mockRejectedValueOnce(new Error('load failed'))
    renderWithProviders(<InsightsPanel />)

    expect(await screen.findByText('load failed')).toBeInTheDocument()

    mockApi.listExpenses.mockResolvedValueOnce([
      makeExpense({ category: 'food', amount: 40, spent_at: '2026-07-05' }),
    ])
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText('$40.00')).toBeInTheDocument()
  })

  it('shows the empty state when there is no data', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    renderWithProviders(<InsightsPanel />)

    expect(await screen.findByText('No data yet')).toBeInTheDocument()
  })

  it('renders the top mover headline, biggest expense and daily average when populated', async () => {
    mockApi.listExpenses.mockResolvedValue([
      // food: this month 130, last month (Jun 1-12) 100 -> +30%
      makeExpense({ category: 'food', amount: 130, spent_at: '2026-07-05' }),
      makeExpense({ category: 'food', amount: 100, spent_at: '2026-06-05' }),
    ])
    renderWithProviders(<InsightsPanel />)

    expect(
      await screen.findByText(
        /You spent \$30\.00 \(30% more\) on Food & Drink than last month/,
      ),
    ).toBeInTheDocument()

    // Biggest expense this month is the $130 Food & Drink row.
    expect(screen.getByText('$130.00')).toBeInTheDocument()
    expect(screen.getByText(/Food & Drink · Jul 5, 2026/)).toBeInTheDocument()

    // Daily average: $130 total / 12 elapsed days.
    expect(screen.getByText('$10.83')).toBeInTheDocument()
    expect(screen.getByText('over 12 days')).toBeInTheDocument()
  })

  it('shows "not enough history yet" when there is this-month data but no prior month', async () => {
    mockApi.listExpenses.mockResolvedValue([
      makeExpense({ category: 'food', amount: 50, spent_at: '2026-07-05' }),
    ])
    renderWithProviders(<InsightsPanel />)

    expect(
      await screen.findByText('Not enough history yet'),
    ).toBeInTheDocument()
    // The other two cards still render real data.
    expect(screen.getByText('$50.00')).toBeInTheDocument()
    expect(screen.getByText('over 12 days')).toBeInTheDocument()
  })

  it('shows "new this month" when the top mover has no prior-month spend but another category does', async () => {
    mockApi.listExpenses.mockResolvedValue([
      // bills has prior-month spend, so hasPriorMonth is true...
      makeExpense({ category: 'bills', amount: 10, spent_at: '2026-07-01' }),
      makeExpense({ category: 'bills', amount: 10, spent_at: '2026-06-01' }),
      // ...but entertainment is brand new this month and has the bigger |deltaAbs|.
      makeExpense({
        category: 'entertainment',
        amount: 40,
        spent_at: '2026-07-04',
      }),
    ])
    renderWithProviders(<InsightsPanel />)

    expect(
      await screen.findByText(
        /You spent \$40\.00 on Entertainment — new this month/,
      ),
    ).toBeInTheDocument()
  })
})
