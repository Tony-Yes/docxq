import { getLanguage, t } from "@/lib/i18n"

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

const unitOf = (n: number) => Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1)

/** 1024-based, labelled the way `df -h` writes them. Three significant digits by default. */
export function bytes(n: number, digits?: number): string {
  if (!n || n < 1) return "0 B"
  const i = unitOf(n)
  const v = n / 1024 ** i
  return `${v.toFixed(i === 0 ? 0 : (digits ?? (v >= 100 ? 0 : v >= 10 ? 1 : 2)))} ${UNITS[i]}`
}

/** A "used / total" pair, sharing one unit when both fall in it. */
export function pair(used: number, total: number): string {
  if (used > 0 && total > 0 && unitOf(used) === unitOf(total)) {
    const i = unitOf(total)
    const f = (n: number) => (n / 1024 ** i).toFixed(i === 0 ? 0 : 2)
    return `${f(used)} / ${f(total)} ${UNITS[i]}`
  }
  return `${bytes(used)} / ${bytes(total)}`
}

export function rate(n: number): string {
  return `${bytes(n, 1)}/s`
}

/** Not capped: a plan used past its quota reads as 209%, not 100%. */
export function percent(used: number, total: number): number {
  return total > 0 ? (used / total) * 100 : 0
}

export function uptime(seconds: number): string {
  if (!seconds) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (getLanguage() === "en") return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  return d > 0 ? `${d} 天 ${h} 小时` : h > 0 ? `${h} 小时 ${m} 分` : `${m} 分`
}

/** Whole days until a date, negative once it has passed. Only for hubs without `expires_in`. */
export function daysUntil(date?: string | null): number | null {
  if (!date) return null
  const target = new Date(`${date}T00:00:00`).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86400000)
}

export const FOREVER = "无限"

const MONEY = new Map<string, Intl.NumberFormat>()

/**
 * A price as zh-CN writes it: ¥12.00, US$12.00, HK$12.00, JP¥1,200. The locale is
 * fixed so the figure does not vary with the browser's language.
 */
export function money(amount: number, currency: string): string {
  try {
    let format = MONEY.get(currency)
    if (!format) {
      format = new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 })
      MONEY.set(currency, format)
    }
    return format.format(amount)
  } catch {
    // Intl throws on anything but three letters, which hubs before 1.3.1 stored.
    return `${currency} ${amount.toFixed(2)}`.trim()
  }
}

const NAMED_CYCLES: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12, biennial: 24, triennial: 36 }
const CYCLE_WORDS: Record<number, string> = { 1: "月付", 3: "季付", 6: "半年付", 12: "年付" }

/** How a billing cycle reads: 月付, 5 年付, 18 个月付, 一次性. */
export function cycle(billing: string): string {
  if (getLanguage() === "en") {
    if (billing === "once") return "One-time"
    const months = NAMED_CYCLES[billing] ?? Number(/^(\d+)m$/.exec(billing)?.[1])
    return months ? (months % 12 ? `${months} mo` : `${months / 12} yr`) : billing
  }
  if (billing === "once") return "一次性"
  const months = NAMED_CYCLES[billing] ?? Number(/^(\d+)m$/.exec(billing)?.[1])
  if (!months) return billing
  return CYCLE_WORDS[months] ?? (months % 12 ? `${months} 个月付` : `${months / 12} 年付`)
}

// Round chart windows, in hours: up to a week they are drawn from minute rows,
// past it from the hub's hourly tier.
const WINDOWS = [1, 6, 24, 168, 720, 2160]

/**
 * The chart windows offered for a hub keeping `days` of history: the round
 * windows shorter than it, then the whole of it. A round window the whole
 * exceeds by less than a quarter is left out, as it would sit beside a tab of
 * nearly the same width.
 */
