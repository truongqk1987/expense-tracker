import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

export interface BarDatum {
  label: string
  value: number
}

interface BarChartProps {
  bars: BarDatum[]
  color?: string
  className?: string
  ariaLabel?: string
}

const CHART_HEIGHT = 240
// Let Recharts thin the x-axis tick labels based on the actual rendered
// width rather than a fixed numeric interval: "preserveStartEnd" always
// keeps the first & last tick, and minTickGap drops only the labels in
// between that would otherwise collide. This stays readable in narrow
// layouts (e.g. the half-width lg:grid-cols-2 chart panel) where a fixed
// interval would still overlap.

/**
 * Presentational bar-chart primitive (LOCKED: bar, not line). One bar per
 * bucket; zero-value buckets render as a zero-height bar, reading as a visual
 * gap ("no spend"). Colors are CSS-variable tokens only — never Recharts'
 * default palette — so the chart is theme-ready by construction.
 */
export function BarChart({
  bars,
  color = 'var(--color-brand)',
  className = '',
  ariaLabel,
}: BarChartProps) {
  if (bars.length === 0) return null

  const label =
    ariaLabel ??
    `Spend over time: ${bars.map((b) => `${b.label} ${b.value}`).join(', ')}`

  return (
    <div
      role="img"
      aria-label={label}
      className={className}
      style={{ width: '100%', height: CHART_HEIGHT }}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 400, height: CHART_HEIGHT }}
      >
        <RechartsBarChart
          data={bars}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={24}
            tickMargin={8}
            tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--color-line)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-faint)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
            maxBarSize={28}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
