import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from '../../stores/toastStore'
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
} from './api'
import type { BudgetInput } from './types'

const KEY = ['budgets'] as const

export function budgetsKey() {
  return [...KEY] as const
}

export function useBudgets() {
  return useQuery({
    queryKey: budgetsKey(),
    queryFn: () => listBudgets(),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: KEY })
}

export function useCreateBudget() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: BudgetInput) => createBudget(input),
    onSuccess: () => {
      invalidate()
      toast.success('Budget saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateBudget() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BudgetInput }) =>
      updateBudget(id, input),
    onSuccess: () => {
      invalidate()
      toast.success('Budget updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteBudget() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      invalidate()
      toast.success('Budget removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
