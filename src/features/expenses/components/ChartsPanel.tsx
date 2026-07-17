import { CategoryDonut } from './CategoryDonut'
import { SpendTrend } from './SpendTrend'

/**
 * Full-width charts card — category breakdown donut + spend-over-time trend.
 * Both panels are pure-derivation views over the same filtered expense set
 * `useExpenses()` returns; no new query, no server data in Zustand.
 */
export function ChartsPanel() {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryDonut />
        <SpendTrend />
      </div>
    </section>
  )
}
