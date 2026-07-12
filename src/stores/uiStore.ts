import { create } from 'zustand'
import type { Expense } from '../features/expenses/types'

export interface ExpenseFilters {
  category: string // '' = all
  from: string // YYYY-MM-DD or ''
  to: string // YYYY-MM-DD or ''
}

interface UIState {
  // Expense form modal — null when closed. `create` mode when target is
  // undefined, `edit` mode when an existing expense is provided.
  formOpen: boolean
  formTarget: Expense | null
  openCreateForm: () => void
  openEditForm: (expense: Expense) => void
  closeForm: () => void

  // Delete confirmation — the expense pending deletion, or null.
  deleteTarget: Expense | null
  requestDelete: (expense: Expense) => void
  cancelDelete: () => void

  // List filters
  filters: ExpenseFilters
  setFilters: (patch: Partial<ExpenseFilters>) => void
  resetFilters: () => void
}

const emptyFilters: ExpenseFilters = { category: '', from: '', to: '' }

export const useUIStore = create<UIState>((set) => ({
  formOpen: false,
  formTarget: null,
  openCreateForm: () => set({ formOpen: true, formTarget: null }),
  openEditForm: (expense) => set({ formOpen: true, formTarget: expense }),
  closeForm: () => set({ formOpen: false, formTarget: null }),

  deleteTarget: null,
  requestDelete: (expense) => set({ deleteTarget: expense }),
  cancelDelete: () => set({ deleteTarget: null }),

  filters: emptyFilters,
  setFilters: (patch) =>
    set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: emptyFilters }),
}))
