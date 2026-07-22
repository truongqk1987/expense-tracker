import { supabase } from '../../lib/supabase'
import type { ExpenseFilters } from '../../stores/uiStore'
import type { Expense, ExpenseInput } from './types'

// All queries are automatically scoped to the current user by Supabase Row
// Level Security — we never need to filter by user_id on the client.

export async function listExpenses(filters: ExpenseFilters): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*')
    .order('spent_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.from) query = query.gte('spent_at', filters.from)
  if (filters.to) query = query.lte('spent_at', filters.to)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')

  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createExpenses(inputs: ExpenseInput[]): Promise<Expense[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')

  const rows = inputs.map((input) => ({ ...input, user_id: user.id }))

  const { data, error } = await supabase.from('expenses').insert(rows).select()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
