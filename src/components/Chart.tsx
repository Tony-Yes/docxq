import { t } from "@/lib/i18n"
import { useEffect, useId, useMemo, useRef, useState } from "react"

/**
 * A line chart drawn as plain SVG. The default theme pulls in a chart library
 * for four series and a tooltip; this one is about 4 KB and, more importantly,
 * can break its line wherever the hub reported nothing.
 */

export type ChartSeries = {
  label: string
  color: string
  /** Points aligned with `rows` by index; null breaks the line. */
  points: (number | null)[]
  dash?: boolean
  /** Draw a soft fill under this series down to the baseline. */
  area?: boolean
}

export type ChartProps = {
  rows: { ts: number }[]
  series: ChartSeries[]
  height?: number
  yDomain: [number, number]
  yTicks: number[]
  xTicks: number[]
  formatY: (v: number) => string
  formatX: (ms: number) => string
  formatTip?: (v: number) => string
  /** Time series spanning more than a day get a date in the tooltip. */
  tipTime: (ms: number) => string
  /** A logarithmic value axis, for transfer rates: a rate has no meaningful zero. */
  log?: boolean
  empty?: string
}

const PAD = { top: 8, right: 10, bottom: 20, left: 46 }

export function Chart(props: ChartProps) {
  const { rows, series, height = 170, yDomain, yTicks, xTicks, formatY, formatX, formatTip, tipTime, log, empty } = props
  // Gradient ids are document-wide: two charts with the same id would both
  // paint with whichever one mounted first.
  const uid = useId().replace(/[^\w-]/g, "")
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const inner = Math.max(0, width - PAD.left - PAD.right)
  const plot = Math.max(0, height - PAD.top - PAD.bottom)
  const [from, to] = useMemo(() => {
    if (!rows.length) return [0, 1]
    return [rows[0].ts, rows[rows.length - 1].ts]
  }, [rows])

  const [lo, hi] = yDomain
  const y = (v: number) => {
    if (log) {
      const floor = lo > 0 ? lo : 1
      const t = (Math.log10(Math.max(v, floor)) - Math.log10(floor)) / (Math.log10(hi) - Math.log10(floor) || 1)
      return PAD.top + plot - Math.min(1, Math.max(0, t)) * plot
    }
    return PAD.top + plot - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1) * plot
  }
  const x = (ts: number) => PAD.left + (to === from ? inner / 2 : ((ts - from) / (to - from)) * inner)

  // One path per unbroken run, so a node that was offline draws no line across
  // the hole.
  const paths = useMemo(
    () =>
      series.map((line) => {
        const runs: string[] = []
        let run = ""
        line.points.forEach((v, i) => {
          const row = rows[i]
          if (v === null || v === undefined || !row || !Number.isFinite(v)) {
            if (run) runs.push(run)
            run = ""
            return
          }
          run += `${run ? "L" : "M"}${x(row.ts).toFixed(1)} ${y(v).toFixed(1)}`
        })
        if (run) runs.push(run)
        return { line, runs }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, rows, width, height, lo, hi, log, from, to],
  )

  const areaPath = useMemo(() => {
    const line = series.find((s) => s.area)
    if (!line || !inner) return ""
    let d = ""
    let open = false
    let lastX = "0"
    line.points.forEach((v, i) => {
      const row = rows[i]
      if (v === null || v === undefined || !row || !Number.isFinite(v)) {
        if (open) {
          d += `L${lastX} ${PAD.top + plot}Z`
          open = false
        }
        return
      }
      if (!open) {
        d += `M${x(row.ts).toFixed(1)} ${PAD.top + plot}L${x(row.ts).toFixed(1)} ${y(v).toFixed(1)}`
        open = true
      } else {
        d += `L${x(row.ts).toFixed(1)} ${y(v).toFixed(1)}`
      }
      lastX = x(row.ts).toFixed(1)
    })
    if (open) d += `L${lastX} ${PAD.top + plot}Z`
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, rows, width, height, lo, hi, log, from, to, inner])

  const move = (event: React.PointerEvent) => {
    if (!rows.length || !inner) return
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const at = event.clientX - bounds.left - PAD.left
    const ratio = Math.min(1, Math.max(0, at / inner))
    setHover(Math.round(ratio * (rows.length - 1)))
  }

  const active = hover !== null ? rows[hover] : null
  const tipLeft = active ? Math.min(Math.max(x(active.ts) - 70, 4), Math.max(4, width - 152)) : 0

  return (
    <div
      className="chart"
      ref={box}
      style={{ height }}
      onPointerMove={move}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join("、")}>
          <defs>
            {series.map((line, i) => (
              <linearGradient key={i} id={`${uid}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={line.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={line.color} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="grid" x1={PAD.left} x2={PAD.left + inner} y1={y(tick)} y2={y(tick)} />
              <text x={PAD.left - 8} y={y(tick) + 3.5} textAnchor="end">
                {formatY(tick)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <text key={tick} x={x(tick)} y={height - 5} textAnchor="middle">
              {formatX(tick)}
            </text>
          ))}

          {areaPath && series[0] && (
            <path d={areaPath} fill={`url(#${uid}-fill-0)`} stroke="none" />
          )}

          {paths.map(({ line, runs }, i) =>
            runs.map((d, j) => (
              <path
                key={`${i}-${j}`}
                d={d}
                fill="none"
                stroke={line.color}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={line.dash ? "4 3" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            )),
          )}

          {active && (
            <>
              <line className="crosshair" x1={x(active.ts)} x2={x(active.ts)} y1={PAD.top} y2={PAD.top + plot} />
              {series.map((line, i) => {
                const v = line.points[hover!]
                return v === null || v === undefined || !Number.isFinite(v) ? null : (
                  <circle key={i} cx={x(active.ts)} cy={y(v)} r={3} fill={line.color} stroke="var(--card)" strokeWidth={1.5} />
                )
              })}
            </>
          )}

          {!rows.length && empty && (
            <text className="empty-note" x={PAD.left + inner / 2} y={PAD.top + plot / 2}>
              {empty}
            </text>
          )}
        </svg>
      )}

      {active && (
        <div className="tooltip" style={{ left: tipLeft, top: 0 }}>
          <div className="tt-time">{tipTime(active.ts)}</div>
          {series.map((line, i) => {
            const v = line.points[hover!]
            return (
              <div className="tt-row" key={i} style={{ color: line.color }}>
                <i />
                <span>{line.label}</span>
                <b>{v === null || v === undefined || !Number.isFinite(v) ? t("无数据", "No data") : (formatTip ?? formatY)(v)}</b>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** The strip in a summary tile: the last minute of samples, no axes, no labels. */
export function Sparkline({ points, color, height = 34 }: { points: number[]; color: string; height?: number }) {
  const width = 120
  if (points.length < 2) return <div style={{ height }} />
  const max = Math.max(...points, 1)
  const step = width / (points.length - 1)
  const at = (i: number) => [i * step, height - (points[i] / max) * (height - 3) - 1.5] as const
  let line = `M${at(0)[0]} ${at(0)[1]}`
  for (let i = 1; i < points.length; i++) line += `L${at(i)[0].toFixed(1)} ${at(i)[1].toFixed(1)}`
  const area = `${line}L${width} ${height}L0 ${height}Z`
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <path d={area} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
