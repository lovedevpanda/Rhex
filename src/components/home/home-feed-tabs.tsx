import Link from "next/link"
import { Clock3, Flame, Globe2, Sparkles, Users2 } from "lucide-react"

import { buildHomeFeedHref, type HomeFeedSort } from "@/lib/home-feed-route"

const BASE_TABS: Array<{ key: HomeFeedSort; label: string; icon: typeof Clock3 }> = [
  { key: "latest", label: "最新", icon: Clock3 },
  { key: "new", label: "新贴", icon: Sparkles },
  { key: "hot", label: "热门", icon: Flame },
  { key: "following", label: "关注", icon: Users2 },
  { key: "universe", label: "宇宙", icon: Globe2 },
]

export function HomeFeedTabs({
  currentSort,
  showUniverse,
}: {
  currentSort: HomeFeedSort
  showUniverse: boolean
}) {
  const tabs = showUniverse ? BASE_TABS : BASE_TABS.filter((item) => item.key !== "universe")

  return (
    <div className="flex flex-nowrap items-center justify-start gap-1 overflow-x-auto border-b py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2 lg:px-4 lg:py-3">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = currentSort === tab.key

        return (
          <Link
            key={tab.key}
            href={buildHomeFeedHref(tab.key)}
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
