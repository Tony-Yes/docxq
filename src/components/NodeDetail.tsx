import { t } from "@/lib/i18n"
import { useEffect, useMemo, useState } from "react"

import { api, type Node } from "@/lib/api"
import { CountryFlag } from "@/components/CountryFlag"
import {
  axisBytes,
  axisTop,
  bytes,
  clockFor,
  cycle,
  date,
  daysUntil,
  despike,
  FOREVER,
  money,
  osName,
  pair,
  percent,
  quarters,
  rate,
  rateAxis,
  RATE_FLOOR,
  sinceSeen,
  smooth,
  span,
  tickClock,
  timeTicks,
  uptime,
  withGaps,
} from "@/lib/format"
import { Chart, type ChartSeries } from "@/components/Chart"
import { IconChevronLeft, IconFilter, IconSmooth } from "@/components/icons"

/* ------------------------------------------------------------------ 数据 */

type Row = {
  ts: number
  cpu: number
  cpu_max?: number
  mem_used: number
  swap_used: number
  disk_used: number
  net_rx: number
  net_tx: number
  net_rx_max?: number
  net_tx_max?: number
  tcp: number
  udp: number
  procs: number
  minutes: number
}

type PingRow = { task_id: string; ts: number; latency: number | null; band?: [number, number]; loss?: number }

/**
 * The history endpoint answers both series in one object, whichever ones were
 * asked for: the ones left out come back as empty arrays. `step` is the seconds
 * each point spans, sent rather than inferred so a window holding a single point
 * still has one.
 */
type History = {
  metrics: Row[]
  ping: PingRow[]
  probes: Record<string, string>
  loss: Record<string, number>
  step: number
}

/** A hub that answers with something else must not take the page down with it. */
const rowsOf = (data: History | null): History => ({
  metrics: Array.isArray(data?.metrics) ? data.metrics : [],
  ping: Array.isArray(data?.ping) ? data.ping : [],
  probes: data?.probes && typeof data.probes === "object" ? data.probes : {},
  loss: data?.loss && typeof data.loss === "object" ? data.loss : {},
  step: typeof data?.step === "number" && data.step > 0 ? data.step : 60,
})

/** A row's field as a finite number, or null: a gap row has no fields at all. */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** Used over total as a percentage, or null when either is missing. */
const share = (used: unknown, total: number): number | null => {
  const v = num(used)
  return v === null ? null : percent(v, total)
}

/** One attempt's worth of rows, discarded when the window or the tab changes under it. */
function useSeries<T>(id: number, hours: number, series: "metrics" | "ping", points: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // A result that lands after the window changed describes a chart nobody is
    // looking at any more, and would redraw the axes of the new one.
    let live = true
    setLoading(true)
    api<T>(`/nodes/${id}/metrics?hours=${hours}&points=${points}&series=${series}`)
      .then((next) => {
        if (!live) return
        setData(next)
        setError(null)
      })
      .catch((e: Error) => {
        if (!live) return
        setError(e.message)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [id, hours, series, points])

  return { data, error, loading }
}

/** Enough points for the pixels available, within what the hub accepts. */
function usePointCount() {
  const [points, setPoints] = useState(() => count())
  useEffect(() => {
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setPoints(count()))
    }
    addEventListener("resize", sync)
    return () => {
      removeEventListener("resize", sync)
      cancelAnimationFrame(frame)
    }
  }, [])
  return points
}

const count = () => Math.min(1440, Math.max(60, Math.round((innerWidth * (devicePixelRatio || 1)) / 2)))

/* ------------------------------------------------------------------ 页面 */

const PALETTE = ["var(--accent)", "#e08a3c", "#2f9e6e", "#b45bd0", "#d05a5a", "#4a86d8", "#8a8f2f"]

export type DetailProps = {
  node: Node | null
  hours: number
  windows: { hours: number; label: string }[]
  onHours: (hours: number) => void
  onBack: () => void
}

type Tab = "resources" | "latency"

