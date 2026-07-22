import { useMemo } from 'react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { getCategory } from '../../../lib/categories'
import { formatCurrency, formatDate } from '../../../lib/format'
import { useExpenses } from '../hooks'
import { computeInsights, type CategoryDelta, type Insights } from './insights'

/**
 * Dashboard insights card — a pure derivation over the same `useExpenses()`
 * cache as `CategoryDonut`/`SpendTrend` (no new query, no schema change):
 * the biggest month-over-month category mover, this month's single largest
 * expense, and the daily-average spend pace.
 */
export function InsightsPanel() {
  const { data, isPending, isError, error, refetch } = useExpenses()

  const insights = useMemo(() => computeInsights(data ?? []), [data])
  const isEmpty = (data ?? []).length === 0

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h3 className="mb-3 font-semibold text-ink">Insights</h3>

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
      ) : isEmpty ? (
        <div className="grid place-items-center px-4 py-12 text-center">
          <p className="font-medium text-ink">No data yet</p>
          <p className="mt-1 text-sm text-muted">
            Add an expense to see your spending insights.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 @container @md:grid-cols-3">
          <TopMoverCard
            topMover={insights.topMover}
            hasPriorMonth={insights.hasPriorMonth}
          />
          <BiggestExpenseCard biggest={insights.biggest} />
          <DailyAverageCard dailyAverage={insights.dailyAverage} />
        </div>
      )}
    </section>
  )
}

function TopMoverCard({
  topMover,
  hasPriorMonth,
}: {
  topMover: CategoryDelta | null
  hasPriorMonth: boolean
}) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs font-medium text-muted">Biggest mover</p>
      {!hasPriorMonth || !topMover ? (
        <p className="mt-1 text-sm text-ink">Not enough history yet</p>
      ) : (
        <div className="mt-1 flex items-start gap-2">
          <span
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: topMover.color }}
            aria-hidden
          />
          {topMover.deltaPct === null ? (
            <p className="text-sm text-ink">
              You spent {formatCurrency(topMover.thisMonth)} on{' '}
              {topMover.label} — new this month
            </p>
          ) : (
            <p className="text-sm text-ink">
              You spent {formatCurrency(Math.abs(topMover.deltaAbs))} (
              {Math.round(Math.abs(topMover.deltaPct) * 100)}%{' '}
              {topMover.deltaPct >= 0 ? 'more' : 'less'}) on {topMover.label}{' '}
              than last month
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function BiggestExpenseCard({
  biggest,
}: {
  biggest: Insights['biggest']
}) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs font-medium text-muted">
        Biggest expense this month
      </p>
      {!biggest ? (
        <p className="mt-1 text-sm text-ink">No expenses yet this month</p>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: getCategory(biggest.category).color }}
            aria-hidden
          />
          <span className="text-sm font-medium text-ink tabular-nums">
            {formatCurrency(biggest.amount)}
          </span>
          <span className="text-sm text-muted">
            {getCategory(biggest.category).label} ·{' '}
            {formatDate(biggest.spent_at)}
          </span>
        </div>
      )}
    </div>
  )
}

function DailyAverageCard({
  dailyAverage,
}: {
  dailyAverage: Insights['dailyAverage']
}) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs font-medium text-muted">Daily average</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-sm font-medium text-ink tabular-nums">
          {formatCurrency(dailyAverage.average)}
        </span>
        <span className="text-xs text-muted">
          over {dailyAverage.days} day{dailyAverage.days === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}
