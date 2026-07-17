import { useMemo } from 'react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { DonutChart } from '../../../components/ui/DonutChart'
import { formatCurrency } from '../../../lib/format'
import { useUIStore } from '../../../stores/uiStore'
import { useExpenses } from '../hooks'
import { categoryBreakdown } from './summarize'

export function CategoryDonut() {
  const { data, isPending, isError, error, refetch } = useExpenses()
  const filters = useUIStore((s) => s.filters)
  const hasFilters = Boolean(filters.category || filters.from || filters.to)

  const slices = useMemo(() => categoryBreakdown(data ?? []), [data])

  return (
    <section>
      <h3 className="mb-3 font-semibold text-ink">Spending by category</h3>

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
      ) : slices.length === 0 ? (
        <EmptyState filtered={hasFilters} />
      ) : (
        // @container: the real chart column width is set by the ancestor
        // grid (Dashboard sidebar + ChartsPanel split), not the viewport, so
        // the row/column switch must react to the container's width via a
        // container-query variant (@md) rather than a viewport variant (sm).
        <div className="@container flex flex-col items-center gap-4 @md:flex-row @md:items-center">
          <DonutChart
            className="w-full max-w-[220px] shrink-0"
            segments={slices.map((s) => ({
              label: s.label,
              value: s.amount,
              color: s.color,
            }))}
          />
          <ul className="w-full min-w-0 space-y-2">
            {slices.map((s) => (
              <li
                key={s.category}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="min-w-0 text-ink">{s.label}</span>
                <span className="ml-auto font-medium text-ink tabular-nums">
                  {formatCurrency(s.amount)}
                </span>
                <span className="w-12 text-right text-xs text-muted tabular-nums">
                  {Math.round(s.pct * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
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
            Add your first expense to see a breakdown.
          </p>
        </>
      )}
    </div>
  )
}
