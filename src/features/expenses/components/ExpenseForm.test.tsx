import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseForm } from './ExpenseForm'
import { makeExpense } from '../../../test/factories'
import type { ExpenseInput } from '../types'

function setup(props: Partial<Parameters<typeof ExpenseForm>[0]> = {}) {
  const onSubmit = vi.fn<(input: ExpenseInput) => void>()
  const onCancel = vi.fn()
  render(
    <ExpenseForm
      submitting={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onSubmit, onCancel, user: userEvent.setup() }
}

describe('ExpenseForm', () => {
  it('blocks submit and shows a message when the amount is empty', async () => {
    const { onSubmit, user } = setup()

    await user.click(screen.getByRole('button', { name: /add expense/i }))

    expect(await screen.findByText('Enter an amount')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a well-shaped ExpenseInput for valid values', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Amount'), '12.50')
    await user.selectOptions(screen.getByLabelText('Category'), 'transport')
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), '2026-07-10')
    await user.type(screen.getByLabelText(/note/i), 'Taxi home')
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({
      amount: 12.5,
      category: 'transport',
      spent_at: '2026-07-10',
      note: 'Taxi home',
    })
  })

  it('trims a whitespace-only note down to null', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Amount'), '5')
    await user.type(screen.getByLabelText(/note/i), '   ')
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].note).toBeNull()
  })

  it('trims surrounding whitespace from a real note', async () => {
    const { onSubmit, user } = setup()

    await user.type(screen.getByLabelText('Amount'), '5')
    await user.type(screen.getByLabelText(/note/i), '  Lunch  ')
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].note).toBe('Lunch')
  })

  it('prefills fields and shows "Save changes" in edit mode', () => {
    setup({
      initial: makeExpense({
        amount: 42,
        category: 'bills',
        spent_at: '2026-06-01',
        note: 'Electricity',
      }),
    })

    expect(screen.getByLabelText('Amount')).toHaveValue(42)
    expect(screen.getByLabelText('Category')).toHaveValue('bills')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-06-01')
    expect(screen.getByLabelText(/note/i)).toHaveValue('Electricity')
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument()
  })

  it('calls onCancel (and not onSubmit) when Cancel is clicked', async () => {
    const { onSubmit, onCancel, user } = setup()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
