import { t, useLanguage } from "@/lib/i18n"
import { memo } from "react"

import type { Node } from "@/lib/api"
import { bytes, cycle, daysUntil, money, osName, percent, rate, sinceSeen, span, uptime } from "@/lib/format"
import { CountryFlag } from "@/components/CountryFlag"
import { IconArrowDown, IconArrowUp, IconChevronRight } from "@/components/icons"
import { Meter, monthUsage } from "@/components/Summary"

/**
 * The "one big card" layout: every node in the group lives inside a single
 * bordered card, one hairline-separated row each, so a visitor reads the group
 * as one document rather than a wall of tiles. The columns are the same facts
 * the small card carries, in the same order, so switching layouts loses nothing.
 */

const deployed = (node: Node) => node.cpu_cores > 0 || node.mem_total > 0

/** Days left, from the hub's calendar where it says so, else from the browser's clock. */
function remaining(node: Node): number | null {
  if (node.expires_in !== undefined) return node.expires_in
  return daysUntil(node.expires_at)
}

function Status({ node }: { node: Node }) {
  const never = node.last_seen_ago === null
  if (node.online) {
    return (
      <span className="status on">
        <i className="dot" />
        {node.metrics ? t("在线", "Online") : t("已连接", "Connected")}
      </span>
    )
  }
  return (
    <span className={never ? "status never" : "status"}>
      <i className="dot" />
      {never ? t("未接入", "Not connected") : `${t("离线", "Offline")} ${span(sinceSeen(node))}`}
    </span>
  )
}

const Row = memo(function Row({
  node,
  usage,
  price,
  remark,
  onOpen,
}: {
  node: Node
  usage: boolean
  price: boolean
  remark: boolean
  onOpen: (id: number) => void
}) {
  const m = node.metrics
  useLanguage()
  const left = remaining(node)
  const expired = left !== null && left < 0
  const soon = left !== null && left >= 0 && left <= 7
  const quota = node.traffic_limit > 0 ? percent(monthUsage(node), node.traffic_limit) : null
  const seen = sinceSeen(node)
  const never = node.last_seen_ago === null

  return (
    <button type="button" className="panel-row" onClick={() => onOpen(node.id)} aria-label={`${node.name} ${t("详情", "details")}`}>
      <div className="panel-identity">
        <div className="card-title">
          <CountryFlag country={node.country} />
          <h3>{node.name}</h3>
        </div>
        <div className="card-sub">
          {deployed(node)
            ? [osName(node.os ?? ""), node.cpu_cores > 0 ? `${node.cpu_cores} ${t("核", "cores")}` : "", node.arch ?? ""].filter(Boolean).join(" · ")
            : t("尚未上报硬件信息", "Hardware not reported yet")}
        </div>
        {remark && node.public_remark ? <p className="remark">{node.public_remark}</p> : null}
        <div className="panel-status">
          <Status node={node} />
          {m ? (
            <>
              <span className="io" title={t("下行", "Download")}>
                <IconArrowDown width={12} height={12} />
                {rate(m.net_rx)}
              </span>
              <span className="io" title={t("上行", "Upload")}>
                <IconArrowUp width={12} height={12} />
                {rate(m.net_tx)}
              </span>
            </>
          ) : null}
          {/* Its own line, always: sitting beside the rates, this line fits or
              does not fit depending on how wide the numbers happen to be that
              second, and the whole block jumps up and down as traffic changes. */}
          {m && node.online && m.uptime ? (
            <span className="io uptime">{t("已运行", "Uptime")} {uptime(m.uptime)}</span>
          ) : null}
        </div>
      </div>

      <div className="panel-meters">
        {m && usage ? (
          <>
            <Meter label="CPU" value={m.cpu} used={`${Math.round(m.cpu)}%`} hint={`${t("负载", "Load")} ${m.load[0].toFixed(2)}`} />
            <Meter label={t("内存", "Memory")} value={percent(m.mem_used, m.mem_total)} used={bytes(m.mem_used)} total={bytes(m.mem_total)} />
            <Meter label={t("硬盘", "Disk")} value={percent(m.disk_used, m.disk_total)} used={bytes(m.disk_used)} total={bytes(m.disk_total)} />
            <Meter
              label={node.traffic_limit > 0 ? t("本月流量", "Monthly traffic") : t("交换分区", "Swap")}
              value={quota ?? percent(m.swap_used, m.swap_total)}
              used={quota !== null ? bytes(monthUsage(node)) : bytes(m.swap_used)}
              total={quota !== null ? bytes(node.traffic_limit) : bytes(m.swap_total)}
            />
          </>
        ) : (
          <p className="panel-note">
            {m
              ? t("资源使用情况已在设置中隐藏。", "Resource usage is hidden in settings.")
              : node.online
                ? t("已连上，正在等待第一份指标。", "Connected; waiting for the first metrics.")
                : never
                  ? t("这个节点还没有安装 agent 或从未上报过。", "The agent is not installed or has never reported.")
                  : t(`上次上报于 ${span(seen)}前。`, `Last reported ${span(seen)} ago.`)}
          </p>
        )}
      </div>

      <div className="panel-side">
        {price ? (
          <div className="panel-price">
            {node.price > 0 ? (
              <span className="amount">
                {money(node.price, node.currency || "CNY")}
                <span className="sep">/</span>
                {cycle(node.billing_cycle || "monthly")}
              </span>
            ) : (
              <span className="amount free">{t("免费", "Free")}</span>
            )}
            <span className={expired ? "danger" : soon ? "warn" : "muted"}>
              {left === null ? t("无限", "Unlimited") : expired ? t(`已过期 ${-left} 天`, `Expired ${-left} days ago`) : t(`${left} 天后到期`, `Expires in ${left} days`)}
            </span>
          </div>
        ) : null}
        <IconChevronRight width={14} height={14} className="panel-go" />
      </div>
    </button>
  )
})

export function Panel({
  nodes,
  title,
  usage,
  price,
  remark,
  onOpen,
}: {
  nodes: Node[]
  /** The group the card holds, or empty for the whole fleet. */
  title: string
  usage: boolean
  price: boolean
  remark: boolean
  onOpen: (id: number) => void
}) {
  const online = nodes.filter((n) => n.online).length
  return (
    <div className="panel-card">
      <div className="panel-head">
        <h3>{title || t("全部节点", "All nodes")}</h3>
        <span>
          {online} / {nodes.length} {t("在线", "online")}
        </span>
      </div>
      {nodes.map((n) => (
        <Row key={n.id} node={n} usage={usage} price={price} remark={remark} onOpen={onOpen} />
      ))}
    </div>
  )
}
