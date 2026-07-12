import { Modal } from '../../../components/ui/Modal'
import { useUIStore } from '../../../stores/uiStore'
import { useCreateExpense, useUpdateExpense } from '../hooks'
import { ExpenseForm } from './ExpenseForm'
import type { ExpenseInput } from '../types'

export function ExpenseFormModal() {
  const open = useUIStore((s) => s.formOpen)
  const target = useUIStore((s) => s.formTarget)
  const close = useUIStore((s) => s.closeForm)

  const create = useCreateExpense()
  const update = useUpdateExpense()

  const handleSubmit = (input: ExpenseInput) => {
    if (target) {
      update.mutate(
        { id: target.id, input },
        { onSuccess: () => close() },
      )
    } else {
      create.mutate(input, { onSuccess: () => close() })
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={target ? 'Edit expense' : 'Add expense'}
    >
      {/* key remounts the form so its default values reset per target. */}
      <ExpenseForm
        key={target?.id ?? 'new'}
        initial={target}
        submitting={create.isPending || update.isPending}
        onSubmit={handleSubmit}
        onCancel={close}
      />
    </Modal>
  )
}
