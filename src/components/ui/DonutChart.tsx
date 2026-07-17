import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  className?: string
  ariaLabel?: string
}

/**
 * Presentational donut (ring pie) primitive. Colors are taken verbatim from
 * `segment.color` (a `var(--color-cat-*)` token passed by the container) —
 * never Recharts' default palette — so the chart is theme-ready by
 * construction. The not-color-alone legend is rendered by the container, not
 * here; this primitive only exposes `role="img"` + `aria-label` for
 * accessibility.
 */
export function DonutChart({
  segments,
  size = 220,
  className = '',
  ariaLabel,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (segments.length === 0 || total <= 0) return null

  const label =
    ariaLabel ??
    `Spending by category: ${segments
      .map((s) => `${s.label} ${s.value}`)
      .join(', ')}`

  return (
    <div
      role="img"
      aria-label={label}
      className={className}
      style={{ width: '100%', height: size }}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 400, height: size }}
      >
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="90%"
            paddingAngle={1}
            stroke="var(--color-surface)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {segments.map((segment) => (
              <Cell key={segment.label} fill={segment.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
