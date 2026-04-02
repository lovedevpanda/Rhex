import Link from "next/link"
import type { ReactNode } from "react"

import { FAQ_TABS } from "@/lib/faq"
import { cn } from "@/lib/utils"

interface FaqPageFrameProps {
  currentPath: string
  eyebrow?: string
  title: string
  description: string
  children: ReactNode
}

function tabClassName(active: boolean) {
  return cn(
    "inline-flex min-w-fit items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-foreground text-background"
      : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  )
}

export function FaqPageFrame({ currentPath, children }: FaqPageFrameProps) {
  return (
    <div className="space-y-6">


      <div className="sticky top-20 z-10 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-2 rounded-[24px] border border-border bg-card p-2 shadow-sm">
          {FAQ_TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={tabClassName(currentPath === tab.href)}>
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}
