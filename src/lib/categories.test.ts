import { describe, expect, it } from 'vitest'
import { CATEGORIES, CATEGORY_VALUES, getCategory } from './categories'

describe('getCategory', () => {
  it('returns the matching category for a known value', () => {
    const food = getCategory('food')
    expect(food.value).toBe('food')
    expect(food.label).toBe('Food & Drink')
  })

  it('falls back to a synthetic "other"-colored entry for an unknown value', () => {
    // Guards the SummaryCards top-category path for legacy/removed categories.
    const unknown = getCategory('legacy-category')
    expect(unknown.label).toBe('legacy-category')
    expect(unknown.color).toBe('var(--color-cat-other)')
  })
})

describe('CATEGORY_VALUES', () => {
  it('lists exactly the values in CATEGORIES (keeps the Zod enum in sync)', () => {
    expect(CATEGORY_VALUES).toEqual(CATEGORIES.map((c) => c.value))
  })

  it('has no duplicate values', () => {
    expect(new Set(CATEGORY_VALUES).size).toBe(CATEGORY_VALUES.length)
  })
})
