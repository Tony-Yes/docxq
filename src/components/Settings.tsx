import { t } from "@/lib/i18n"
import { useEffect, useRef, useState } from "react"

import { entries, fields, saveConfig, type Values } from "@/lib/config"
import { IconClose } from "@/components/icons"

const labels: Record<string, string> = {
  "首页": "Home", "节点卡片": "Node cards", "外观": "Appearance", "剩余价值": "Remaining value", "关于本站": "About this site",
  notice: "Announcement", quote: "Daily quotes", quote_api: "Quote API", show_summary: "Show summary", sidebar: "Show sidebar", footer: "Footer text",
  layout: "Node layout", show_usage: "Show resource usage", show_price: "Show price and expiry", show_remark: "Show public remarks", columns: "Maximum card columns",
  accent: "Accent color", dark: "Color scheme", currency: "Currency", fx_rates: "Manual exchange rates", about_title: "About title", about: "About content",
  panel: "Single panel", cards: "Card grid", blue: "Blue", green: "Green", orange: "Orange", violet: "Violet", auto: "System", light: "Light", dark_mode: "Dark",
  CNY: "Chinese yuan CNY", USD: "US dollar USD", HKD: "Hong Kong dollar HKD", EUR: "Euro EUR", JPY: "Japanese yen JPY",
}
const help: Record<string, string> = {
  notice: "Plain text shown at the top of the home page; leave blank to hide.",
  quote: "One quote per line; optionally separate author with —. Leave blank for built-in quotes.",
  quote_api: "A JSON (hitokoto-compatible) or plain-text endpoint, fetched once per day. Falls back to local quotes on failure.",
  show_summary: "Show the five summary cards above the node list.", footer: "Footer text; leave blank to hide.",
  layout: "Display nodes in one panel or in individual cards.", show_price: "Nodes without a price show Free; no expiry date shows Unlimited.",
  columns: "Only applies to the card grid. Narrow windows automatically use fewer columns.", dark: "Visitors can override the color scheme using the header button.",
  currency: "Currency used for value calculations.", fx_rates: "Fallback rates, expressed as 1 unit of currency in CNY, e.g. USD=7.2, HKD=0.92.",
  about_title: "Heading used in the sidebar and About section.", about: "Markdown is supported. Leave blank to show the built-in description.",
}

/**
 * The panel the hub shows the operator. It draws itself from theme.json's config
 * array, so the form and the manifest cannot drift apart. Every value here is
 * site-wide: it is written back to the hub, not to this browser.
 */

export function Settings({ values, onClose, onSaved }: { values: Values; onClose: () => void; onSaved: (next: Values) => void }) {
  const [draft, setDraft] = useState<Values>(values)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null)
  const closing = useRef<number | null>(null)
  useEffect(() => () => {
    if (closing.current !== null) clearTimeout(closing.current)
  }, [])

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    addEventListener("keydown", escape)
    return () => removeEventListener("keydown", escape)
  }, [onClose])

  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await saveConfig(draft)
      onSaved(draft)
      // The write is visible in the page behind the drawer at once; the panel
      // stays just long enough to say so before it gets out of the way.
      setMessage({ kind: "ok", text: t("已保存", "Saved") })
      closing.current = window.setTimeout(onClose, 900)
    } catch (e) {
      // The hub answers a refused write with one line of Chinese text.
      setMessage({ kind: "bad", text: (e as Error).message || t("保存失败", "Save failed") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t("主题设置", "Theme settings")}>
        <div className="drawer-head">
          <h2>{t("主题设置", "Theme settings")}</h2>
          <button className="icon-btn close" onClick={onClose} aria-label={t("关闭", "Close")}>
            <IconClose />
          </button>
        </div>

        <div className="drawer-body">
          {entries.map((entry, i) =>
            entry.type === "title" ? (
              <div className="field-group" key={`t-${i}`}>
                {t(entry.label, labels[entry.label] ?? entry.label)}
              </div>
            ) : (
              <Field key={entry.key} field={entry} value={draft[entry.key]} onChange={(v) => set(entry.key, v)} />
            ),
          )}
          <p className="field-help" style={{ marginTop: 20 }}>
            {t(`这些设置保存在站点里，所有访客都会看到。共 ${fields.length} 项。`, `These ${fields.length} settings apply to all visitors.`)}
          </p>
        </div>

        <div className="drawer-foot">
          <span className={`msg ${message?.kind ?? ""}`}>{message?.text ?? ""}</span>
          <button className="btn" onClick={onClose} disabled={busy}>
            {t("取消", "Cancel")}
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? t("保存中…", "Saving…") : t("保存", "Save")}
          </button>
        </div>
      </aside>
    </>
  )
}

function Field({
  field,
  value,
  onChange,
}: {
  field: { key: string; type: string; label?: string; help?: string; options?: { value: string; label?: string }[]; min?: number; max?: number }
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label = t(field.label ?? field.key, labels[field.key] ?? field.key)
  const fieldHelp = t(field.help ?? "", help[field.key] ?? "")

  if (field.type === "boolean") {
    return (
      <div className="field">
        <label className="switch">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span className="track" />
          <span>{label}</span>
        </label>
        {fieldHelp ? <div className="field-help">{fieldHelp}</div> : null}
      </div>
    )
  }

  if (field.type === "select") {
    return (
      <div className="field">
        <label className="field-label" htmlFor={`f-${field.key}`}>
          {label}
        </label>
        <select className="select" id={`f-${field.key}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label ?? o.value, labels[o.value === "dark" ? "dark_mode" : o.value] ?? o.label ?? o.value)}
            </option>
          ))}
        </select>
        {fieldHelp ? <div className="field-help">{fieldHelp}</div> : null}
      </div>
    )
  }

  if (field.type === "number") {
    return (
      <div className="field">
        <label className="field-label" htmlFor={`f-${field.key}`}>
          {label}
        </label>
        <input
          className="input"
          id={`f-${field.key}`}
          type="number"
          value={typeof value === "number" ? value : ""}
          min={field.min}
          max={field.max}
          onChange={(e) => {
            const next = e.target.value === "" ? field.min ?? 0 : Number(e.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
        />
        {fieldHelp ? <div className="field-help">{fieldHelp}</div> : null}
      </div>
    )
  }

  if (field.type === "text") {
    return (
      <div className="field">
        <label className="field-label" htmlFor={`f-${field.key}`}>
          {label}
        </label>
        <textarea
          className="textarea"
          id={`f-${field.key}`}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {fieldHelp ? <div className="field-help">{fieldHelp}</div> : null}
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={`f-${field.key}`}>
        {label}
      </label>
      <input
        className="input"
        id={`f-${field.key}`}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {fieldHelp ? <div className="field-help">{fieldHelp}</div> : null}
    </div>
  )
}
