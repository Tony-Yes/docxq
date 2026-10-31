import { useSyncExternalStore } from "react"

export type Language = "zh-CN" | "en"
const KEY = "doc-language"
let language: Language = "zh-CN"
try {
  if (localStorage.getItem(KEY) === "en") language = "en"
} catch {
  // Storage may be disabled; the in-memory choice still works.
}
const listeners = new Set<() => void>()

export const getLanguage = () => language
export function setLanguage(next: Language) {
  language = next
  document.documentElement.lang = next
  try { localStorage.setItem(KEY, next) } catch { /* Keep the session choice. */ }
  for (const listener of listeners) listener()
}

export function useLanguage() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, getLanguage)
}

/** Only theme-owned messages are translated, never node names or site content. */
export function t(zh: string, en: string): string {
  return language === "en" ? en : zh
}

document.documentElement.lang = language