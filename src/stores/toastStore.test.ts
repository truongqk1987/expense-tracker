import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/resetStores'
import { toast, useToastStore } from './toastStore'

const get = () => useToastStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('toastStore', () => {
  it('appends a toast with the given kind, message and a unique id', () => {
    get().push('success', 'Saved')
    get().push('error', 'Nope')

    const toasts = get().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0]).toMatchObject({ kind: 'success', message: 'Saved' })
    expect(toasts[1]).toMatchObject({ kind: 'error', message: 'Nope' })
    expect(toasts[0].id).not.toBe(toasts[1].id)
  })

  it('auto-dismisses a toast after 3.5s', () => {
    get().push('success', 'Saved')
    expect(get().toasts).toHaveLength(1)

    vi.advanceTimersByTime(3499)
    expect(get().toasts).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(get().toasts).toHaveLength(0)
  })

  it('dismiss removes only the matching toast', () => {
    get().push('success', 'A')
    get().push('success', 'B')
    const [first, second] = get().toasts

    get().dismiss(first.id)

    expect(get().toasts).toHaveLength(1)
    expect(get().toasts[0].id).toBe(second.id)
  })

  it('the toast helper pushes the correct kind', () => {
    toast.success('yay')
    toast.error('boo')
    expect(get().toasts.map((t) => t.kind)).toEqual(['success', 'error'])
  })
})
