import { supabase } from '../../lib/supabase'
import type { Budget, BudgetInput } from './types'

// All queries are automatically scoped to the current user by Supabase Row
// Level Security — we never need to filter by user_id on the client.

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createBudget(input: BudgetInput): Promise<Budget> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')

  const { data, error } = await supabase
    .from('budgets')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateBudget(
  id: string,
  input: BudgetInput,
): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
