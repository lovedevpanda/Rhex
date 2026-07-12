import Link from "next/link"
import { Clock3, Flame, Globe2, MessageCircle, Sparkles, Star, Users2 } from "lucide-react"

import type { ResolvedHomeFeedTab } from "@/lib/home-feed-tabs"

export function HomeFeedTabs({
  currentKey,
  tabs,
}: {
  currentKey: string
  tabs: ResolvedHomeFeedTab[]
}) {
  return (
    <div className="flex flex-nowrap items-center justify-start gap-1 overflow-x-auto border-b py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2 lg:px-4 lg:py-3">
      {tabs.map((tab) => {
        const Icon = tab.kind === "builtin"
          ? tab.key === "latest"
            ? Clock3
            : tab.key === "new"
              ? Sparkles
              : tab.key === "hot"
                ? Flame
                : tab.key === "featured"
                  ? Star
                  : tab.key === "following"
                    ? Users2
                    : Globe2
          : MessageCircle
        const active = currentKey === tab.key

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={active ? "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-foreground sm:px-4 sm:py-2 sm:text-sm lg:gap-2" : "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 sm:px-4 sm:py-2 sm:text-sm lg:gap-2"}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
