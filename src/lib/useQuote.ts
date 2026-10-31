import { useEffect, useState } from "react"
import { getLanguage } from "@/lib/i18n"

import { dayNumber, parseQuote, quoteOfTheDay, type Quote } from "@/lib/quote"

/**
 * The sentence for today: from the operator's API when one is configured, from
 * the local pool otherwise.
 *
 * The API is asked once per calendar day per URL and the answer is kept in
 * localStorage, so reloading the page, opening it on a second tab, or a dozen
 * visitors arriving at once all cost one request — and the line does not change
 * under a visitor who reloads to see if it will.
 */

const KEY = "doc-quote-remote"
const TIMEOUT = 6_000

type Cached = { url: string; day: number; text: string; author: string }

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Cached>
    return typeof value.url === "string" && typeof value.day === "number" && typeof value.text === "string"
      ? { url: value.url, day: value.day, text: value.text, author: typeof value.author === "string" ? value.author : "" }
      : null
  } catch {
    // Storage can be off, and then even reading it throws.
    return null
  }
}

export function useQuote(spec: string, api: string): Quote | null {
  const local = !spec.trim() && getLanguage() === "en"
    ? { text: "Simplicity is the ultimate sophistication.", author: "" }
    : quoteOfTheDay(spec)
  const url = api.trim()

  const [remote, setRemote] = useState<Quote | null>(() => {
    if (!url) return null
    const hit = readCache()
    return hit && hit.url === url && hit.day === dayNumber(new Date()) ? { text: hit.text, author: hit.author } : null
  })

  useEffect(() => {
    if (!url) {
      setRemote(null)
      return
    }
    const day = dayNumber(new Date())
    const hit = readCache()
    if (hit && hit.url === url && hit.day === day) {
      setRemote({ text: hit.text, author: hit.author })
      return
    }

    // A slow or dead endpoint must not hold the page: the local line is already
    // on screen, and a failure just means it stays there.
    let live = true
    const stop = new AbortController()
    const timer = setTimeout(() => stop.abort(), TIMEOUT)
    fetch(url, { signal: stop.signal, headers: { Accept: "application/json, text/plain;q=0.9" } })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        // A JSON or text answer is a quote; an HTML one is an error page from
        // something in front of the API, and parsing it would print a whole
        // document in the header line.
        const type = res.headers.get("content-type") ?? ""
        if (type.includes("text/html")) throw new Error("html")
        return res.text()
      })
      .then((body) => {
        let payload: unknown = body
        try {
          payload = JSON.parse(body)
        } catch {
          // A plain-text endpoint is a legitimate answer.
        }
        const found = parseQuote(payload)
        if (!found || !live) return
        setRemote(found)
        try {
          localStorage.setItem(KEY, JSON.stringify({ url, day, text: found.text, author: found.author }))
        } catch {
          // Without storage the line is fetched again on the next load.
        }
      })
      .catch(() => {
        // Keep the local line; a quote API is never worth an error message.
      })
      .finally(() => clearTimeout(timer))

    return () => {
      live = false
      clearTimeout(timer)
      stop.abort()
    }
  }, [url])

  return remote ?? local
}
