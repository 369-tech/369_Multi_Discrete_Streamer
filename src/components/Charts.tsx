import { useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { formatInr } from '../lib/format'
import { Modal } from './Modal'

const GRID = 'var(--border-soft)'
const AXIS = 'var(--text-faint)'

function Maximize2Icon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}


export const PALETTE = ['#e0a537', '#5b8def', '#34d399', '#f87171', '#b073e8', '#4ec8d8', '#f0b34a', '#8b95ab']

/**
 * Wraps any chart render function with a hover-revealed expand button
 * that opens the same chart full-screen (see components/Modal.tsx) —
 * every chart in the app gets this by going through ChartFrame, rather
 * than each page having to wire up its own modal.
 */
function ChartFrame({
  title,
  height,
  expandedHeight,
  renderChart,
}: {
  title?: string
  height: number
  expandedHeight?: number
  renderChart: (height: number) => ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="relative group/chart">
      <button
        onClick={() => setExpanded(true)}
        title="Expand chart"
        className="absolute top-0 right-0 z-10 p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] opacity-0 group-hover/chart:opacity-100 transition-opacity"
      >
        <Maximize2Icon size={14} />
      </button>
      {renderChart(height)}
      <Modal open={expanded} onClose={() => setExpanded(false)} title={title}>
        {renderChart(expandedHeight ?? Math.max(height * 2, 480))}
      </Modal>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] shadow-lg">
      <div className="text-[var(--text-muted)] mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mono">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-[var(--text-muted)]">{p.name}:</span>
          <span className="text-[var(--text)]">
            {typeof p.value === 'number' ? formatInr(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function SimpleLineChartInner({
  data,
  xKey,
  series,
  height = 260,
  valueFormatter,
}: {
  data: Record<string, any>[]
  xKey: string
  series: { key: string; name?: string; color?: string }[]
  height?: number
  valueFormatter?: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={valueFormatter ?? ((v: number) => formatInr(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name ?? s.key}
            stroke={s.color ?? PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SimpleLineChart(props: Parameters<typeof SimpleLineChartInner>[0] & { title?: string }) {
  const { title, height = 260, ...rest } = props
  return <ChartFrame title={title} height={height} renderChart={(h) => <SimpleLineChartInner {...rest} height={h} />} />
}

function SimpleBarChartInner({
  data,
  xKey,
  series,
  height = 260,
  stacked = false,
  horizontal = false,
  valueFormatter,
}: {
  data: Record<string, any>[]
  xKey: string
  series: { key: string; name?: string; color?: string }[]
  height?: number
  stacked?: boolean
  horizontal?: boolean
  valueFormatter?: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 4, right: 8, left: horizontal ? 8 : 0, bottom: 0 }}
      >
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={valueFormatter ?? ((v: number) => formatInr(v))} />
            <YAxis type="category" dataKey={xKey} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={valueFormatter ?? ((v: number) => formatInr(v))} width={64} />
          </>
        )}
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name ?? s.key}
            fill={s.color ?? PALETTE[i % PALETTE.length]}
            stackId={stacked ? 'stack' : undefined}
            radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SimpleBarChart(props: Parameters<typeof SimpleBarChartInner>[0] & { title?: string }) {
  const { title, height = 260, ...rest } = props
  return <ChartFrame title={title} height={height} renderChart={(h) => <SimpleBarChartInner {...rest} height={h} />} />
}

export function BubbleScatterChart({
  data,
  xKey,
  yKey,
  sizeKey,
  nameKey,
  height = 340,
  xLabel,
  yLabel,
}: {
  data: Record<string, any>[]
  xKey: string
  yKey: string
  sizeKey: string
  nameKey: string
  height?: number
  xLabel?: string
  yLabel?: string
}) {
  const gains = data.filter((d) => d[yKey] >= 0)
  const losses = data.filter((d) => d[yKey] < 0)
  const sizeRange = data.length ? [Math.min(...data.map((d) => d[sizeKey])), Math.max(...data.map((d) => d[sizeKey]))] : [0, 1]

  function BubbleTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] shadow-lg mono">
        <div className="text-[var(--text)] font-medium mb-1">{d[nameKey]}</div>
        <div className="text-[var(--text-muted)]">
          Value: <span className="text-[var(--text)]">{formatInr(d[xKey])}</span>
        </div>
        <div className="text-[var(--text-muted)]">
          P&amp;L: <span style={{ color: d[yKey] >= 0 ? 'var(--gain)' : 'var(--loss)' }}>{formatInr(d[yKey])}</span>
        </div>
        <div className="text-[var(--text-muted)]">
          Executions: <span className="text-[var(--text)]">{d[sizeKey]}</span>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey={xKey}
          name={xLabel ?? xKey}
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={(v: number) => formatInr(v)}
          label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, fill: AXIS, fontSize: 11 } : undefined}
        />
        <YAxis
          type="number"
          dataKey={yKey}
          name={yLabel ?? yKey}
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatInr(v)}
          width={64}
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 11 } : undefined}
        />
        <ZAxis type="number" dataKey={sizeKey} range={[60, 900]} domain={sizeRange as [number, number]} />
        <Tooltip content={<BubbleTooltip />} cursor={{ strokeDasharray: '3 3', stroke: GRID }} />
        <Scatter name="Profitable" data={gains} fill="var(--gain)" fillOpacity={0.55} stroke="var(--gain)" />
        <Scatter name="Loss-making" data={losses} fill="var(--loss)" fillOpacity={0.55} stroke="var(--loss)" />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

function SimplePieChartInner({
  data,
  dataKey,
  nameKey,
  height = 240,
}: {
  data: Record<string, any>[]
  dataKey: string
  nameKey: string
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip content={<ChartTooltip />} />
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius="55%" outerRadius="85%" paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--surface)" strokeWidth={2} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

export function SimplePieChart(props: Parameters<typeof SimplePieChartInner>[0] & { title?: string }) {
  const { title, height = 240, ...rest } = props
  return <ChartFrame title={title} height={height} renderChart={(h) => <SimplePieChartInner {...rest} height={h} />} />
}
