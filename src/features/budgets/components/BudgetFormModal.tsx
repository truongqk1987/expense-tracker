import { Modal } from '../../../components/ui/Modal'
import { useUIStore } from '../../../stores/uiStore'
import { useCreateBudget, useUpdateBudget } from '../hooks'
import { BudgetForm } from './BudgetForm'
import type { BudgetInput } from '../types'

export function BudgetFormModal() {
  const open = useUIStore((s) => s.budgetFormOpen)
  const target = useUIStore((s) => s.budgetTarget)
  const close = useUIStore((s) => s.closeBudgetForm)

  const create = useCreateBudget()
  const update = useUpdateBudget()

  const handleSubmit = (input: BudgetInput) => {
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
      title={target ? 'Edit budget' : 'Add budget'}
    >
      {/* key remounts the form so its default values reset per target. */}
      <BudgetForm
        key={target?.id ?? 'new'}
        initial={target}
        submitting={create.isPending || update.isPending}
        onSubmit={handleSubmit}
        onCancel={close}
      />
    </Modal>
  )
}
