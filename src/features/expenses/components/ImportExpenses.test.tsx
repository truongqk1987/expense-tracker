import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { Toaster } from '../../../components/Toaster'
import { ImportExpenses } from './ImportExpenses'
import * as api from '../api'

vi.mock('../api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  createExpenses: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

const mockApi = vi.mocked(api)

function renderImport() {
  return renderWithProviders(
    <>
      <ImportExpenses />
      <Toaster />
    </>,
  )
}

function csvFile(content: string) {
  return new File([content], 'expenses.csv', { type: 'text/csv' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ImportExpenses', () => {
  it('previews N valid / M skipped after uploading a CSV', async () => {
    const csv =
      'date,category,amount,note\n' +
      '2026-07-01,food,12.5,Lunch\n' +
      '2026-07-02,vacation,5,\n'
    renderImport()

    await userEvent.setup().upload(
      screen.getByLabelText(/import csv file/i),
      csvFile(csv),
    )

    expect(await screen.findByText('1 valid / 1 skipped')).toBeInTheDocument()
    expect(screen.getByText(/unknown category/i)).toBeInTheDocument()
  })

  it('cancels without calling the api', async () => {
    const csv = 'date,category,amount,note\n2026-07-01,food,12.5,Lunch\n'
    renderImport()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/import csv file/i), csvFile(csv))
    await screen.findByText('1 valid / 0 skipped')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockApi.createExpenses).not.toHaveBeenCalled()
    expect(screen.queryByText('1 valid / 0 skipped')).not.toBeInTheDocument()
  })

  it('confirms by bulk-inserting only the valid rows and toasts success', async () => {
    const csv =
      'date,category,amount,note\n' +
      '2026-07-01,food,12.5,Lunch\n' +
      '2026-07-02,vacation,5,\n'
    mockApi.createExpenses.mockResolvedValue([])
    renderImport()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/import csv file/i), csvFile(csv))
    await screen.findByText('1 valid / 1 skipped')
    await user.click(screen.getByRole('button', { name: /^import 1$/i }))

    await waitFor(() =>
      expect(mockApi.createExpenses).toHaveBeenCalledWith([
        { amount: 12.5, category: 'food', spent_at: '2026-07-01', note: 'Lunch' },
      ]),
    )
    expect(await screen.findByText('Imported 0 expenses')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText('1 valid / 1 skipped')).not.toBeInTheDocument(),
    )
  })

  it('disables the confirm action when every row was skipped', async () => {
    const csv = 'date,category,amount,note\n2026-07-01,vacation,5,\n'
    renderImport()

    await userEvent.setup().upload(screen.getByLabelText(/import csv file/i), csvFile(csv))

    expect(await screen.findByText('0 valid / 1 skipped')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^import 0$/i })).toBeDisabled()
  })
})