export function windows(days: number): { hours: number; label: string }[] {
  const whole = Math.max(1, Math.floor(days)) * 24
  return [...WINDOWS.filter((h) => h * 1.25 <= whole), whole].map((hours) => ({
    hours,
    label: hours < 24 ? t(`${hours} 小时`, `${hours}h`) : hours === 8760 ? t("1 年", "1 yr") : t(`${hours / 24} 天`, `${hours / 24}d`),
  }))
}

/** Distro and CPU names as vendors write them carry mostly redundant text. */
export function osName(name: string): string {
  return name.replace("GNU/Linux ", "").replace(/\s*\([^)]*\)\s*$/, "")
}

export function cpuName(name: string): string {
  return name
    .replace(/\((R|TM|r|tm)\)/g, "")
    .replace(/\s+(CPU|Processor)\b/g, "")
    .replace(/\s+\d+-Core\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Seconds since the node last reported, as the hub counts them. The browser's
 * clock serves only a hub from before `last_seen_ago`.
 */
export function sinceSeen(node: { last_seen: number; last_seen_ago?: number | null }): number {
  if (node.last_seen_ago !== undefined) return node.last_seen_ago ?? 0
  return node.last_seen ? Date.now() / 1000 - node.last_seen : 0
}

/** A duration in seconds as prose: 3 分, 2 小时 5 分, 6 天. */
export function span(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (getLanguage() === "en") return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : `${Math.floor(seconds)}s`
  if (d > 0) return h > 0 ? `${d} 天 ${h} 小时` : `${d} 天`
  if (h > 0) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`
  if (m > 0) return `${m} 分`
  return `${Math.max(0, Math.floor(seconds))} 秒`
}

/** A date as a document writes it: 2026-10-11. */
export function date(value?: string | null): string {
  if (!value) return "—"
  const at = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(at.getTime()) ? "—" : at.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
}

const HHMM = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" })
const MDHHMM = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
const MMDD = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" })

/** Axis ticks for a window `hours` wide. Beyond a day a bare "14:00" recurs each midnight. */
export function clockFor(hours: number): (ms: number) => string {
  return hours <= 24 ? HHMM.format : MDHHMM.format
}

export function tickClock(ticks: number[], hours: number): (ms: number) => string {
  const midnight = (t: number) => new Date(t).getHours() === 0 && new Date(t).getMinutes() === 0
  return ticks.length > 0 && ticks.every(midnight) ? MMDD.format : clockFor(hours)
}

// Ticks on round clock values across `[from, to]`, in epoch milliseconds, phased
// on local midnight so a daily tick lands on the day in any zone.
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080, 20160].map((m) => m * 60_000)

export function timeTicks(from: number, to: number, count = 6): number[] {
  const step = TICK_STEPS.find((s) => (to - from) / s <= count)
  if (step === undefined) return []
  const zone = new Date(from).getTimezoneOffset() * 60_000
  const ticks: number[] = []
  for (let t = Math.ceil((from - zone) / step) * step + zone; t <= to; t += step) {
    // Past a daylight-saving change a step of days lands an hour off midnight.
    const tick = step < 86_400_000 ? t : new Date(t + 43_200_000).setHours(0, 0, 0, 0)
    if (tick <= to) ticks.push(tick)
  }
  return ticks
}

/**
 * `rows` with an empty row in each gap over twice their usual spacing, so a
 * chart breaks its line rather than drawing one across a day offline.
 */
export function withGaps<T extends { ts: number }>(rows: T[]): (T | { ts: number })[] {
  const gaps = rows.slice(1).map((r, i) => r.ts - rows[i].ts).sort((a, b) => a - b)
  const usual = gaps[(gaps.length - 1) >> 1]
  if (!usual) return rows
  return rows.flatMap((r, i) =>
    i > 0 && r.ts - rows[i - 1].ts > 2 * usual ? [{ ts: (r.ts + rows[i - 1].ts) / 2 }, r] : [r],
  )
}

/**
 * A label for an axis tick in bytes: 100 B, 1 KB, 10 MB. One decimal below a
 * hundred of a unit, so ticks a fifth apart do not repeat the same label.
 */
export function axisBytes(v: number): string {
  if (!v || v < 0) return "0 B"
  return bytes(v, v / 1024 ** unitOf(v) >= 100 ? 0 : 1).replace(".0 ", " ")
}

/**
 * The rungs of a logarithmic byte axis: 1, 10 and 100 of each binary unit, so
 * every gridline prints as a round label -- 100 B, 1 KB, 10 KB, 100 KB, 1 MB.
 */
const rung = (i: number) => 1024 ** Math.floor(i / 3) * 10 ** (i % 3)

/** The lowest rate drawn, 1 KB/s: a log axis has no zero, and an idle agent's own reports sit below it. */
export const RATE_FLOOR = rung(3)

/** A logarithmic axis for transfer rates, from the rung at or below `low` to the rung at or above `high`. */
export function rateAxis(low: number, high: number): { domain: [number, number]; ticks: number[] } {
  let bottom = 3
  while (rung(bottom + 1) <= Math.min(low, high)) bottom++
  let top = bottom + 1
  while (rung(top) < high) top++
  const step = Math.ceil((top - bottom) / 4)
  const ticks: number[] = []
  for (let i = top; i >= bottom; i -= step) ticks.unshift(rung(i))
  return { domain: [rung(bottom), rung(top)], ticks }
}

/** The gridlines for a zero-anchored axis: the top and the quarters beneath it. */
export function quarters(top: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => top * f)
}

/** A zero-anchored axis top for a utilisation percentage. */
export function axisTop(max: number, floor: number, cap: number): number {
  const target = Math.min(cap, Math.max(max, floor)) / 4
  const scale = 10 ** Math.floor(Math.log10(target))
  const ladder = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]
  return Math.min(cap, ladder.find((m) => m * scale >= target)! * scale * 4)
}

/** A country code as its flag emoji, or the code itself when it is not two letters. */
export function flagOf(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return ""
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/**
 * A median filter that replaces isolated spikes with the middle of their
 * neighbourhood. Latency probes occasionally report a single reading several
 * times the usual value, which drags the whole axis up and flattens the line
 * that matters; this keeps the shape and drops those points.
 *
 * A null is a failed probe rather than a high reading, so it is neither
 * replaced nor counted among its neighbours.
 */
export function despike(values: (number | null)[], window = 7, sigmas = 3): (number | null)[] {
  const half = window >> 1
  return values.map((v, i) => {
    if (v === null) return v
    const near = values.slice(Math.max(0, i - half), i + half + 1).filter((n): n is number => n !== null)
    if (near.length < 3) return v
    const mid = median(near)
    const mad = Math.max(median(near.map((n) => Math.abs(n - mid))), 1)
    // 1.4826 rescales the median absolute deviation to a standard deviation.
    return Math.abs(v - mid) > sigmas * 1.4826 * mad ? mid : v
  })
}

/**
 * A moving average over the readings, for the jitter a probe picks up on a busy
 * link. This is not the same job as `despike`: averaging pulls every point
 * toward its neighbours and softens the whole line, while despiking only
 * replaces the isolated readings that are several times the usual value.
 *
 * A null is a failed probe, not a zero reading, so a hole stays a hole: an
 * average that swallowed the gaps would draw a line through time the probe
 * never answered.
 */
export function smooth(values: (number | null)[], window = 5): (number | null)[] {
  const half = window >> 1
  return values.map((v, i) => {
    if (v === null) return null
    const near = values.slice(Math.max(0, i - half), i + half + 1).filter((n): n is number => n !== null)
    if (near.length < 2) return v
    return near.reduce((a, b) => a + b, 0) / near.length
  })
}

/** The middle of a sorted copy, the mean of the middle pair for an even count. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const half = sorted.length >> 1
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2
}

/** Days in one billing period, or null for a one-off purchase. */
export function cycleDays(billing: string): number | null {
  const months = NAMED_CYCLES[billing] ?? Number(/^(\d+)m$/.exec(billing)?.[1])
  if (!months) return null
  return (months * 365.25) / 12
}
