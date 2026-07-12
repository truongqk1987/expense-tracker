import { useUIStore } from '../../../stores/uiStore'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { useExpenses } from '../hooks'
import { ExpenseRow } from './ExpenseRow'

export function ExpenseList() {
  const { data, isPending, isError, error, refetch, isFetching } = useExpenses()
  const openCreateForm = useUIStore((s) => s.openCreateForm)
  const filters = useUIStore((s) => s.filters)
  const hasFilters = Boolean(filters.category || filters.from || filters.to)

  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold text-ink">Expenses</h2>
        {isFetching && !isPending && <Spinner className="h-4 w-4" />}
      </header>

      {isPending ? (
        <div className="grid place-items-center py-16">
          <Spinner className="h-7 w-7" />
        </div>
      ) : isError ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-danger">
            {(error as Error)?.message ?? 'Failed to load expenses.'}
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
      ) : data.length === 0 ? (
        <EmptyState
          filtered={hasFilters}
          onAdd={openCreateForm}
          onClear={useUIStore.getState().resetFilters}
        />
      ) : (
        <ul className="divide-y divide-line">
          {data.map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} />
          ))}
        </ul>
      )}
    </section>
  )
}

function EmptyState({
  filtered,
  onAdd,
  onClear,
}: {
  filtered: boolean
  onAdd: () => void
  onClear: () => void
}) {
  return (
    <div className="grid place-items-center px-4 py-16 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      </span>
      {filtered ? (
        <>
          <p className="font-medium text-ink">No expenses match your filters</p>
          <p className="mt-1 text-sm text-muted">Try widening the date range or category.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onClear}>
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium text-ink">No expenses yet</p>
          <p className="mt-1 text-sm text-muted">Add your first expense to get started.</p>
          <Button size="sm" className="mt-4" onClick={onAdd}>
            Add expense
          </Button>
        </>
      )}
    </div>
  )
}
