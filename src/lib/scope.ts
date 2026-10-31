import { t } from "@/lib/i18n"
import type { Node } from "@/lib/api"

/**
 * What the page is showing. A group is operator-written text and could be
 * called t("全部节点", "All nodes") or t("离线", "Offline") as easily as anything else, so the two virtual
 * scopes are their own cases instead of magic strings sharing that space.
 */
export type Scope =
  | { kind: "all" }
  | { kind: "online" }
  | { kind: "offline" }
  | { kind: "group"; name: string }

export const ALL: Scope = { kind: "all" }
export const ONLINE: Scope = { kind: "online" }
export const OFFLINE: Scope = { kind: "offline" }

export function inScope(node: Node, scope: Scope): boolean {
  switch (scope.kind) {
    case "all":
      return true
    case "online":
      return node.online
    case "offline":
      return !node.online
    case "group":
      return (node.group ?? "") === scope.name
  }
}

export function scopeLabel(scope: Scope): string {
  switch (scope.kind) {
    case "all":
      return t("全部节点", "All nodes")
    case "online":
      return t("全部在线", "All online")
    case "offline":
      return t("离线", "Offline")
    case "group":
      return scope.name
  }
}

export function sameScope(a: Scope, b: Scope): boolean {
  if (a.kind !== b.kind) return false
  return a.kind !== "group" || b.kind !== "group" || a.name === b.name
}
