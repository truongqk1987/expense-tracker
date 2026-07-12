import { CATEGORIES } from '../../../lib/categories'
import { useUIStore } from '../../../stores/uiStore'
import { Select, Input, Label } from '../../../components/ui/Field'
import { Button } from '../../../components/ui/Button'

export function Filters() {
  const filters = useUIStore((s) => s.filters)
  const setFilters = useUIStore((s) => s.setFilters)
  const resetFilters = useUIStore((s) => s.resetFilters)
  const hasFilters = Boolean(filters.category || filters.from || filters.to)

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-ink">Filters</h2>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <div>
          <Label htmlFor="filter-category">Category</Label>
          <Select
            id="filter-category"
            value={filters.category}
            onChange={(e) => setFilters({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="filter-from">From</Label>
          <Input
            id="filter-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilters({ from: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="filter-to">To</Label>
          <Input
            id="filter-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters({ to: e.target.value })}
          />
        </div>
      </div>
    </section>
  )
}
