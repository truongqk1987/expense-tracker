import { create } from 'zustand'
import type { Expense } from '../features/expenses/types'
import type { Budget } from '../features/budgets/types'

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

  // Budget form modal — null when closed. `create` mode when target is
  // undefined, `edit` mode when an existing budget is provided.
  budgetFormOpen: boolean
  budgetTarget: Budget | null
  openCreateBudget: () => void
  openEditBudget: (budget: Budget) => void
  closeBudgetForm: () => void

  // Budget delete confirmation — the budget pending deletion, or null.
  budgetDeleteTarget: Budget | null
  requestBudgetDelete: (budget: Budget) => void
  cancelBudgetDelete: () => void
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

  budgetFormOpen: false,
  budgetTarget: null,
  openCreateBudget: () => set({ budgetFormOpen: true, budgetTarget: null }),
  openEditBudget: (budget) =>
    set({ budgetFormOpen: true, budgetTarget: budget }),
  closeBudgetForm: () => set({ budgetFormOpen: false, budgetTarget: null }),

  budgetDeleteTarget: null,
  requestBudgetDelete: (budget) => set({ budgetDeleteTarget: budget }),
  cancelBudgetDelete: () => set({ budgetDeleteTarget: null }),
}))
