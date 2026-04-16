"use client"

import type { ReactNode } from "react"
import { useState } from "react"
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
  tabs: UserRecentActivityTab[]
  defaultTabKey?: string
}

const defaultActivityTabMeta: Record<string, { icon: LucideIcon }> = {
  introduction: { icon: Sparkles },
  posts: { icon: FileText },
  replies: { icon: MessageSquareText },
  collections: { icon: FolderOpen },
}

export function UserRecentActivityPanel({
  title = "最近动态",
  description,
  tabs,
  defaultTabKey,
}: UserRecentActivityPanelProps) {
  const fallbackTabKey = defaultTabKey ?? tabs[0]?.key ?? ""
  const [activeTab, setActiveTab] = useState<string>(fallbackTabKey)
  const resolvedActiveTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : fallbackTabKey
  const currentTab = tabs.find((tab) => tab.key === resolvedActiveTab) ?? tabs[0]
  const totalCount = tabs.reduce((sum, tab) => sum + (typeof tab.count === "number" ? tab.count : 0), 0)

  return (
    <Card className="rounded-2xl border  shadow-xs">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefef] pb-4 dark:border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
      <span className="rounded-full bg-[#f5f5f5] dark:bg-slate-800 px-3 py-1 text-xs font-medium text-muted-foreground dark:text-slate-300">
  共 {totalCount} 条活动
</span>
        </div>
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon ?? defaultActivityTabMeta[tab.key]?.icon ?? FileText
              const active = currentTab?.key === tab.key

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-1 rounded-full border px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  <Icon className="hidden h-4 w-4 sm:block" />
                  <span>{tab.label}</span>
                  {typeof tab.count === "number" ? (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px]", active ? "bg-background/15 text-background" : "bg-secondary text-muted-foreground")}>
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div>{currentTab?.content}</div>
        </div>
      </CardContent>
    </Card>
  )
}
