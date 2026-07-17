import type { HTMLAttributes } from 'react'

type Variant = 'normal' | 'over'

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  max: number
  variant?: Variant
  label?: string
}

const variants: Record<Variant, string> = {
  normal: 'bg-brand',
  over: 'bg-danger',
}

export function ProgressBar({
  value,
  max,
  variant = 'normal',
  label,
  className = '',
  ...rest
}: ProgressBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0
  // Clamp the visual fill at 100% even when over budget.
  const width = Math.min(100, Math.max(0, pct))

  return (
    <div className={className} {...rest}>
      {label && <p className="mb-1 text-xs text-muted">{label}</p>}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={`h-full rounded-full transition-[width] ${variants[variant]}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
