import { t, useLanguage } from "@/lib/i18n"
import { memo } from "react"

import type { Node } from "@/lib/api"
import { bytes, cycle, daysUntil, money, osName, percent, rate, sinceSeen, span, uptime } from "@/lib/format"
import { CountryFlag } from "@/components/CountryFlag"
import { IconArrowDown, IconArrowUp } from "@/components/icons"
import { Meter, monthUsage } from "@/components/Summary"

/** A hub that has never received a report has no figures at all, and says so. */
const deployed = (node: Node) => node.cpu_cores > 0 || node.mem_total > 0

/** Days left, from the hub's calendar where it says so, else from the browser's clock. */
function remaining(node: Node): number | null {
  if (node.expires_in !== undefined) return node.expires_in
  return daysUntil(node.expires_at)
}

export type NodeCardProps = {
  node: Node
  columns: number
  usage: boolean
  price: boolean
  remark: boolean
  onOpen: (id: number) => void
}

export const NodeCard = memo(function NodeCard({ node, columns, usage, price, remark, onOpen }: NodeCardProps) {
  useLanguage()
  const m = node.metrics
  const left = remaining(node)
  const expired = left !== null && left < 0
  const soon = left !== null && left >= 0 && left <= 7
  const quota = node.traffic_limit > 0 ? percent(monthUsage(node), node.traffic_limit) : null
  const seen = sinceSeen(node)
  const never = node.last_seen_ago === null

  const status = node.online
    ? { text: m ? t("在线", "Online") : t("已连接", "Connected"), cls: "status on" }
    : { text: never ? t("未接入", "Not connected") : `${t("离线", "Offline")} ${span(seen)}`, cls: never ? "status never" : "status" }

  return (
    <button
      type="button"
      className="card"
      onClick={() => onOpen(node.id)}
      aria-label={`${node.name} ${t("详情", "details")}`}
      data-columns={columns}
    >
      <div className="card-head">
        <div className="card-identity">
          <div className="card-title">
            <CountryFlag country={node.country} />
            <h3>{node.name}</h3>
          </div>
          <div className="card-sub">
            {deployed(node)
              ? [osName(node.os ?? ""), node.cpu_cores > 0 ? `${node.cpu_cores} ${t("核", "cores")}` : "", node.arch ?? ""].filter(Boolean).join(" · ")
              : t("尚未上报硬件信息", "Hardware not reported yet")}
          </div>
        </div>
        <span className={status.cls}>
          <i className="dot" />
          {status.text}
        </span>
      </div>

      {/* The body is a fixed-height box in every card: a node without metrics
          says so in the same space the meters would have taken, so a row of
          cards does not change height when one of them goes offline. */}
      <div className="card-body">
        {m && usage ? (
          <div className="meters">
            <Meter label="CPU" value={m.cpu} used={`${Math.round(m.cpu)}%`} hint={`${t("负载", "Load")} ${m.load[0].toFixed(2)}`} />
            <Meter label={t("内存", "Memory")} value={percent(m.mem_used, m.mem_total)} used={bytes(m.mem_used)} total={bytes(m.mem_total)} />
            <Meter label={t("硬盘", "Disk")} value={percent(m.disk_used, m.disk_total)} used={bytes(m.disk_used)} total={bytes(m.disk_total)} />
            <Meter
              label={node.traffic_limit > 0 ? t("本月流量", "Monthly traffic") : t("交换分区", "Swap")}
              value={quota ?? percent(m.swap_used, m.swap_total)}
              used={quota !== null ? bytes(monthUsage(node)) : bytes(m.swap_used)}
              total={quota !== null ? bytes(node.traffic_limit) : bytes(m.swap_total)}
            />
          </div>
        ) : (
          <p className="card-empty-note">
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

      {remark && node.public_remark ? <p className="remark">{node.public_remark}</p> : null}

      {/* Two lines, both always there: the rates on one, the uptime on the next.
          An offline node has no rates and no uptime, and a card that dropped a
          line there would sit shorter than its neighbours in the same row. */}
      <div className="card-foot">
        {m ? (
          <>
            <span className="io" title={t("下行", "Download")}>
              <IconArrowDown />
              {rate(m.net_rx)}
            </span>
            <span className="io" title={t("上行", "Upload")}>
              <IconArrowUp />
              {rate(m.net_tx)}
            </span>
          </>
        ) : (
          <span className="io">{node.online ? t("等待指标", "Waiting for metrics") : t("无实时数据", "No live data")}</span>
        )}
        <span className="uptime">{m && node.online && m.uptime ? t(`已运行 ${uptime(m.uptime)}`, `Uptime ${uptime(m.uptime)}`) : ""}</span>
      </div>

      {price ? (
        <div className="card-price">
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
    </button>
  )
})
