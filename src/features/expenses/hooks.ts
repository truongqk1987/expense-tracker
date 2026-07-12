import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useUIStore, type ExpenseFilters } from '../../stores/uiStore'
import { toast } from '../../stores/toastStore'
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from './api'
import type { ExpenseInput } from './types'

const KEY = ['expenses'] as const

export function expensesKey(filters: ExpenseFilters) {
  return [...KEY, filters] as const
}

export function useExpenses() {
  const filters = useUIStore((s) => s.filters)
  return useQuery({
    queryKey: expensesKey(filters),
    queryFn: () => listExpenses(filters),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: KEY })
}

export function useCreateExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(input),
    onSuccess: () => {
      invalidate()
      toast.success('Expense added')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExpenseInput }) =>
      updateExpense(id, input),
    onSuccess: () => {
      invalidate()
      toast.success('Expense updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      invalidate()
      toast.success('Expense deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
