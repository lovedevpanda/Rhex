"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"

interface SidebarZoneItem {
  id: string
  slug: string
  name: string
  icon: string
  hiddenFromSidebar?: boolean
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
  collapsed?: boolean
  onToggle?: () => void
}

export function SidebarNavigation({ zones, boards, activeZoneSlug, activeBoardSlug, collapsed = false, onToggle }: SidebarNavigationProps) {
  const baseItemClass = "flex items-center gap-3 rounded-md px-4 py-2 text-sm transition-colors"
  const activeItemClass = "bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.08)_75%,transparent_75%,transparent)] bg-[length:8px_8px] font-medium text-foreground"
  const inactiveItemClass = "text-muted-foreground hover:bg-accent hover:text-foreground"
  const visibleZones = zones.filter((zone) => !zone.hiddenFromSidebar)

  return (
    <div className="forum-page-sidebar hidden lg:-ml-2 lg:block">
      <aside className="forum-page-sidebar-inner sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-1 pr-4">
        <div className="space-y-6 py-4">
          <div>
            <nav className="space-y-1">
              <div className="forum-page-sidebar-home-row flex items-center gap-2">
                <Link
                  href="/"
                  className={`${baseItemClass} forum-page-home-link flex-1 ${!activeZoneSlug && !activeBoardSlug ? activeItemClass : inactiveItemClass}`}
                  title="首页"
                >
                  <span className="text-lg">🏠</span>
                  <span>首页</span>
                </Link>
                <button
                  type="button"
                  onClick={onToggle}
                  className="forum-page-sidebar-toggle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={collapsed ? "展开左侧导航" : "收起左侧导航"}
                  title={collapsed ? "展开左侧导航" : "收起左侧导航"}
                >
                  <ChevronLeft className="forum-page-sidebar-toggle-icon h-4 w-4 transition-transform" />
                </button>
              </div>
    
              {visibleZones.map((zone) => {
                const isActive = activeZoneSlug === zone.slug

                return (
                  <Link
                    key={zone.id}
                    href={`/zones/${zone.slug}`}
                    className={`${baseItemClass} forum-page-sidebar-item ${isActive ? activeItemClass : inactiveItemClass}`}
                    title={zone.name}
                  >
                    <LevelIcon icon={zone.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                    <span className="forum-page-sidebar-item-label">{zone.name}</span>
                  </Link>

                )
              })}
            </nav>
          </div>

          <div>
            <div className="forum-page-sidebar-section-header mb-2 px-4">
              <div className="flex items-center justify-between">
                <h3 className="forum-page-sidebar-section-title text-xs font-semibold uppercase tracking-wider text-muted-foreground">兴趣节点</h3>
                <Link href="/funs" className="forum-page-sidebar-section-link text-xs text-muted-foreground hover:text-foreground">全部</Link>
                <div className="forum-page-sidebar-section-divider mx-auto hidden h-px w-8 bg-border" />
              </div>
            </div>
            <nav className="space-y-1">
              {boards.map((board) => {
                const isActive = activeBoardSlug === board.slug

                return (
                  <Link
                    key={board.id}
                    href={`/boards/${board.slug}`}
                    className={`${baseItemClass} forum-page-sidebar-item ${isActive ? activeItemClass : inactiveItemClass}`}
                    title={board.name}
                  >
                    <LevelIcon icon={board.icon} className="h-4 w-4 text-lg" svgClassName="[&>svg]:block" />
                    <span className="forum-page-sidebar-item-label truncate">{board.name}</span>
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
