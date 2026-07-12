import { describe, expect, it } from 'vitest'
import '../test/resetStores'
import { useUIStore } from './uiStore'
import { makeExpense } from '../test/factories'

const get = () => useUIStore.getState()

describe('uiStore — expense form modal', () => {
  it('opens in create mode with no target', () => {
    get().openCreateForm()
    expect(get().formOpen).toBe(true)
    expect(get().formTarget).toBeNull()
  })

  it('opens in edit mode carrying the target expense', () => {
    const expense = makeExpense()
    get().openEditForm(expense)
    expect(get().formOpen).toBe(true)
    expect(get().formTarget).toBe(expense)
  })

  it('clears open state and target on close', () => {
    get().openEditForm(makeExpense())
    get().closeForm()
    expect(get().formOpen).toBe(false)
    expect(get().formTarget).toBeNull()
  })
})

describe('uiStore — delete confirmation', () => {
  it('sets and clears the delete target', () => {
    const expense = makeExpense()
    get().requestDelete(expense)
    expect(get().deleteTarget).toBe(expense)
    get().cancelDelete()
    expect(get().deleteTarget).toBeNull()
  })
})

describe('uiStore — filters', () => {
  it('merges a partial patch without dropping other fields', () => {
    get().setFilters({ from: '2026-07-01' })
    get().setFilters({ category: 'food' })
    expect(get().filters).toEqual({
      category: 'food',
      from: '2026-07-01',
      to: '',
    })
  })

  it('resets filters back to empty', () => {
    get().setFilters({ category: 'food', from: '2026-07-01', to: '2026-07-31' })
    get().resetFilters()
    expect(get().filters).toEqual({ category: '', from: '', to: '' })
  })
})
