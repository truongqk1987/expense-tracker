import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

/** Redirects already-authenticated users away from auth pages. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
