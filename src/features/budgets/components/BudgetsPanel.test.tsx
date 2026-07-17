import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { BudgetsPanel } from './BudgetsPanel'
import { BudgetDeleteConfirm } from './BudgetDeleteConfirm'
import { Toaster } from '../../../components/Toaster'
import { useUIStore } from '../../../stores/uiStore'
import { makeBudget, makeExpense } from '../../../test/factories'
import * as budgetsApi from '../api'
import * as expensesApi from '../../expenses/api'

vi.mock('../api', () => ({
  listBudgets: vi.fn(),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn(),
}))

vi.mock('../../expenses/api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

const mockBudgetsApi = vi.mocked(budgetsApi)
const mockExpensesApi = vi.mocked(expensesApi)

beforeEach(() => {
  vi.clearAllMocks()
  mockExpensesApi.listExpenses.mockResolvedValue([])
})

describe('BudgetsPanel', () => {
  it('shows a spinner while the query is pending', () => {
    mockBudgetsApi.listBudgets.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = renderWithProviders(<BudgetsPanel />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows an error with a Retry button that refetches', async () => {
    mockBudgetsApi.listBudgets.mockRejectedValueOnce(new Error('load failed'))
    renderWithProviders(<BudgetsPanel />)

    expect(await screen.findByText('load failed')).toBeInTheDocument()

    mockBudgetsApi.listBudgets.mockResolvedValueOnce([
      makeBudget({ category: 'food' }),
    ])
    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText('Food & Drink')).toBeInTheDocument()
  })

  it('shows the empty state with an Add budget button when there are no budgets', async () => {
    mockBudgetsApi.listBudgets.mockResolvedValue([])
    renderWithProviders(<BudgetsPanel />)

    expect(await screen.findByText('No budgets set yet.')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /add budget/i }).length,
    ).toBeGreaterThan(0)
  })

  it('renders a bar per budget with the spent / budget text', async () => {
    mockExpensesApi.listExpenses.mockResolvedValue([
      makeExpense({ category: 'food', amount: 30, spent_at: '2026-07-12' }),
    ])
    mockBudgetsApi.listBudgets.mockResolvedValue([
      makeBudget({ category: 'food', amount: 500 }),
      makeBudget({ category: null, amount: 1000 }),
    ])
    renderWithProviders(<BudgetsPanel />)

    expect(await screen.findByText('Food & Drink')).toBeInTheDocument()
    expect(screen.getByText('Overall')).toBeInTheDocument()
    expect(screen.getByText('$30.00 / $500.00')).toBeInTheDocument()
    expect(screen.getByText('$30.00 / $1,000.00')).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(2)
  })

  it('opens the create-budget form when "Add budget" is clicked', async () => {
    mockBudgetsApi.listBudgets.mockResolvedValue([
      makeBudget({ category: 'food', amount: 500 }),
    ])
    renderWithProviders(<BudgetsPanel />)

    await screen.findByText('Food & Drink')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /add budget/i }))

    expect(useUIStore.getState().budgetFormOpen).toBe(true)
    expect(useUIStore.getState().budgetTarget).toBeNull()
  })

  it('deletes a budget through the confirm modal, invalidating and toasting', async () => {
    mockBudgetsApi.listBudgets.mockResolvedValue([
      makeBudget({ id: 'budget-5', category: 'food', amount: 500 }),
    ])
    mockBudgetsApi.deleteBudget.mockResolvedValue(undefined)
    renderWithProviders(
      <>
        <BudgetsPanel />
        <BudgetDeleteConfirm />
        <Toaster />
      </>,
    )

    await screen.findByText('Food & Drink')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(useUIStore.getState().budgetDeleteTarget?.id).toBe('budget-5')

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[1])

    await vi.waitFor(() =>
      expect(mockBudgetsApi.deleteBudget).toHaveBeenCalledWith('budget-5'),
    )
    expect(await screen.findByText('Budget removed')).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(useUIStore.getState().budgetDeleteTarget).toBeNull(),
    )
  })
})
