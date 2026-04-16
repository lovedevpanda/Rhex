"use client"

import { ArrowUpRight, Search } from "lucide-react"
import { useSyncExternalStore } from "react"

import { buildExternalSearchUrl, type ExternalSearchEngine } from "@/lib/site-search-settings"

interface ExternalSearchOptionsProps {
  keyword: string
  engines: ExternalSearchEngine[]
  onSelect?: () => void
  siteHost?: string | null
  variant?: "menu" | "panel"
}

export function ExternalSearchOptions({
  keyword,
  engines,
  onSelect,
  siteHost,
  variant = "menu",
}: ExternalSearchOptionsProps) {
  const trimmedKeyword = keyword.trim()
  const browserSiteHost = useSyncExternalStore(
    () => () => undefined,
    () => window.location.host || null,
    () => null,
  )
  const resolvedSiteHost = siteHost !== undefined ? siteHost : browserSiteHost

  if (!trimmedKeyword) {
    return null
  }

  const searchKeyword = resolvedSiteHost ? `site:${resolvedSiteHost} ${trimmedKeyword}` : trimmedKeyword

  return (
    <div className={variant === "menu" ? "grid gap-1" : "grid gap-3 sm:grid-cols-2"}>
      {engines.map((engine) => {
        const href = buildExternalSearchUrl(engine.urlTemplate, searchKeyword)

        return (
          <a
            key={engine.id}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className={variant === "menu"
              ? "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
              : "flex items-center justify-between gap-3 rounded-[20px] border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40"}
            onClick={onSelect}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Search className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{engine.label}</span>
                {variant === "panel" ? <span className="mt-1 block text-xs text-muted-foreground">使用外部搜索继续查找 “{keyword}”</span> : null}
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        )
      })}
    </div>
  )
}
