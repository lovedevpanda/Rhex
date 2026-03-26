import Link from "next/link"

import { LevelIcon } from "@/components/level-icon"

interface SidebarZoneItem {
  id: string
  slug: string
  name: string
  icon: string
  minViewPoints?: number
  minViewLevel?: number
  vipViewOnly?: boolean
  minViewVipLevel?: number
}

interface SidebarBoardItem {
  id: string
  slug: string
  name: string
  icon: string
  minViewPoints?: number
  minViewLevel?: number
  vipViewOnly?: boolean
  minViewVipLevel?: number
}

interface SidebarNavigationProps {
  zones: SidebarZoneItem[]
  boards: SidebarBoardItem[]
  activeZoneSlug?: string
  activeBoardSlug?: string
}

export function SidebarNavigation({ zones, boards, activeZoneSlug, activeBoardSlug }: SidebarNavigationProps) {
  const baseItemClass = "flex items-center gap-3 rounded-md px-4 py-2 text-sm transition-colors"
  const activeItemClass = "bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.08)_75%,transparent_75%,transparent)] bg-[length:8px_8px] font-medium text-foreground"
  const inactiveItemClass = "text-muted-foreground hover:bg-accent hover:text-foreground"

  return (
    <div className="hidden -mr-6 lg:col-span-2 lg:block">
      <aside className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto pr-4 py-1">
        <div className="space-y-6 py-4">
          <div>
            <nav className="space-y-1">
              <Link href="/" className={`${baseItemClass} ${!activeZoneSlug && !activeBoardSlug ? activeItemClass : inactiveItemClass}`}>
                <span className="text-lg">🏠</span>
                <span>首页</span>
              </Link>
    
              {zones.map((zone) => {
                const isActive = activeZoneSlug === zone.slug

                return (
                  <Link key={zone.id} href={`/zones/${zone.slug}`} className={`${baseItemClass} ${isActive ? activeItemClass : inactiveItemClass}`}>
                    <LevelIcon icon={zone.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                    <span>{zone.name}</span>
                  </Link>

                )
              })}
            </nav>
          </div>

          <div>
            <div className="mb-2 px-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">兴趣节点</h3>
                <Link href="/funs" className="text-xs text-muted-foreground hover:text-foreground">全部</Link>
              </div>
            </div>
            <nav className="space-y-1">
              {boards.map((board) => {
                const isActive = activeBoardSlug === board.slug

                return (
                  <Link key={board.id} href={`/boards/${board.slug}`} className={`${baseItemClass} ${isActive ? activeItemClass : inactiveItemClass}`}>
                    <LevelIcon icon={board.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                    <span className="truncate">{board.name}</span>
                  </Link>

                )
              })}
            </nav>
          </div>
        </div>
      </aside>
    </div>
  )
}
