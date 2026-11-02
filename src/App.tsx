import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getLanguage, setLanguage, useLanguage, t } from "@/lib/i18n"

import { groupsOf, speedHistory, useNodes, type Node } from "@/lib/api"
import { flag, num, text, type Values } from "@/lib/config"
import { windows } from "@/lib/format"
import { useFx, type Table } from "@/lib/fx"
import { useConfig, useMe, useRoute, useTheme } from "@/lib/hooks"
import { useQuote } from "@/lib/useQuote"
import { ALL, inScope, OFFLINE, ONLINE, scopeLabel, type Scope } from "@/lib/scope"
import { Markdown } from "@/components/Markdown"
import { NodeCard } from "@/components/NodeCard"
import { NodeDetail } from "@/components/NodeDetail"
import { Panel } from "@/components/Panel"
import { Settings } from "@/components/Settings"
import { Summary } from "@/components/Summary"
import {
  IconAlert,
  IconClose,
  IconMenu,
  IconWrench,
  IconInfo,
  IconMoon,
  IconSearch,
  IconServer,
  IconSettings,
  IconSun,
} from "@/components/icons"

/* ------------------------------------------------------------------ 页头 */

function Header({
  site,
  dark,
  onToggleTheme,
  authed,
  onSettings,
  query,
  onQuery,
  onHome,
  onMenu,
  hasNav,
}: {
  site: string
  dark: boolean
  onToggleTheme: () => void
  authed: boolean
  onSettings: () => void
  query: string
  onQuery: (q: string) => void
  onHome: () => void
  onMenu: () => void
  hasNav: boolean
}) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    addEventListener("keydown", key)
    return () => removeEventListener("keydown", key)
  }, [])

  return (
    <header className="header">
      <div className="header-inner">
        {/* The sidebar is the only way to the admin panel, and it is off-canvas on
            a phone: without this button there is no way in at all. */}
        {hasNav ? (
          <button className="icon-btn nav-toggle" onClick={onMenu} aria-label={t("打开导航", "Open navigation")} title={t("导航", "Navigation")}>
            <IconMenu />
          </button>
        ) : null}
        {/* The name goes home, from any page, including a node detail opened
            from a link where the sidebar is not in sight. */}
        <a
          className="brand"
          href="/"
          title={t("返回首页", "Back to home")}
          onClick={(e) => {
            e.preventDefault()
            onHome()
          }}
        >
          <span className="brand-text">{site}</span>
          <span className="brand-tag">{t("状态", "Status")}</span>
        </a>

        <div className="header-spacer" />

        <button type="button" className="icon-btn language-toggle" onClick={() => setLanguage(getLanguage() === "en" ? "zh-CN" : "en")} aria-label={t("切换到英文", "Switch to Chinese")} title={t("切换到英文", "Switch to Chinese")}>
          {getLanguage() === "en" ? "ZH" : "EN"}
        </button>

        <label className="search">
          <IconSearch width={14} height={14} />
          <input
            ref={input}
            type="search"
            value={query}
            placeholder={t("搜索节点", "Search nodes")}
            aria-label={t("搜索节点", "Search nodes")}
            onChange={(e) => onQuery(e.target.value)}
          />
          <kbd>⌘K</kbd>
        </label>

        {authed ? (
          <button className="icon-btn" onClick={onSettings} aria-label={t("主题设置", "Theme settings")} title={t("主题设置", "Theme settings")}>
            <IconSettings />
          </button>
        ) : null}

        <button className="icon-btn" onClick={onToggleTheme} aria-label={dark ? t("切换到浅色", "Switch to light mode") : t("切换到深色", "Switch to dark mode")} title={dark ? t("浅色", "Light") : t("深色", "Dark")}>
          {dark ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </header>
  )
}

/* --------------------------------------------------------------- 侧边栏 */

