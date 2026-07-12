import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { Button } from './ui/Button'

export function Header() {
  const user = useAuthStore((s) => s.user)
  const openCreateForm = useUIStore((s) => s.openCreateForm)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h12" />
          </svg>
        </span>
        <span className="font-semibold text-ink">Expense Tracker</span>

        {/* Primary action — always visible on desktop; mobile uses the FAB. */}
        <div className="ml-auto flex items-center gap-3">
          <Button size="sm" className="hidden sm:inline-flex" onClick={openCreateForm}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add expense
          </Button>

          {user?.email && (
            <span className="hidden text-sm text-muted md:inline">{user.email}</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
