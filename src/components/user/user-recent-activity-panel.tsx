import Link from "next/link"
import type { ReactNode } from "react"
import { FileText, FolderOpen, MessageSquareText, Sparkles, type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface UserRecentActivityTab {
  key: string
  label: string
  count?: number
  icon?: LucideIcon
  content: ReactNode
}

interface UserRecentActivityPanelProps {
  title?: string
  description: string
  className?: string
  showSummary?: boolean
  tabs: UserRecentActivityTab[]
  activeTabKey?: string
  buildTabHref: (tabKey: string) => string
}

const defaultActivityTabMeta: Record<string, { icon: LucideIcon }> = {
  introduction: { icon: Sparkles },
  posts: { icon: FileText },
  replies: { icon: MessageSquareText },
  collections: { icon: FolderOpen },
}

function formatTabCount(count: number) {
  if (count > 99) {
    return "99+"
  }

  return String(count)
}

export function UserRecentActivityPanel({
  title = "最近动态",
  description,
  className,
  showSummary = true,
  tabs,
  activeTabKey,
  buildTabHref,
}: UserRecentActivityPanelProps) {
  const fallbackTabKey = tabs[0]?.key ?? ""
  const resolvedActiveTab = tabs.some((tab) => tab.key === activeTabKey) ? activeTabKey : fallbackTabKey
  const currentTab = tabs.find((tab) => tab.key === resolvedActiveTab) ?? tabs[0]
  const totalCount = tabs.reduce((sum, tab) => sum + (typeof tab.count === "number" ? tab.count : 0), 0)
  const compact = !showSummary

  return (
    <Card className={cn("border shadow-xs", compact ? "rounded-t-none" : "rounded-2xl", className)}>
      <CardContent className={cn(compact ? "p-0" : "p-5")}>
        {showSummary ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefef] pb-4 dark:border-white/10">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-slate-800 dark:text-slate-300">
              共 {totalCount} 条活动
            </span>
          </div>
        ) : null}
        <div className={cn("flex flex-col gap-4", showSummary ? "pt-4" : "")}>
          <div className={cn(
            compact
              ? "flex flex-nowrap items-center gap-6 overflow-x-auto border-b border-border px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-x-8 sm:gap-y-2 sm:overflow-visible"
              : "grid grid-cols-4 gap-1.5 sm:gap-2",
          )}>
            {tabs.map((tab) => {
              const Icon = tab.icon ?? defaultActivityTabMeta[tab.key]?.icon ?? FileText
              const active = currentTab?.key === tab.key

              return (
                <Link
                  key={tab.key}
                  href={buildTabHref(tab.key)}
                  scroll={false}
                  className={cn(
                    compact
                      ? "inline-flex shrink-0 items-center gap-1.5 border-b-[3px] px-0 pb-3 text-[15px] font-medium transition-colors"
                      : "inline-flex w-full items-center justify-center gap-1 rounded-full border px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm",
                    compact
                      ? active
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                      : active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  <Icon className={cn(compact ? "hidden" : "hidden h-4 w-4 sm:block")} />
                  <span>{tab.label}</span>
                  {typeof tab.count === "number" ? (
                    <span className={cn(
                      compact
                        ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none"
                        : "rounded-full px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px]",
                      compact
                        ? active
                          ? "bg-foreground/8 text-foreground/75"
                          : "bg-secondary/80 text-muted-foreground"
                        : active
                          ? "bg-background/15 text-background"
                          : "bg-secondary text-muted-foreground",
                    )}>
                      {formatTabCount(tab.count)}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>

          <div className={cn(compact ? "px-1 py-1" : "")}>{currentTab?.content}</div>
        </div>
      </CardContent>
    </Card>
  )
}
