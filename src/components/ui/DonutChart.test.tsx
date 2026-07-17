import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DonutChart } from './DonutChart'

describe('DonutChart', () => {
  it('renders one arc per segment, colored from the passed token', () => {
    const { container } = render(
      <DonutChart
        segments={[
          { label: 'Food', value: 30, color: 'var(--color-cat-food)' },
          { label: 'Bills', value: 20, color: 'var(--color-cat-bills)' },
        ]}
      />,
    )
    const arcs = container.querySelectorAll('.recharts-sector')
    expect(arcs).toHaveLength(2)
    expect(arcs[0]).toHaveAttribute('fill', 'var(--color-cat-food)')
    expect(arcs[1]).toHaveAttribute('fill', 'var(--color-cat-bills)')
  })

  it('exposes role="img" and a descriptive aria-label', () => {
    render(
      <DonutChart
        segments={[{ label: 'Food', value: 10, color: 'var(--color-cat-food)' }]}
        ariaLabel="Category breakdown"
      />,
    )
    expect(
      screen.getByRole('img', { name: 'Category breakdown' }),
    ).toBeInTheDocument()
  })

  it('renders a single arc for a lone segment (a full ring)', () => {
    const { container } = render(
      <DonutChart
        segments={[{ label: 'Food', value: 42, color: 'var(--color-cat-food)' }]}
      />,
    )
    expect(container.querySelectorAll('.recharts-sector')).toHaveLength(1)
  })

  it('renders nothing for empty segments', () => {
    const { container } = render(<DonutChart segments={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when every segment value is zero', () => {
    const { container } = render(
      <DonutChart
        segments={[{ label: 'Food', value: 0, color: 'var(--color-cat-food)' }]}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
