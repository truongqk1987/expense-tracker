import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../test/resetStores'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { Filters } from './Filters'
import { ExpenseList } from './ExpenseList'
import { useUIStore } from '../../../stores/uiStore'
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
  mockApi.listExpenses.mockResolvedValue([])
})

function renderFiltersWithList() {
  return renderWithProviders(
    <>
      <Filters />
      <ExpenseList />
    </>,
  )
}

describe('Filters', () => {
  it('refetches with the chosen category (query key includes filters)', async () => {
    renderFiltersWithList()
    await vi.waitFor(() => expect(mockApi.listExpenses).toHaveBeenCalled())

    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText('Category'), 'food')

    await vi.waitFor(() =>
      expect(mockApi.listExpenses).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'food' }),
      ),
    )
    expect(useUIStore.getState().filters.category).toBe('food')
  })

  it('passes the From/To date range through to the query', async () => {
    renderFiltersWithList()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('From'), '2026-07-01')
    await user.type(screen.getByLabelText('To'), '2026-07-31')

    await vi.waitFor(() =>
      expect(mockApi.listExpenses).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-07-01', to: '2026-07-31' }),
      ),
    )
  })

  it('hides Clear until a filter is active, then resets on click', async () => {
    renderFiltersWithList()
    const user = userEvent.setup()

    expect(screen.queryByRole('button', { name: /^clear$/i })).toBeNull()

    await user.selectOptions(screen.getByLabelText('Category'), 'food')
    const clear = await screen.findByRole('button', { name: /^clear$/i })
    await user.click(clear)

    expect(useUIStore.getState().filters).toEqual({
      category: '',
      from: '',
      to: '',
    })
  })
})
