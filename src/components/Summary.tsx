import { t } from "@/lib/i18n"
import { useMemo } from "react"

import type { Node } from "@/lib/api"
import { bytes, rate } from "@/lib/format"
import type { Table } from "@/lib/fx"
import { Sparkline } from "@/components/Chart"
import { IconActivity, IconArrowDown, IconArrowUp, IconArrows, IconGauge, IconServer } from "@/components/icons"

/**
 * The five tiles above the list. They describe whatever the page is currently
 * showing -- the whole fleet, or the group whose tab is selected -- because a
 * visitor who narrowed the list expects the numbers to narrow with it.
 */

const busy = (nodes: Node[]) =>
  nodes.reduce<Node | null>((worst, n) => {
    if (!n.online || !n.metrics) return worst
    return !worst || n.metrics.cpu > (worst.metrics?.cpu ?? 0) ? n : worst
  }, null)

/** This period's usage as the plan meters it: some plans count only one direction. */
export function monthUsage(node: Node): number {
  if (typeof node.month_used === "number") return node.month_used
  const rx = node.month_rx ?? 0
  const tx = node.month_tx ?? 0
  return node.traffic_mode === "up" ? tx : node.traffic_mode === "down" ? rx : rx + tx
}

export type SummaryProps = {
  nodes: Node[]
  /** What the tiles are counting: the whole fleet, a group, or a search result. */
  scope: string
  speed: { rx: number; tx: number }[]
  /** The currency the remaining value is shown in, from the theme settings. */
  currency: string
  /** Exchange rates, or null when the lookup failed and no manual table was given. */
  fx: Table | null
}

export function Summary({ nodes, speed }: SummaryProps) {
  const stats = useMemo(() => {
    let online = 0
    let rx = 0
    let tx = 0
    let dayRx = 0
    let dayTx = 0
    let month = 0
    let total = 0
    for (const n of nodes) {
      if (n.online) online++
      if (n.online && n.metrics) {
        rx += n.metrics.net_rx
        tx += n.metrics.net_tx
      }
      dayRx += n.day_rx ?? 0
      dayTx += n.day_tx ?? 0
      month += (n.month_rx ?? 0) + (n.month_tx ?? 0)
      total += (n.total_rx ?? 0) + (n.total_tx ?? 0)
    }
    return {
      online,
      rx,
      tx,
      dayRx,
      dayTx,
      month,
      total,
      worst: busy(nodes),
    }
  }, [nodes])

  const rxSeries = speed.map((s) => s.rx)
  const txSeries = speed.map((s) => s.tx)
  // A site with no nodes, or none online yet, has no peak to report: the tile
  // says so rather than printing a rounded-up zero.
  const peak = Math.max(stats.rx, stats.tx, ...rxSeries, ...txSeries)

  return (
    <div className="summary">
      <div className="tile">
        <div className="tile-label">
          <IconServer />
          {t("在线节点", "Online nodes")}
        </div>
        <div className="tile-value">
          <span>{stats.online}</span>
          <small> / {nodes.length}</small>
        </div>
        <div className="tile-label tile-section-label"><IconServer />{t("离线节点", "Offline nodes")}</div>
        <div className="tile-value"><span>{nodes.length - stats.online}</span><small> {t("台", "nodes")}</small></div>
        <div className="tile-foot">{t("节点状态实时更新", "Node status updates live")}</div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconActivity />
          {t("CPU 占用", "CPU usage")}
        </div>
        <div className="tile-value">
          {stats.worst?.metrics ? <><span>{Math.round(stats.worst.metrics.cpu)}</span><small>%</small></> : <span>—</span>}
        </div>
        <div className="tile-label tile-section-label" title={t("CPU 占用最高节点最近 1 分钟的系统平均负载", "1-minute system load of the node with the highest CPU usage")}><IconGauge />{t("平均负载", "Average load")}</div>
        <div className="tile-value">{stats.worst?.metrics ? stats.worst.metrics.load[0].toFixed(2) : "—"}</div>
        <div className="tile-foot">
          {stats.worst
            ? stats.worst.name
            : t("没有在线节点", "No online nodes")}
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconArrowDown />
          {t("实时下行", "Download speed")}
        </div>
        <div className="tile-value">{rate(stats.rx)}</div>
        <div className="tile-label tile-section-label"><IconArrowUp />{t("实时上行", "Upload speed")}</div>
        <div className="tile-value">{rate(stats.tx)}</div>
        <div className="tile-spark">
          <Sparkline points={rxSeries} color="var(--accent)" height={26} />
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">
          <IconArrowDown />
          {t("今日下载", "Downloaded today")}
        </div>
        <div className="tile-value">{bytes(stats.dayRx)}</div>
        <div className="tile-label tile-section-label"><IconArrowUp />{t("今日上传", "Uploaded today")}</div>
        <div className="tile-value">{bytes(stats.dayTx)}</div>
        <div className="tile-foot">
          {peak > 0
            ? `${t("今日峰值", "Peak today")} ${rate(peak)}`
            : stats.dayRx + stats.dayTx > 0
              ? t("节点离线，没有实时峰值", "Nodes offline; no live peak")
              : t("还没有流量记录", "No traffic recorded yet")}
        </div>
      </div>

      <div className="tile tile-traffic">
        <div className="tile-label">
          <IconGauge />
          {t("本月流量", "Monthly traffic")}
        </div>
        <div className="tile-value">{bytes(stats.month)}</div>
        <div className="tile-label tile-section-label">
          <IconArrows />
          {t("累计流量", "Total traffic")}
        </div>
        <div className="tile-value">{bytes(stats.total)}</div>
        <div className="tile-foot">{t("上传与下载合计", "Upload and download combined")}</div>
      </div>

    </div>
  )
}

/** A bar with its own colour band, used by both the card and the detail page. */
export function Meter({ label, value, used, total, hint }: { label: string; value: number; used: string; total?: string; hint?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const level = pct >= 90 ? "danger" : pct >= 75 ? "warn" : ""
  return (
    <div className="meter">
      <div className="meter-top">
        <span>{label}</span>
        <b>{Math.round(value)}%</b>
      </div>
      <div className="meter-bar">
        <i className={level} style={{ width: `${pct}%` }} />
      </div>
      <div className="meter-foot">{hint ?? (total ? `${used} / ${total}` : used)}</div>
    </div>
  )
}