function Sidebar({
  site,
  groups,
  counts,
  total,
  online,
  scope,
  onScope,
  onHome,
  nodes,
  onOpen,
  aboutTitle,
  open,
  onClose,
}: {
  site: string
  groups: string[]
  counts: Map<string, number>
  total: number
  online: number
  scope: Scope
  onScope: (s: Scope) => void
  onHome: () => void
  nodes: Node[]
  onOpen: (id: number) => void
  aboutTitle: string
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {open ? <div className="scrim nav-scrim" onClick={onClose} /> : null}
      <aside className={`sidebar ${open ? "open" : ""}`} id="site-nav">
      <div className="sidebar-head">
        <span>{site}</span>
        <button className="icon-btn" onClick={onClose} aria-label={t("关闭导航", "Close navigation")}>
          <IconClose />
        </button>
      </div>

      <nav aria-label={t("站点", "Site")}>
        <p className="nav-title">{t("站点", "Site")}</p>
        <button
          className={`nav-link ${scope.kind === "all" ? "active" : ""}`}
          onClick={() => { onHome(); onScope(ALL); scrollTo({ top: 0 }); onClose() }}
        >
          <IconServer width={13} height={13} />
          <span className="nav-label">{t("全部节点", "All nodes")}</span>
          <span className="count">{total}</span>
        </button>
        <button
          className={`nav-link ${scope.kind === "online" ? "active" : ""}`}
          onClick={() => { onHome(); onScope(ONLINE); scrollTo({ top: 0 }); onClose() }}
        >
          <span className="dot on" />
          <span className="nav-label">{t("全部在线", "All online")}</span>
          <span className="count">{online}</span>
        </button>
        <button
          className={`nav-link ${scope.kind === "offline" ? "active" : ""}`}
          onClick={() => { onHome(); onScope(OFFLINE); scrollTo({ top: 0 }); onClose() }}
        >
          <span className="dot" />
          <span className="nav-label">{t("离线", "Offline")}</span>
          <span className="count">{total - online}</span>
        </button>
      </nav>

      {groups.length > 0 && (
        <nav aria-label={t("分组", "Groups")}>
          <p className="nav-title">{t("分组", "Groups")}</p>
          {groups.map((g) => (
            <button
              key={g}
              className={`nav-link ${scope.kind === "group" && scope.name === g ? "active" : ""}`}
              onClick={() => { onHome(); onScope({ kind: "group", name: g }); onClose() }}
              title={g}
            >
              <span className="nav-label">{g}</span>
              <span className="count">{counts.get(g) ?? 0}</span>
            </button>
          ))}
        </nav>
      )}

      <nav aria-label={t("节点", "Nodes")}>
        <p className="nav-title">{t("节点", "Nodes")}</p>
        {nodes.length === 0 ? (
          <span className="nav-link" style={{ cursor: "default" }}>
            <span className="nav-label">{t("暂无", "None")}</span>
          </span>
        ) : (
          nodes.map((n) => (
            <button key={n.id} className="nav-link" onClick={() => onOpen(n.id)} title={n.name}>
              <span className={`dot ${n.online ? "on" : ""}`} />
              <span className="nav-label">{n.name}</span>
            </button>
          ))
        )}
      </nav>

      <nav aria-label={t("关于", "About")}>
        <p className="nav-title">{t("关于", "About")}</p>
        <a className="nav-link" href="#about" onClick={onClose}>
          <IconInfo width={13} height={13} />
          <span className="nav-label">{aboutTitle}</span>
        </a>
        <a className="nav-link" href="/admin">
          <IconWrench width={13} height={13} />
          <span className="nav-label">{t("管理面板", "Admin panel")}</span>
        </a>
      </nav>

      <p className="nav-title" style={{ marginTop: 22, color: "var(--fg-faint)", fontWeight: 400 }}>
        {site} · {online}/{total} {t("在线", "online")}
      </p>
      </aside>
    </>
  )
}

/* ---------------------------------------------------------------- 目录 */

