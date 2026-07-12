import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { DeleteConfirm } from './DeleteConfirm'
import { Toaster } from '../../../components/Toaster'
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

function renderDelete() {
  return renderWithProviders(
    <>
      <DeleteConfirm />
      <Toaster />
    </>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DeleteConfirm', () => {
  it('cancels without calling the api', async () => {
    useUIStore.getState().requestDelete(makeExpense())
    renderDelete()

    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockApi.deleteExpense).not.toHaveBeenCalled()
    expect(useUIStore.getState().deleteTarget).toBeNull()
  })

  it('deletes by id, toasts success and clears the target', async () => {
    mockApi.deleteExpense.mockResolvedValue(undefined)
    useUIStore.getState().requestDelete(makeExpense({ id: 'exp-5' }))
    renderDelete()

    await userEvent.setup().click(screen.getByRole('button', { name: /^delete$/i }))

    await vi.waitFor(() =>
      expect(mockApi.deleteExpense).toHaveBeenCalledWith('exp-5'),
    )
    expect(await screen.findByText('Expense deleted')).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(useUIStore.getState().deleteTarget).toBeNull(),
    )
  })
})
