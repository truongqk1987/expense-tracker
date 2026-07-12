import type { ReactNode } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h12" />
            </svg>
          </span>
          <span className="text-lg font-semibold text-ink">Expense Tracker</span>
        </div>

        <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 mb-5 text-sm text-muted">{subtitle}</p>

          {!isSupabaseConfigured && (
            <div className="mb-5 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
              Supabase isn&apos;t configured yet. Add your credentials to
              <code className="mx-1">.env.local</code> to enable auth.
            </div>
          )}

          {children}
        </div>

        <p className="mt-5 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  )
}
