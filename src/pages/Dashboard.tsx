import { Header } from '../components/Header'
import { useUIStore } from '../stores/uiStore'
import { Filters } from '../features/expenses/components/Filters'
import { SummaryCards } from '../features/expenses/components/SummaryCards'
import { ExpenseList } from '../features/expenses/components/ExpenseList'
import { ExpenseFormModal } from '../features/expenses/components/ExpenseFormModal'
import { DeleteConfirm } from '../features/expenses/components/DeleteConfirm'

export function Dashboard() {
  const openCreateForm = useUIStore((s) => s.openCreateForm)

  return (
    <div className="min-h-full">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 lg:pb-6">
        {/* Desktop: two columns (summary + filters | list). Mobile: stacked. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="space-y-4">
            <SummaryCards />
            <Filters />
          </aside>

          <ExpenseList />
        </div>
      </main>

      {/* Floating add button — mobile only (desktop uses the header button). */}
      <button
        onClick={openCreateForm}
        aria-label="Add expense"
        className="fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg hover:bg-brand-hover sm:hidden cursor-pointer"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <ExpenseFormModal />
      <DeleteConfirm />
    </div>
  )
}
