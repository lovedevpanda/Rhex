import Link from "next/link"
import type { ReactNode } from "react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
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
      <AddonSlotRenderer slot="faq.page.before" />
      <AddonSurfaceRenderer surface="faq.page" props={{ currentPath }}>
        <>
          <AddonSlotRenderer slot="faq.tabs.before" />
          <AddonSurfaceRenderer surface="faq.tabs" props={{ currentPath }}>
            <div className="sticky top-20 z-10 pb-1">
              <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="inline-flex min-w-max gap-2 rounded-[24px] border border-border bg-card p-2 shadow-xs md:flex md:min-w-0 md:flex-wrap">
                  {FAQ_TABS.map((tab) => (
                    <Link key={tab.href} href={tab.href} className={tabClassName(currentPath === tab.href)}>
                      {tab.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="faq.tabs.after" />

          <AddonSlotRenderer slot="faq.content.before" />
          <AddonSurfaceRenderer surface="faq.content" props={{ currentPath }}>
            {children}
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="faq.content.after" />
        </>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="faq.page.after" />
    </div>
  )
}
