import { useMemo } from 'react'
import { useUIStore } from '../../../stores/uiStore'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { formatCurrency } from '../../../lib/format'
import { useExpenses } from '../../expenses/hooks'
import { useBudgets } from '../hooks'
import { computeBudgetProgress } from '../progress'

export function BudgetsPanel() {
  const {
    data: budgets,
    isPending,
    isError,
    error,
    refetch,
  } = useBudgets()
  const { data: expenses } = useExpenses()

  const openCreateBudget = useUIStore((s) => s.openCreateBudget)
  const openEditBudget = useUIStore((s) => s.openEditBudget)
  const requestBudgetDelete = useUIStore((s) => s.requestBudgetDelete)

  const progress = useMemo(
    () => computeBudgetProgress(expenses ?? [], budgets ?? []),
    [expenses, budgets],
  )

  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold text-ink">Budgets</h2>
        <Button size="sm" variant="secondary" onClick={openCreateBudget}>
          Add budget
        </Button>
      </header>

      {isPending ? (
        <div className="grid place-items-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-danger">
            {(error as Error)?.message ?? 'Failed to load budgets.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      ) : budgets.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted">No budgets set yet.</p>
          <Button size="sm" className="mt-3" onClick={openCreateBudget}>
            Add budget
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {budgets.map((budget, i) => {
            const p = progress[i]
            return (
              <li key={budget.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {p.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditBudget(budget)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => requestBudgetDelete(budget)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={p.spent}
                  max={p.budget}
                  variant={p.over ? 'over' : 'normal'}
                />
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <span>
                    {formatCurrency(p.spent)} / {formatCurrency(p.budget)}
                  </span>
                  {p.over && (
                    <span className="font-medium text-danger">
                      {formatCurrency(p.spent - p.budget)} over
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
