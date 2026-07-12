import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ExpenseList } from './ExpenseList'
import { useUIStore } from '../../../stores/uiStore'
import { makeExpense } from '../../../test/factories'
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

describe('ExpenseList', () => {
  it('shows a spinner while the query is pending', () => {
    mockApi.listExpenses.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = renderWithProviders(<ExpenseList />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows an error with a Retry button that refetches', async () => {
    mockApi.listExpenses.mockRejectedValueOnce(new Error('load failed'))
    renderWithProviders(<ExpenseList />)

    expect(await screen.findByText('load failed')).toBeInTheDocument()

    mockApi.listExpenses.mockResolvedValueOnce([makeExpense({ note: 'Coffee' })])
    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText('Coffee')).toBeInTheDocument()
  })

  it('shows the first-run empty state with an Add button when unfiltered', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    renderWithProviders(<ExpenseList />)

    expect(await screen.findByText('No expenses yet')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add expense/i }),
    ).toBeInTheDocument()
  })

  it('shows the filtered empty state when filters are active', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    useUIStore.getState().setFilters({ category: 'food' })
    renderWithProviders(<ExpenseList />)

    expect(
      await screen.findByText('No expenses match your filters'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /clear filters/i }),
    ).toBeInTheDocument()
  })

  it('renders a row per expense with its amount', async () => {
    mockApi.listExpenses.mockResolvedValue([
      makeExpense({ note: 'Groceries', amount: 30 }),
      makeExpense({ note: 'Bus', amount: 2.5 }),
    ])
    renderWithProviders(<ExpenseList />)

    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Bus')).toBeInTheDocument()
    expect(screen.getByText('$30.00')).toBeInTheDocument()
    expect(screen.getByText('$2.50')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
