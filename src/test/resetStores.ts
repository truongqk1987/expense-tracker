import { beforeEach } from 'vitest'
import { useUIStore } from '../stores/uiStore'
import { useToastStore } from '../stores/toastStore'

/**
 * Zustand stores are module-level singletons that persist across tests. Import
 * this file (for its side effect) in any test that touches store state so each
 * case starts from a clean slate.
 */
beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true)
  useToastStore.setState({ toasts: [] })
})
