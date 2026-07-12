// Central list of expense categories, shared by forms, filters and the list UI.
// `color` maps to a `--color-cat-*` theme token defined in index.css.

export interface Category {
  value: string
  label: string
  color: string // CSS color value for dots/chips
}

export const CATEGORIES: Category[] = [
  { value: 'food', label: 'Food & Drink', color: 'var(--color-cat-food)' },
  { value: 'transport', label: 'Transport', color: 'var(--color-cat-transport)' },
  { value: 'shopping', label: 'Shopping', color: 'var(--color-cat-shopping)' },
  { value: 'bills', label: 'Bills & Utilities', color: 'var(--color-cat-bills)' },
  {
    value: 'entertainment',
    label: 'Entertainment',
    color: 'var(--color-cat-entertainment)',
  },
  { value: 'health', label: 'Health', color: 'var(--color-cat-health)' },
  { value: 'other', label: 'Other', color: 'var(--color-cat-other)' },
]

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [
  string,
  ...string[],
]

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.value, c]))

export function getCategory(value: string): Category {
  return (
    CATEGORY_MAP.get(value) ?? {
      value,
      label: value,
      color: 'var(--color-cat-other)',
    }
  )
}
