import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BarChart } from './BarChart'

describe('BarChart', () => {
  it('renders one bar per non-zero value and an empty slot for zeros', () => {
    const { container } = render(
      <BarChart
        bars={[
          { label: 'Jul 1', value: 10 },
          { label: 'Jul 2', value: 0 },
          { label: 'Jul 3', value: 5 },
        ]}
      />,
    )
    // Recharts skips rendering a rectangle for a zero-value bar entirely, so
    // only the two non-zero buckets produce a bar shape.
    expect(container.querySelectorAll('.recharts-rectangle')).toHaveLength(2)
  })

  it('renders an x-axis tick label for every bucket, including zero ones', () => {
    render(
      <BarChart
        bars={[
          { label: 'Jul 1', value: 10 },
          { label: 'Jul 2', value: 0 },
        ]}
      />,
    )
    expect(screen.getByText('Jul 1')).toBeInTheDocument()
    expect(screen.getByText('Jul 2')).toBeInTheDocument()
  })

  it('exposes role="img" and a descriptive aria-label', () => {
    render(
      <BarChart
        bars={[{ label: 'Jul 1', value: 10 }]}
        ariaLabel="Spend over time"
      />,
    )
    expect(
      screen.getByRole('img', { name: 'Spend over time' }),
    ).toBeInTheDocument()
  })

  it('colors bars from the passed token, not a Recharts default', () => {
    const { container } = render(
      <BarChart
        bars={[{ label: 'Jul 1', value: 10 }]}
        color="var(--color-brand)"
      />,
    )
    const bar = container.querySelector('.recharts-rectangle')
    expect(bar).toHaveAttribute('fill', 'var(--color-brand)')
  })

  it('renders nothing for an empty series', () => {
    const { container } = render(<BarChart bars={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('always keeps the first and last x-axis tick label for a many-bucket (rolling 30-day) series', () => {
    // Mirrors the real "spend over time" rolling-30-day window. With
    // interval="preserveStartEnd", Recharts must render the first and last
    // tick regardless of how many middle labels get thinned out to avoid
    // collisions. jsdom can't measure text width, so middle-label thinning
    // isn't reliably reproducible here — this test anchors only on the
    // preserveStartEnd guarantee.
    const bars = Array.from({ length: 30 }, (_, i) => ({
      label: `Jul ${i + 1}`,
      value: i,
    }))
    render(<BarChart bars={bars} />)
    expect(screen.getByText('Jul 1')).toBeInTheDocument()
    expect(screen.getByText('Jul 30')).toBeInTheDocument()
  })
})
