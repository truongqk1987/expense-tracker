import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { makeExpense } from '../../../test/factories'
import { useUIStore } from '../../../stores/uiStore'
import { CategoryDonut } from './CategoryDonut'
import * as api from '../api'

vi.mock('../api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

const mockApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CategoryDonut', () => {
  it('shows a spinner while the query is pending', () => {
    mockApi.listExpenses.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithProviders(<CategoryDonut />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows an error with a Retry button that refetches', async () => {
    mockApi.listExpenses.mockRejectedValueOnce(new Error('load failed'))
    renderWithProviders(<CategoryDonut />)

    expect(await screen.findByText('load failed')).toBeInTheDocument()

    mockApi.listExpenses.mockResolvedValueOnce([
      makeExpense({ category: 'food', amount: 30 }),
    ])
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText('Food & Drink')).toBeInTheDocument()
  })

  it('renders the donut + a legend row per category with formatted amounts', async () => {
    mockApi.listExpenses.mockResolvedValue([
      makeExpense({ category: 'food', amount: 30 }),
      makeExpense({ category: 'bills', amount: 10 }),
    ])
    renderWithProviders(<CategoryDonut />)

    expect(await screen.findByText('Food & Drink')).toBeInTheDocument()
    expect(screen.getByText('Bills & Utilities')).toBeInTheDocument()
    expect(screen.getByText('$30.00')).toBeInTheDocument()
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    // 30 / 40 = 75%, 10 / 40 = 25%
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('shows the unfiltered empty state when there is no data', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    renderWithProviders(<CategoryDonut />)

    expect(await screen.findByText('No data to chart')).toBeInTheDocument()
  })

  it('shows the filtered empty state when a filter yields nothing', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    useUIStore.getState().setFilters({ category: 'food' })
    renderWithProviders(<CategoryDonut />)

    expect(
      await screen.findByText('No expenses match your filters'),
    ).toBeInTheDocument()
  })

  it('reflects the refetched set when the category filter changes', async () => {
    mockApi.listExpenses.mockResolvedValueOnce([
      makeExpense({ category: 'food', amount: 30 }),
      makeExpense({ category: 'bills', amount: 10 }),
    ])
    renderWithProviders(<CategoryDonut />)
    expect(await screen.findByText('Food & Drink')).toBeInTheDocument()
    expect(screen.getByText('Bills & Utilities')).toBeInTheDocument()

    mockApi.listExpenses.mockResolvedValueOnce([
      makeExpense({ category: 'food', amount: 30 }),
    ])
    useUIStore.getState().setFilters({ category: 'food' })

    // Poll both conditions together so a stale node from mid-transition
    // doesn't produce a false pass/fail race.
    await waitFor(() => {
      expect(screen.getByText('Food & Drink')).toBeInTheDocument()
      expect(screen.queryByText('Bills & Utilities')).not.toBeInTheDocument()
    })
  })
})
