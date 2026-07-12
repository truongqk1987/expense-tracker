import { useMemo } from 'react'
import { getCategory } from '../../../lib/categories'
import { formatCurrency, startOfMonthISO, todayISO } from '../../../lib/format'
import { useExpenses } from '../hooks'
import type { Expense } from '../types'

interface Summary {
  monthTotal: number
  filteredTotal: number
  count: number
  topCategory: { label: string; color: string; amount: number } | null
}

function summarize(expenses: Expense[]): Summary {
  const monthStart = startOfMonthISO()
  const today = todayISO()

  let monthTotal = 0
  let filteredTotal = 0
  const byCategory = new Map<string, number>()

  for (const e of expenses) {
    filteredTotal += e.amount
    if (e.spent_at >= monthStart && e.spent_at <= today) monthTotal += e.amount
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
  }

  let topCategory: Summary['topCategory'] = null
  for (const [value, amount] of byCategory) {
    if (!topCategory || amount > topCategory.amount) {
      const c = getCategory(value)
      topCategory = { label: c.label, color: c.color, amount }
    }
  }

  return { monthTotal, filteredTotal, count: expenses.length, topCategory }
}

export function SummaryCards() {
  const { data } = useExpenses()
  const summary = useMemo(() => summarize(data ?? []), [data])

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      <Card label="Spent this month" value={formatCurrency(summary.monthTotal)} />
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