export function NodeDetail({ node, hours, windows, onHours, onBack }: DetailProps) {
  const [tab, setTab] = useState<Tab>("resources")
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  // Smoothing is a reading aid, not a setting: it lives with the tab that uses
  // it and is off until asked for, so the raw readings stay the default.
  // Two different jobs, so two switches: averaging softens the whole line,
  // despiking only removes the readings that jump out of their neighbourhood.
  const [avg, setAvg] = useState(false)
  const [spike, setSpike] = useState(false)
  const points = usePointCount()

  if (!node) {
    return (
      <>
        <div className="doc-head">
          <div className="crumb">
            <a href="/" onClick={(e) => { e.preventDefault(); onBack() }}>{t("首页", "Home")}</a>
            <span className="sep">/</span>
            <span>{t("节点", "Nodes")}</span>
          </div>
          <h1 className="doc-title">{t("找不到这个节点", "Node not found")}</h1>
        </div>
        <div className="empty-state">{t("它可能已被删除，或者不属于这个站点。", "It may have been removed or does not belong to this site.")}</div>
      </>
    )
  }

  const m = node.metrics
  const left = node.expires_in !== undefined ? node.expires_in : daysUntil(node.expires_at)

  return (
    <>
      <div className="back-bar">
        <button type="button" className="back-btn" onClick={onBack}>
          <IconChevronLeft width={15} height={15} />
          {t("返回节点列表", "Back to nodes")}
        </button>
      </div>

      <div className="doc-head">
        <div className="crumb">
          <a href="/" onClick={(e) => { e.preventDefault(); onBack() }}>
            {t("首页", "Home")}
          </a>
          <span className="sep">/</span>
          <span>{t("节点", "Nodes")}</span>
          <span className="sep">/</span>
          <span>{node.name}</span>
        </div>
        <h1 className="doc-title">
          <CountryFlag country={node.country} />
          {node.name}
        </h1>
        <p className="doc-lead">
          {node.online
            ? m
              ? t(`在线，已运行 ${uptime(m.uptime)}。`, `Online, uptime ${uptime(m.uptime)}.`)
              : t("已连接，正在等待第一份指标。", "Connected; waiting for the first metrics.")
            : node.last_seen_ago === null
              ? t("这个节点还没有安装 agent，或从未上报过。", "The agent is not installed or has never reported.")
              : t(`离线，上次上报于 ${span(sinceSeen(node))}前。`, `Offline, last reported ${span(sinceSeen(node))} ago.`)}
        </p>
      </div>

      <Facts node={node} left={left} />

      <section className="section" id="charts">
        <div className="toolbar">
          <div className="tabs" role="group" aria-label={t("指标类型", "Metric type")}>
            <button className="tab" aria-pressed={tab === "resources"} onClick={() => setTab("resources")}>
              {t("资源", "Resources")}
            </button>
            <button className="tab" aria-pressed={tab === "latency"} onClick={() => setTab("latency")}>
              {t("网络延迟", "Network latency")}
            </button>
          </div>
          <div className="right">
            {tab === "latency" ? (
              <div className="aids" role="group" aria-label={t("曲线处理", "Chart processing")}>
                <button
                  type="button"
                  className="tab tab-icon"
                  aria-pressed={avg}
                  onClick={() => setAvg((on) => !on)}
                  title={t("用相邻几次探测的平均值画线，抹掉抖动，整条曲线都会变平缓", "Average nearby samples to smooth fluctuations across the curve")}
                >
                  <IconSmooth width={13} height={13} />
                  {t("平滑", "Smooth")}
                </button>
                <button
                  type="button"
                  className="tab tab-icon"
                  aria-pressed={spike}
                  onClick={() => setSpike((on) => !on)}
                  title={t("只把孤立的尖峰换成邻近点的中位数，其余读数原样保留", "Replace isolated spikes with the local median; keep other readings unchanged")}
                >
                  <IconFilter width={13} height={13} />
                  {t("削峰", "Remove spikes")}
                </button>
              </div>
            ) : null}
            <div className="tabs" role="group" aria-label={t("时间范围", "Time range")}>
              {windows.map((w) => (
                <button key={w.hours} className="tab" aria-pressed={hours === w.hours} onClick={() => onHours(w.hours)}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tab === "resources" ? (
          <ResourceCharts node={node} hours={hours} points={points} />
        ) : (
          <LatencyCharts
            node={node}
            hours={hours}
            points={points}
            hidden={hidden}
            setHidden={setHidden}
            avg={avg}
            spike={spike}
          />
        )}
      </section>
    </>
  )
}

/* --------------------------------------------------------------- 事实表 */

function Facts({ node, left }: { node: Node; left: number | null }) {
  const m = node.metrics
  const facts: { label: string; value: string; mono?: boolean }[] = []

  if (node.os) facts.push({ label: t("操作系统", "Operating system"), value: osName(node.os) })
  if (node.cpu_name) facts.push({ label: t("处理器", "Processor"), value: node.cpu_name })
  if (node.cpu_cores) facts.push({ label: t("核心数", "CPU cores"), value: `${node.cpu_cores} ${t("核", "cores")}` })
  if (node.arch) facts.push({ label: t("架构", "Architecture"), value: node.arch })
  if (node.kernel) facts.push({ label: t("内核", "Kernel"), value: node.kernel, mono: true })
  if (node.virt) facts.push({ label: t("虚拟化", "Virtualization"), value: node.virt })
  if (node.group) facts.push({ label: t("分组", "Groups"), value: node.group })
  if (node.agent_version) facts.push({ label: "agent", value: node.agent_version, mono: true })
  if (m) facts.push({ label: t("内存", "Memory"), value: pair(m.mem_used, m.mem_total) })
  if (m) facts.push({ label: t("硬盘", "Disk"), value: pair(m.disk_used, m.disk_total) })
  if (m && m.swap_total > 0) facts.push({ label: t("交换分区", "Swap"), value: pair(m.swap_used, m.swap_total) })
  if (m) facts.push({ label: t("连接数", "Connections"), value: `TCP ${m.tcp} · UDP ${m.udp}` })
  if (m) facts.push({ label: t("进程数", "Processes"), value: String(m.procs) })
  if (node.price > 0) {
    facts.push({ label: t("价格", "Price"), value: `${money(node.price, node.currency || "CNY")} / ${cycle(node.billing_cycle || "monthly")}` })
  } else {
    facts.push({ label: t("价格", "Price"), value: t("免费", "Free") })
  }
  if (node.expires_at) {
    facts.push({
      label: t("到期", "Expires"),
      value: `${date(node.expires_at)}${left === null ? "" : left < 0 ? t(`（已过期 ${-left} 天）`, ` (expired ${-left} days ago)`) : t(`（还有 ${left} 天）`, ` (${left} days left)`)}`,
    })
  } else if (left === null) {
    facts.push({ label: t("到期", "Expires"), value: t(FOREVER, "Unlimited") })
  }
  if (node.traffic_limit > 0) facts.push({ label: t("流量上限", "Traffic limit"), value: bytes(node.traffic_limit) })
  facts.push({ label: t("本月流量", "Monthly traffic"), value: bytes((node.month_rx ?? 0) + (node.month_tx ?? 0)) })
  facts.push({ label: t("累计流量", "Total traffic"), value: bytes((node.total_rx ?? 0) + (node.total_tx ?? 0)) })

  if (!facts.length) return null
  return (
    <dl className="facts" id="summary">
      {facts.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd className={f.mono ? "mono" : undefined} title={f.value}>
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------- 资源图表 */

function ResourceCharts({ node, hours, points }: { node: Node; hours: number; points: number }) {
  const { data, error, loading } = useSeries<History>(node.id, hours, "metrics", points)
  const history = useMemo(() => rowsOf(data), [data])
  const m = node.metrics

  // A row the hub sent without a usable stamp cannot be placed on the time
  // axis, and one field of the wrong type must not blank the whole chart.
  const rows = useMemo(
    () =>
      history.metrics
        .filter((r) => r && Number.isFinite(r.ts) && r.ts > 0)
        .map((r) => ({ ...r, ts: r.ts * 1000 }))
        .sort((a, b) => a.ts - b.ts),
    [history],
  )
  const gaps = useMemo(() => withGaps(rows) as Row[], [rows])
  const ticks = useMemo(() => timeTicks(rows[0]?.ts ?? Date.now() - hours * 3600_000, rows.at(-1)?.ts ?? Date.now()), [rows, hours])
  const formatX = useMemo(() => tickClock(ticks, hours), [ticks, hours])
  const tipTime = useMemo(() => clockFor(hours), [hours])

  if (error) return <div className="alert danger">{error}</div>
  if (loading && !data) return <Skeleton />
  if (!rows.length) return <div className="empty-state">{t("这段时间没有历史数据。可能是 hub 尚未积累，或节点一直离线。", "No history for this period. The hub may not have collected data yet or the node was offline.")}</div>

  const total = m?.mem_total ?? node.mem_total
  const disk = m?.disk_total ?? node.disk_total
  const peak = Math.max(...rows.map((r) => Math.max(num(r.cpu) ?? 0, num(r.cpu_max) ?? 0)), 10)
  const cpuTop = axisTop(peak, 25, 100)

  // An older hub reports no `cpu_max` at all; the legend then has one entry
  // rather than an empty line. A gap row carries only `ts`, so every series
  // reads through `num`, which turns a missing or mistyped field into a break
  // instead of an NaN that would erase the whole path.
  const hasPeak = rows.some((r) => typeof r.cpu_max === "number")
  const charts: { key: string; title: string; series: ChartSeries[]; domain: [number, number]; yticks: number[]; fmt: (v: number) => string }[] = [
    {
      key: "cpu",
      title: t("CPU 使用率", "CPU usage"),
      series: [
        { label: t("平均", "Average"), color: "var(--accent)", points: gaps.map((r) => num((r as Row).cpu)), area: true },
        ...(hasPeak
          ? [{ label: t("峰值", "Peak"), color: "var(--fg-faint)", points: gaps.map((r) => num((r as Row).cpu_max)), dash: true }]
          : []),
      ],
      domain: [0, cpuTop],
      yticks: quarters(cpuTop),
      fmt: (v) => `${Math.round(v)}%`,
    },
  ]

  if (total > 0) {
    charts.push({
      key: "mem",
      title: t("内存使用率", "Memory usage"),
      series: [{ label: t("已用", "Used"), color: "var(--accent)", points: gaps.map((r) => share((r as Row).mem_used, total)), area: true }],
      domain: [0, 100],
      yticks: quarters(100),
      fmt: (v) => `${Math.round(v)}%`,
    })
  }

  if (disk > 0) {
    charts.push({
      key: "disk",
      title: t("硬盘使用率", "Disk usage"),
      series: [{ label: t("已用", "Used"), color: "var(--accent)", points: gaps.map((r) => share((r as Row).disk_used, disk)), area: true }],
      domain: [0, 100],
      yticks: quarters(100),
      fmt: (v) => `${Math.round(v)}%`,
    })
  }

  const netPeak = Math.max(...rows.map((r) => Math.max(num(r.net_rx) ?? 0, num(r.net_tx) ?? 0, num(r.net_rx_max) ?? 0, num(r.net_tx_max) ?? 0)), RATE_FLOOR * 2)
  const net = rateAxis(RATE_FLOOR, netPeak)
  charts.push({
    key: "net",
    title: t("网络速率", "Network speed"),
    series: [
      { label: t("下行", "Download"), color: "var(--accent)", points: gaps.map((r) => num((r as Row).net_rx)) },
      { label: t("上行", "Upload"), color: "#e08a3c", points: gaps.map((r) => num((r as Row).net_tx)) },
    ],
    domain: net.domain,
    yticks: net.ticks,
    fmt: axisBytes,
  })

  return (
    <>
      {charts.map((c) => (
        <div className="chart-card" key={c.key}>
          <div className="chart-head">
            <h4>{c.title}</h4>
            <div className="legend">
              {c.series.map((s) => (
                <span key={s.label}>
                  <i className={s.dash ? "dash" : undefined} style={{ color: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <Chart
            rows={gaps}
            series={c.series}
            yDomain={c.domain}
            yTicks={c.yticks}
            xTicks={ticks}
            formatY={c.fmt}
            formatX={formatX}
            formatTip={c.key === "net" ? rate : c.fmt}
            tipTime={tipTime}
            log={c.key === "net"}
            empty={t("没有数据", "No data")}
          />
        </div>
      ))}
    </>
  )
}

/* ------------------------------------------------------------- 延迟图表 */

function LatencyCharts({
  node,
  hours,
  points,
  hidden,
  setHidden,
  avg,
  spike,
}: {
  node: Node
  hours: number
  points: number
  hidden: Set<string>
  setHidden: (next: Set<string>) => void
  avg: boolean
  spike: boolean
}) {
  const { data, error, loading } = useSeries<History>(node.id, hours, "ping", points)
  const history = useMemo(() => rowsOf(data), [data])

  const ids = useMemo(() => {
    const seen: string[] = []
    for (const row of history.ping) {
      if (!row || !Number.isFinite(row.ts)) continue
      if (!seen.includes(row.task_id)) seen.push(row.task_id)
    }
    return seen
  }, [history])

  const shown = ids.filter((id) => !hidden.has(id))
  const times = useMemo(() => [...new Set(history.ping.map((r) => r.ts))].filter((t) => Number.isFinite(t)).sort((a, b) => a - b), [history])
  const ticks = useMemo(() => timeTicks(times[0] ? times[0] * 1000 : Date.now() - hours * 3600_000, times.at(-1) ? times.at(-1)! * 1000 : Date.now()), [times, hours])
  const formatX = useMemo(() => tickClock(ticks, hours), [ticks, hours])
  const tipTime = useMemo(() => clockFor(hours), [hours])

  if (error) return <div className="alert danger">{error}</div>
  if (loading && !data) return <Skeleton />
  if (!ids.length) return <div className="empty-state">{t("这段时间没有延迟记录。延迟监控需要在面板里配置探测任务。", "No latency history for this period. Configure probe tasks in the admin panel.")}</div>

  // Despiking runs before smoothing: a spike removed from a raw series leaves
  // its neighbours untouched, whereas averaging first would spread the spike
  // over five points and the filter would no longer see one outlier.
  // Neither touches the nulls: a failed probe is a hole, not a high reading.
  const series: ChartSeries[] = shown.map((id) => {
    const byTime = new Map<number, number | null>()
    for (const row of history.ping) if (row.task_id === id) byTime.set(row.ts * 1000, typeof row.latency === "number" ? row.latency : null)
    const raw = times.map((t) => byTime.get(t * 1000) ?? null)
    const spiked = spike ? despike(raw) : raw
    const points = avg ? smooth(spiked) : spiked
    return {
      label: history.probes[id] || id,
      color: PALETTE[ids.indexOf(id) % PALETTE.length],
      points,
    }
  })

  const values = series.flatMap((s) => s.points).filter((v): v is number => typeof v === "number")
  const top = axisTop(Math.max(...values, 20), 50, 100_000)
  const rows = times.map((t) => ({ ts: t * 1000 }))

  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else if (ids.length > next.size + 1) next.add(id)
    setHidden(next)
  }

  return (
    <>
      <div className="chart-card">
        <div className="chart-head">
          <h4>{t("延迟", "Latency")}</h4>
          <div className="legend">
            <span>毫秒，越低越好{spike ? t(" · 已削峰", " · Spikes removed") : ""}{avg ? t(" · 已平滑", " · Smoothed") : ""}</span>
          </div>
        </div>
        <Chart
          rows={rows}
          series={series}
          height={220}
          yDomain={[0, top]}
          yTicks={quarters(top)}
          xTicks={ticks}
          formatY={(v) => `${Math.round(v)}`}
          formatTip={(v) => `${v.toFixed(1)} ms`}
          formatX={formatX}
          tipTime={tipTime}
          empty={t("没有延迟数据", "No latency data")}
        />
      </div>

      <div className="probes">
        {ids.map((id) => {
          // `loss` is already a percentage of the window, not a fraction: the
          // hub divides by the sample count before sending it. Clamped so a
          // broken hub cannot print 1607%.
          const raw = num(history.loss[id])
          const loss = raw === null ? 0 : Math.min(100, Math.max(0, raw))
          const on = !hidden.has(id)
          return (
            <button key={id} className="probe" aria-pressed={on} onClick={() => toggle(id)} title={on ? t("点击隐藏", "Click to hide") : t("点击显示", "Click to show")}>
              <i style={{ background: PALETTE[ids.indexOf(id) % PALETTE.length], opacity: on ? 1 : 0.3 }} />
              {history.probes[id] || id}
              {loss > 0 ? (
                <span className="loss">{t("丢包", "Loss")} {loss < 1 ? "<1" : Math.round(loss)}%</span>
              ) : null}
            </button>
          )
        })}
      </div>

    </>
  )
}

function Skeleton() {
  return (
    <div className="chart-card">
      <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 170 }} />
    </div>
  )
}
