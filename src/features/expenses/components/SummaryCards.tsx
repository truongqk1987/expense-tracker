import { useMemo } from 'react'
import { formatCurrency } from '../../../lib/format'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { useBudgets } from '../../budgets/hooks'
import { useExpenses } from '../hooks'
import { summarize } from './summarize'

export function SummaryCards() {
  const { data } = useExpenses()
  const summary = useMemo(() => summarize(data ?? []), [data])

  const { data: budgets } = useBudgets()
  const overallBudget = budgets?.find((b) => b.category === null) ?? null
  const over = overallBudget ? summary.monthTotal > overallBudget.amount : false

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      <div className="col-span-2 rounded-card border border-line bg-surface p-4 lg:col-span-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Spent this month
        </p>
        <p className="mt-2 text-2xl font-bold text-ink tabular-nums">
          {formatCurrency(summary.monthTotal)}
        </p>
        {overallBudget && (
          <div className="mt-3">
            <ProgressBar
              value={summary.monthTotal}
              max={overallBudget.amount}
              variant={over ? 'over' : 'normal'}
            />
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>of {formatCurrency(overallBudget.amount)} budget</span>
              {over && (
                <span className="font-medium text-danger">
                  {formatCurrency(summary.monthTotal - overallBudget.amount)}{' '}
                  over
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <Card
        label="Total (filtered)"
        value={formatCurrency(summary.filteredTotal)}
        hint={`${summary.count} expense${summary.count === 1 ? '' : 's'}`}
      />
      <div className="col-span-2 rounded-card border border-line bg-surface p-4 lg:col-span-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Top category
        </p>
        {summary.topCategory ? (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: summary.topCategory.color }}
              aria-hidden
            />
            <span className="font-semibold text-ink">
              {summary.topCategory.label}
            </span>
            <span className="ml-auto font-semibold text-ink tabular-nums">
              {formatCurrency(summary.topCategory.amount)}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">—</p>
        )}
      </div>
    </div>
  )
}

function Card({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
