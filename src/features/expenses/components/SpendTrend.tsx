import { useMemo } from 'react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { BarChart } from '../../../components/ui/BarChart'
import { useUIStore } from '../../../stores/uiStore'
import { useExpenses } from '../hooks'
import { bucketSpendOverTime, resolveTrendWindow } from './trend'

export function SpendTrend() {
  const { data, isPending, isError, error, refetch } = useExpenses()
  const filters = useUIStore((s) => s.filters)
  const hasFilters = Boolean(filters.category || filters.from || filters.to)

  const window = useMemo(() => resolveTrendWindow(filters), [filters])
  const buckets = useMemo(
    () => bucketSpendOverTime(data ?? [], window),
    [data, window],
  )
  const hasSpend = buckets.some((b) => b.total !== 0)

  return (
    <section>
      <h3 className="mb-3 font-semibold text-ink">Spend over time</h3>

      {isPending ? (
        <div className="grid place-items-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="px-4 py-8 text-center">
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
      ) : !hasSpend ? (
        <EmptyState filtered={hasFilters} />
      ) : (
        <BarChart
          bars={buckets.map((b) => ({ label: b.label, value: b.total }))}
        />
      )}
    </section>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid place-items-center px-4 py-12 text-center">
      {filtered ? (
        <>
          <p className="font-medium text-ink">No expenses match your filters</p>
          <p className="mt-1 text-sm text-muted">
            Try widening the date range or category.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium text-ink">No data to chart</p>
          <p className="mt-1 text-sm text-muted">
            Add your first expense to see a trend.
          </p>
        </>
      )}
    </div>
  )
}
