import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { useUIStore } from '../../../stores/uiStore'
import { formatCurrency } from '../../../lib/format'
import { getCategory } from '../../../lib/categories'
import { useDeleteBudget } from '../hooks'

export function BudgetDeleteConfirm() {
  const target = useUIStore((s) => s.budgetDeleteTarget)
  const cancel = useUIStore((s) => s.cancelBudgetDelete)
  const del = useDeleteBudget()

  const confirm = () => {
    if (!target) return
    del.mutate(target.id, { onSuccess: () => cancel() })
  }

  const label = target
    ? target.category
      ? getCategory(target.category).label
      : 'Overall'
    : ''

  return (
    <Modal open={!!target} onClose={cancel} title="Delete budget?">
      {target && (
        <>
          <p className="text-sm text-muted">
            This will permanently remove the{' '}
            <span className="font-medium text-ink">{label}</span> budget of{' '}
            <span className="font-medium text-ink">
              {formatCurrency(target.amount)}
            </span>
            . This can&apos;t be undone.
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={cancel}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={del.isPending}
              onClick={confirm}
            >
              Delete
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
