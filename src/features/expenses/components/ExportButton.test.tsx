import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { makeExpense } from '../../../test/factories'
import { todayISO } from '../../../lib/format'
import { ExportButton } from './ExportButton'
import * as api from '../api'

vi.mock('../api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  createExpenses: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

const mockApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

describe('ExportButton', () => {
  it('is disabled when there are no expenses', async () => {
    mockApi.listExpenses.mockResolvedValue([])
    renderWithProviders(<ExportButton />)

    expect(await screen.findByRole('button', { name: /export csv/i })).toBeDisabled()
  })

  it('downloads a CSV blob named expenses-<today>.csv when clicked', async () => {
    mockApi.listExpenses.mockResolvedValue([
      makeExpense({ spent_at: '2026-07-01', category: 'food', amount: 12.5, note: 'Lunch' }),
    ])
    renderWithProviders(<ExportButton />)

    const anchor = { href: '', download: '', click: vi.fn() }
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'a' ? (anchor as unknown as HTMLElement) : originalCreateElement(tag),
    )

    const button = await screen.findByRole('button', { name: /export csv/i })
    await vi.waitFor(() => expect(button).toBeEnabled())

    await userEvent.setup().click(button)

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchor.download).toBe(`expenses-${todayISO()}.csv`)
    expect(anchor.href).toBe('blob:mock-url')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
