import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { useUIStore } from '../../../stores/uiStore'
import { formatCurrency } from '../../../lib/format'
import { getCategory } from '../../../lib/categories'
import { useDeleteExpense } from '../hooks'

export function DeleteConfirm() {
  const target = useUIStore((s) => s.deleteTarget)
  const cancel = useUIStore((s) => s.cancelDelete)
  const del = useDeleteExpense()

  const confirm = () => {
    if (!target) return
    del.mutate(target.id, { onSuccess: () => cancel() })
  }

  return (
    <Modal open={!!target} onClose={cancel} title="Delete expense?">
      {target && (
        <>
          <p className="text-sm text-muted">
            This will permanently remove{' '}
            <span className="font-medium text-ink">
              {formatCurrency(target.amount)}
            </span>{' '}
            ({getCategory(target.category).label}). This can&apos;t be undone.
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
