import { getCategory } from '../../../lib/categories'
import { formatCurrency, formatDate } from '../../../lib/format'
import { useUIStore } from '../../../stores/uiStore'
import type { Expense } from '../types'

export function ExpenseRow({ expense }: { expense: Expense }) {
  const openEditForm = useUIStore((s) => s.openEditForm)
  const requestDelete = useUIStore((s) => s.requestDelete)
  const category = getCategory(expense.category)

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60">
      <span
        className="h-9 w-9 shrink-0 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">
          {expense.note || category.label}
        </p>
        <p className="text-xs text-muted">
          {category.label} · {formatDate(expense.spent_at)}
        </p>
      </div>

      <span className="shrink-0 font-semibold text-ink tabular-nums">
        {formatCurrency(expense.amount)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => openEditForm(expense)}
          aria-label="Edit expense"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          onClick={() => requestDelete(expense)}
          aria-label="Delete expense"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
    </li>
  )
}
