import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ExpenseFormModal } from './ExpenseFormModal'
import { Toaster } from '../../../components/Toaster'
import { useUIStore } from '../../../stores/uiStore'
import { makeExpense } from '../../../test/factories'
import * as api from '../api'

vi.mock('../api', () => ({
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  listExpenses: vi.fn(),
}))

const mockApi = vi.mocked(api)

function renderModal() {
  return renderWithProviders(
    <>
      <ExpenseFormModal />
      <Toaster />
    </>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

async function fillValidAmount(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Amount'), '15')
}

describe('ExpenseFormModal — create', () => {
  it('creates the expense, closes the modal and toasts success', async () => {
    mockApi.createExpense.mockResolvedValue(makeExpense({ amount: 15 }))
    const user = userEvent.setup()
    useUIStore.getState().openCreateForm()
    renderModal()

    await fillValidAmount(user)
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    await vi.waitFor(() =>
      expect(mockApi.createExpense).toHaveBeenCalledTimes(1),
    )
    expect(mockApi.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 15, category: 'food' }),
    )
    // Modal closed on success.
    await vi.waitFor(() => expect(useUIStore.getState().formOpen).toBe(false))
    expect(await screen.findByText('Expense added')).toBeInTheDocument()
  })

  it('keeps the modal open and toasts the error message on failure', async () => {
    mockApi.createExpense.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    useUIStore.getState().openCreateForm()
    renderModal()

    await fillValidAmount(user)
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(useUIStore.getState().formOpen).toBe(true)
  })
})

describe('ExpenseFormModal — edit', () => {
  it('updates the targeted expense and toasts "Expense updated"', async () => {
    const target = makeExpense({ id: 'exp-7', amount: 20, category: 'bills' })
    mockApi.updateExpense.mockResolvedValue({ ...target, amount: 25 })
    const user = userEvent.setup()
    useUIStore.getState().openEditForm(target)
    renderModal()

    const amount = screen.getByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '25')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await vi.waitFor(() =>
      expect(mockApi.updateExpense).toHaveBeenCalledTimes(1),
    )
    expect(mockApi.updateExpense).toHaveBeenCalledWith(
      'exp-7',
      expect.objectContaining({ amount: 25, category: 'bills' }),
    )
    expect(await screen.findByText('Expense updated')).toBeInTheDocument()
    expect(mockApi.createExpense).not.toHaveBeenCalled()
  })
})
