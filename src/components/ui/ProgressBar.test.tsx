import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('sets aria-valuenow/min/max from value and max', () => {
    render(<ProgressBar value={30} max={100} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '30')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('clamps the fill width at 100% when value exceeds max', () => {
    render(<ProgressBar value={150} max={100} />)
    const bar = screen.getByRole('progressbar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.style.width).toBe('100%')
    // aria-valuenow still reports the real (uncapped) value.
    expect(bar).toHaveAttribute('aria-valuenow', '150')
  })

  it('does not go negative when value is 0', () => {
    render(<ProgressBar value={0} max={100} />)
    const bar = screen.getByRole('progressbar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('applies the danger fill class for the "over" variant', () => {
    render(<ProgressBar value={150} max={100} variant="over" />)
    const bar = screen.getByRole('progressbar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.className).toContain('bg-danger')
    expect(fill.className).not.toContain('bg-brand')
  })

  it('uses the brand fill class for the default "normal" variant', () => {
    render(<ProgressBar value={30} max={100} />)
    const bar = screen.getByRole('progressbar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill.className).toContain('bg-brand')
  })

  it('renders the optional label text', () => {
    render(<ProgressBar value={30} max={100} label="Food" />)
    expect(screen.getByText('Food')).toBeInTheDocument()
  })
})
