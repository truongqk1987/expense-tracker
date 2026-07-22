import { Button } from '../../../components/ui/Button'
import { todayISO } from '../../../lib/format'
import { expensesToCsv } from '../csv'
import { useExpenses } from '../hooks'

/** Exports the currently-filtered expenses (from the `useExpenses()` cache)
 *  as a CSV file download. */
export function ExportButton() {
  const { data } = useExpenses()
  const expenses = data ?? []

  const handleExport = () => {
    const csv = expensesToCsv(expenses)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `expenses-${todayISO()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleExport}
      disabled={expenses.length === 0}
    >
      Export CSV
    </Button>
  )
}