function Toc({ items }: { items: { id: string; label: string; sub?: boolean }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "")

  useEffect(() => {
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el)
    if (!targets.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [items])

  if (!items.length) return null
  return (
    <aside className="toc" aria-label={t("本页内容", "On this page")}>
      <p className="nav-title">{t("本页内容", "On this page")}</p>
      {items.map((item) => (
        <a
          key={item.id}
          className={`nav-link ${item.sub ? "sub" : ""} ${active === item.id ? "active" : ""}`}
          href={`#${item.id}`}
        >
          {item.label}
        </a>
      ))}
    </aside>
  )
}

/* ------------------------------------------------------------------ 首页 */

/** The list a search and a group tab leave visible: the sidebar count, the lead line and the cards all agree on it. */
function matchNodes(nodes: Node[], scope: Scope, query: string): Node[] {
  const needle = query.trim().toLowerCase()
  return nodes.filter((n) => {
    if (!inScope(n, scope)) return false
    if (!needle) return true
    return [n.name, n.group ?? "", n.public_remark ?? "", n.country ?? ""].some((v) => v.toLowerCase().includes(needle))
  })
}

function Home({
  nodes,
  scope,
  query,
  config,
  onOpen,
  historyDays,
  currency,
  fx,
}: {
  nodes: Node[]
  scope: Scope
  query: string
  config: Values
  onOpen: (id: number) => void
  historyDays: number
  currency: string
  fx: Table | null
}) {
  const showSummary = flag(config, "show_summary", true)
  const showUsage = flag(config, "show_usage", true)
  const showPrice = flag(config, "show_price", true)
  const showRemark = flag(config, "show_remark", true)
  const columns = Math.min(5, Math.max(1, Math.round(num(config, "columns", 3))))
  const layout = text(config, "layout", "panel")
  const panel = layout === "panel"

  const visible = useMemo(() => matchNodes(nodes, scope, query), [nodes, scope, query])

  // Ungrouped nodes come last, under their own heading, and only when the list
  // shows more than one group. A group or a virtual scope is one section.
  const sections = useMemo(() => {
    if (scope.kind !== "all") return [{ name: scopeLabel(scope), nodes: visible }]
    const order: string[] = []
    const map = new Map<string, Node[]>()
    for (const n of visible) {
      const g = n.group ?? ""
      if (!map.has(g)) {
        map.set(g, [])
        order.push(g)
      }
      map.get(g)!.push(n)
    }
    if (order.length <= 1) return [{ name: "", nodes: visible }]
    // Group order is the operator's node order; the ungrouped ones trail it.
    const named = order.filter(Boolean)
    if (map.has("")) named.push("")
    return named.map((g) => ({ name: g, nodes: map.get(g)! }))
  }, [visible, scope])

  // The sparkline follows a group; the virtual scopes have no series of their
  // own, and the fleet's line under t("离线", "Offline") would describe the wrong set.
  const speed =
    scope.kind === "group" ? speedHistory.get(scope.name) ?? [] : scope.kind === "all" ? speedHistory.get(null) ?? [] : []
  const scopedNodes = scope.kind === "all" ? nodes : nodes.filter((n) => inScope(n, scope))
  // While a search narrows the list, the overview has to describe the same set:
  // seven of nine online above two rows of cards reads like a bug.
  const summaryNodes = query ? visible : scopedNodes
  const summaryScope = query ? t("搜索结果", "Search results") : scopeLabel(scope)

  if (!visible.length) {
    return (
      <>
        {showSummary ? <Summary nodes={summaryNodes} scope={summaryScope} speed={speed} currency={currency} fx={fx} /> : null}
        <div className="empty-state" style={{ marginTop: 24 }}>
          {query
            ? t(`没有匹配「${query}」的节点。`, `No nodes match “${query}”.`)
            : scope.kind === "all"
              ? t("站点还没有添加任何节点。", "No nodes have been added yet.")
              : scope.kind === "group"
                ? t(`「${scope.name}」分组下还没有节点。`, `No nodes in “${scope.name}”.`)
                : scope.kind === "online"
                  ? t("现在没有节点在线。", "No nodes are currently online.")
                  : t("所有节点都在线。", "All nodes are online.")}
        </div>
      </>
    )
  }

  return (
    <>
      {/* One section, not two: the tiles describe the same set as the cards
          below them, and a second heading between them only pushed the list
          further down the page. */}
      <section className="section" id="overview" style={{ marginTop: 0 }}>
        <h2 className="section-title">
          {showSummary ? t("概览", "Overview") : t("节点", "Nodes")}
          <span className="hint">
            {visible.length} {t("台", "nodes")} · {summaryScope} · {t(`最近 ${historyDays} 天有历史`, `${historyDays} days of history`)}
          </span>
        </h2>
        {showSummary ? <Summary nodes={summaryNodes} scope={summaryScope} speed={speed} currency={currency} fx={fx} /> : null}
        <div id="nodes" className={showSummary ? "nodes-after-summary" : undefined}>
          {sections.map((section, i) => (
            <div key={section.name || `s-${i}`} id={section.name ? `g-${i}` : undefined} style={{ scrollMarginTop: 80 }}>
              {sections.length > 1 && !panel ? (
                <div className="group-head">
                  <h3>{section.name || t("未分组", "Ungrouped")}</h3>
                  <span>
                    {section.nodes.filter((n) => n.online).length} / {section.nodes.length} {t("在线", "online")}
                  </span>
                </div>
              ) : null}
              {panel ? (
                <Panel
                  nodes={section.nodes}
                  title={sections.length > 1 ? section.name || t("未分组", "Ungrouped") : scope.kind === "all" ? "" : scopeLabel(scope)}
                  usage={showUsage}
                  price={showPrice}
                  remark={showRemark}
                  onOpen={onOpen}
                />
              ) : (
                <div className="cards" style={{ ["--cols" as string]: columns }}>
                  {section.nodes.map((n) => (
                    <NodeCard
                      key={n.id}
                      node={n}
                      columns={columns}
                      usage={showUsage}
                      price={showPrice}
                      remark={showRemark}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ 应用 */

export function App() {
  const language = useLanguage()
  const { nodes, error, closed } = useNodes()
  const { me } = useMe()
  const config = useConfig()
  const [route, go] = useRoute()
  const [scope, setScope] = useState<Scope>(ALL)
  const [query, setQuery] = useState("")
  const [settings, setSettings] = useState(false)
  // The sidebar is off-canvas below 860px; this is the drawer's own state.
  const [nav, setNav] = useState(false)
  const [saved, setSaved] = useState<Values | null>(null)
  const [hours, setHours] = useState(6)

  const values = saved ?? config
  const preference = (text(values ?? {}, "dark", "auto") || "auto") as "auto" | "light" | "dark"
  const { dark, toggle } = useTheme(preference)
  const accent = text(values ?? {}, "accent", "blue")

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  const list = nodes ?? []
  const site = me?.site_name || t("状态页", "Status page")
  const currency = text(values ?? {}, "currency", "CNY") || "CNY"
  const { table: fx } = useFx(text(values ?? {}, "fx_rates", ""))
  const quote = useQuote(text(values ?? {}, "quote", ""), text(values ?? {}, "quote_api", ""))
  const configuredAboutTitle = text(values ?? {}, "about_title", "").trim()
  // loadConfig merges manifest defaults, so the default Chinese title is not
  // empty after loading. Treat it as built-in copy, not a custom site title.
  const aboutTitle = !configuredAboutTitle || configuredAboutTitle === "关于本站"
    ? t("关于本站", "About this site")
    : configuredAboutTitle
  const about = text(values ?? {}, "about", "").trim()
  // The tab title follows the site name, and on a detail page names the node:
  // with several status tabs open that is the only way to tell them apart.
  useEffect(() => {
    const node = route !== null ? list.find((n) => n.id === route) : null
    document.title = node ? `${node.name} · ${site}` : site
  }, [route, list, site])

  useEffect(() => {
    setNav(false)
  }, [route, scope])

  useEffect(() => {
    if (!nav) return
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNav(false)
    }
    addEventListener("keydown", escape)
    return () => removeEventListener("keydown", escape)
  }, [nav])

  const historyDays = me?.history_days ?? 7
  const ranges = useMemo(() => windows(historyDays), [historyDays, language])

  // A window the hub no longer keeps (history_days shrank) falls back to the
  // shortest one rather than an empty chart.
  useEffect(() => {
    if (!ranges.some((r) => r.hours === hours)) setHours(ranges[0]?.hours ?? 6)
  }, [ranges, hours])

  const groups = useMemo(() => groupsOf(list), [list])
  const matched = useMemo(() => matchNodes(list, scope, query), [list, scope, query])
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of list) map.set(n.group ?? "", (map.get(n.group ?? "") ?? 0) + 1)
    return map
  }, [list])

  // A group the operator renamed or emptied takes the tab with it.
  useEffect(() => {
    if (scope.kind === "group" && !groups.includes(scope.name)) setScope(ALL)
  }, [groups, scope])

  const detail = route !== null ? list.find((n) => n.id === route) ?? null : null
  const sidebar = flag(values ?? {}, "sidebar", true) && list.length > 0
  const notice = text(values ?? {}, "notice", "").trim()
  const footer = text(values ?? {}, "footer", "").trim()

  const open = useCallback(
    (id: number) => {
      go(id)
      setQuery("")
    },
    [go],
  )

  const toc = useMemo<{ id: string; label: string; sub?: boolean }[]>(() => {
    // A page that could not load has no sections to list.
    if (error && !list.length) return []
    if (route !== null) {
      return [
        { id: "summary", label: t("概况", "Summary") },
        { id: "charts", label: t("监控图表", "Monitoring charts") },
      ]
    }
    // The tiles and the cards share one section, so one entry leads to both.
    const items: { id: string; label: string; sub?: boolean }[] = []
    if (list.length) items.push({ id: "overview", label: flag(values ?? {}, "show_summary", true) ? t("概览", "Overview") : t("节点", "Nodes") })
    // Group headings only exist when the page draws more than one of them, and
    // a group tab or a search leaves exactly one.
    if (list.length && scope.kind === "all" && groups.length > 1) {
      for (const [i, g] of groups.entries()) items.push({ id: `g-${i}`, label: g, sub: true })
    }
    if (list.length) items.push({ id: "about", label: aboutTitle })
    return items
  }, [route, groups, values, error, list.length, aboutTitle, scope, language])

  const loading = nodes === null && !error && !closed

  return (
    <>
      <Header
        site={site}
        dark={dark}
        onToggleTheme={toggle}
        authed={!!me?.authed}
        onSettings={() => setSettings(true)}
        query={query}
        onQuery={setQuery}
        onHome={() => {
          go(null)
          setScope(ALL)
          setQuery("")
        }}
        onMenu={() => setNav(true)}
        hasNav={sidebar}
      />

      <div className={`layout ${sidebar ? "" : "no-sidebar"} ${toc.length ? "" : "no-toc"}`}>
        {sidebar ? (
          <Sidebar
            site={site}
            groups={groups}
            counts={counts}
            total={list.length}
            online={list.filter((n) => n.online).length}
            scope={scope}
            onScope={setScope}
            onHome={() => go(null)}
            nodes={scope.kind === "all" ? list : list.filter((n) => inScope(n, scope))}
            onOpen={open}
            aboutTitle={aboutTitle}
            open={nav}
            onClose={() => setNav(false)}
          />
        ) : null}

        <main className="main">
          {notice && route === null ? (
            <div className="notice">
              <IconAlert width={15} height={15} />
              <span>{notice}</span>
            </div>
          ) : null}

          {closed && list.length ? (
            <div className="alert danger">
              <IconAlert />
              <span>{t("这个站点的状态页已关闭，需要登录后才能查看。下面是关闭前拿到的数据。", "This page requires sign-in. Showing the last available data.")}</span>
            </div>
          ) : null}

          {error && list.length ? (
            <div className="alert danger">
              <IconAlert />
              <span>{error}{t("（显示的是最后一次拿到的数据）", " (showing last available data)")}</span>
            </div>
          ) : null}

          {loading ? (
            <Loading />
          ) : closed && !list.length ? (
            <Closed />
          ) : error && !list.length ? (
            <Failed message={error} />
          ) : route !== null ? (
            <NodeDetail
              node={detail}
              hours={hours}
              windows={ranges}
              onHours={setHours}
              onBack={() => go(null)}
            />
          ) : (
            <>
              <div className="doc-head">
                <div className="crumb">
                  <a href="/" onClick={(e) => { e.preventDefault(); go(null); setScope(ALL) }}>
                    {t("首页", "Home")}
                  </a>
                  <span className="sep">/</span>
                  <span>{t("状态", "Status")}</span>
                  {scope.kind !== "all" ? (
                    <>
                      <span className="sep">/</span>
                      <span>{scopeLabel(scope)}</span>
                    </>
                  ) : null}
                </div>
                <h1 className="doc-title">{scope.kind === "all" ? site : scopeLabel(scope)}</h1>
                <p className="doc-lead">
                  {query.trim() ? (
                    t(`匹配「${query.trim()}」的节点 ${matched.length} 台，${matched.filter((n) => n.online).length} 台在线。`, `${matched.length} nodes match “${query.trim()}”, ${matched.filter((n) => n.online).length} online.`)
                  ) : scope.kind === "group" ? (
                    t(`${scope.name} 分组下的节点状态、资源占用与流量。点击任意卡片查看历史曲线。`, `Status, resources and traffic in ${scope.name}. Select a node to view history.`)
                  ) : quote ? (
                    /* The same line on every scope the sidebar offers, so switching
                       between 全部节点 / 全部在线 / 离线 does not make the page
                       look like a different document. */
                    <>
                      {quote.text}
                      {quote.author ? <cite>—— {quote.author}</cite> : null}
                    </>
                  ) : (
                    t(`共 ${matched.length} 台节点，${matched.filter((n) => n.online).length} 台在线。`, `${matched.length} nodes, ${matched.filter((n) => n.online).length} online.`)
                  )}
                </p>
              </div>

              <Home
                nodes={list}
                scope={scope}
                query={query}
                config={values ?? {}}
                onOpen={open}
                historyDays={historyDays}
                currency={currency}
                fx={fx}
              />

              <section className="section" id="about">
                <h2 className="section-title">{aboutTitle}</h2>
                {about ? (
                  <Markdown source={about} />
                ) : (
                  <div className="prose">
                    <p>
                      {t("这个页面由 monitor 的 Doc 主题渲染，只使用公开接口读取节点状态，不会写入任何数据。", "This page uses the Doc theme for monitor. It reads public node data without modifying it.")}
                    </p>
                    <p>
                      {t(`状态每两秒通过 WebSocket 推送；连接不可用时退回每五秒轮询一次。历史曲线由 hub 按分钟或小时聚合，当前站点保留 ${historyDays} 天。`, `Status updates arrive every two seconds over WebSocket, with five-second polling as a fallback. History is aggregated by minute or hour and retained for ${historyDays} days.`)}
                    </p>
                  </div>
                )}
              </section>
            </>
          )}

        </main>

        <Toc items={toc} />
      </div>

      {/* A site-wide footer, outside the three-column grid: it closes the page,
          not the article column. One hairline is the whole design — no mark, no
          fill, nothing that competes with the document above it. */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">{site}</span>
          {footer ? <span className="footer-note">{footer}</span> : null}
          <span className="footer-spacer" />
          {list.length > 0 ? (
            <span>{t("最后更新", "Last updated")} {new Date().toLocaleTimeString(getLanguage())}</span>
          ) : null}
          <span>{t("数据来自 monitor", "Powered by monitor")}</span>
        </div>
      </footer>

      {settings && values ? (
        <Settings
          values={values}
          onClose={() => setSettings(false)}
          onSaved={setSaved}
        />
      ) : null}
    </>
  )
}

/** The hub is unreachable, or it refused: there is nothing to draw but the reason. */
/**
 * The hub answers 401 once the operator has closed the status page to anonymous
 * callers. That is not a failure of this page, so it gets its own words and no
 * "retrying" line: nothing will change until the visitor signs in.
 */
function Closed() {
  return (
    <div className="doc-head">
      <div className="crumb">
        <span>{t("状态", "Status")}</span>
      </div>
      <h1 className="doc-title">{t("这个状态页已关闭", "This status page is private")}</h1>
      <p className="doc-lead">{t("站点管理员把状态页设成了仅登录可见。", "The administrator has restricted this page to signed-in users.")}</p>
      <div className="prose" style={{ marginTop: 20 }}>
        <p>
          {t("登录本站后就能看到节点列表；没有账号的话，可以联系站长。左侧导航里的「管理面板」是登录的地方，手机上先点页头的菜单按钮。", "Sign in through Admin panel in the sidebar to view nodes. On mobile, open the header menu first. Contact the administrator if you need an account.")}
        </p>
      </div>
      <p style={{ marginTop: 18 }}>
        <a className="btn primary" href="/admin">
          {t("去登录", "Sign in")}
        </a>
      </p>
    </div>
  )
}

function Failed({ message }: { message: string }) {
  return (
    <div className="doc-head">
      <div className="crumb">
        <span>{t("状态", "Status")}</span>
      </div>
      <h1 className="doc-title">{t("读不到节点列表", "Unable to load nodes")}</h1>
      <p className="doc-lead">{message}</p>
      <div className="alert danger" style={{ marginTop: 20 }}>
        <IconAlert />
        <span>
          {t("页面会每五秒自动重试一次。如果一直是这样，可能是 hub 暂时不可用，或者这个状态页需要登录后才能查看。", "Retrying every five seconds. The hub may be unavailable or this page may require sign-in.")}
        </span>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <>
      <div className="doc-head">
        <div className="skeleton" style={{ height: 12, width: 140, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 30, width: 260 }} />
      </div>
      <div className="summary" style={{ marginTop: 28 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div className="tile" key={i}>
            <div className="skeleton" style={{ height: 10, width: 60 }} />
            <div className="skeleton" style={{ height: 22, width: 90, marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="cards" style={{ marginTop: 32, ["--cols" as string]: 3 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div className="card" key={i}>
            <div className="skeleton" style={{ height: 14, width: "55%" }} />
            <div className="skeleton" style={{ height: 10, width: "75%", marginTop: 8 }} />
            <div className="skeleton" style={{ height: 52, marginTop: 16 }} />
          </div>
        ))}
      </div>
    </>
  )
}
