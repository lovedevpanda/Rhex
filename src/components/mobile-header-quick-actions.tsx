"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CheckCircle2, ChevronLeft, ChevronRight, Compass, Grid2x2, PenSquare, Search, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import type { SiteBoardItem } from "@/lib/boards"
import type { SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"
import { cn } from "@/lib/utils"
import type { SiteZoneItem } from "@/lib/zones"

interface MobileHeaderQuickActionsProps {
  isLoggedIn: boolean
  checkInEnabled: boolean
  checkedInToday: boolean
  appLinks: SiteHeaderAppLinkItem[]
  zones: SiteZoneItem[]
  boards: SiteBoardItem[]
}

type MobileHeaderPanelView = "main" | "nodes"

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase()
}

export function MobileHeaderQuickActions({
  isLoggedIn,
  checkInEnabled,
  checkedInToday: initialCheckedInToday,
  appLinks,
  zones,
  boards,
}: MobileHeaderQuickActionsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<MobileHeaderPanelView>("main")
  const [checkedInToday, setCheckedInToday] = useState(initialCheckedInToday)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")

  const zoneMap = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones])

  const boardsWithZone = useMemo(() => boards.map((board) => ({
    ...board,
    zone: board.zoneId ? zoneMap.get(board.zoneId) ?? null : null,
  })), [boards, zoneMap])

  const currentBoard = useMemo(() => {
    const matched = pathname.match(/^\/boards\/([^/?#]+)/)
    if (!matched?.[1]) {
      return null
    }

    return boardsWithZone.find((board) => board.slug === matched[1]) ?? null
  }, [boardsWithZone, pathname])

  const currentZone = useMemo(() => {
    const matched = pathname.match(/^\/zones\/([^/?#]+)/)
    if (matched?.[1]) {
      return zones.find((zone) => zone.slug === matched[1]) ?? null
    }

    if (currentBoard?.zone) {
      return currentBoard.zone
    }

    return null
  }, [currentBoard?.zone, pathname, zones])

  const [selectedZoneSlug, setSelectedZoneSlug] = useState(currentZone?.slug ?? zones[0]?.slug ?? "")

  useEffect(() => {
    setCheckedInToday(initialCheckedInToday)
  }, [initialCheckedInToday])

  useEffect(() => {
    if (!open) {
      setView("main")
      setKeyword("")
      setSelectedZoneSlug(currentZone?.slug ?? zones[0]?.slug ?? "")
    }
  }, [currentZone?.slug, open, zones])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const visibleAppLinks = useMemo(() => appLinks.filter((item) => item.href !== "/write"), [appLinks])

  const normalizedKeyword = normalizeKeyword(keyword)

  const visibleBoards = useMemo(() => {
    if (normalizedKeyword) {
      return boardsWithZone.filter((board) => {
        const boardName = normalizeKeyword(board.name)
        const zoneName = normalizeKeyword(board.zone?.name ?? "")
        return boardName.includes(normalizedKeyword) || zoneName.includes(normalizedKeyword)
      })
    }

    if (!selectedZoneSlug) {
      return boardsWithZone
    }

    const selectedZone = zones.find((zone) => zone.slug === selectedZoneSlug)
    if (!selectedZone) {
      return boardsWithZone
    }

    return boardsWithZone.filter((board) => board.zoneId === selectedZone.id)
  }, [boardsWithZone, normalizedKeyword, selectedZoneSlug, zones])

  const nodeEntryTitle = currentBoard?.name ?? currentZone?.name ?? "切换节点"
  const nodeEntryDescription = currentBoard?.zone
    ? `${currentBoard.zone.name} · 当前节点`
    : currentZone
      ? "当前分区"
      : "浏览分区与节点"
  const checkInLabel = !isLoggedIn ? "登录后签到" : checkedInToday ? "今日已签到" : loading ? "签到中..." : "立即签到"

  async function handleCheckIn() {
    if (!isLoggedIn) {
      setOpen(false)
      router.push("/login")
      return
    }

    if (!checkInEnabled || checkedInToday || loading) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-in" }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message ?? "签到失败", "签到失败")
        return
      }

      setCheckedInToday(true)
      toast.success(result.message ?? "签到成功", "签到成功")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("签到失败，请稍后再试", "签到失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="sm:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-md"
          onClick={() => setOpen(true)}
          aria-label="打开移动导航"
          title="打开移动导航"
        >
          <Grid2x2 className="h-4 w-4" />
          {isLoggedIn && !checkedInToday ? (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
          ) : null}
        </Button>
      </div>

      <DialogPortal open={open} onClose={() => setOpen(false)}>
        <div className="fixed inset-0 z-[120] sm:hidden">
          <DialogBackdrop onClick={() => setOpen(false)} className="bg-black/55" />
          <div className="absolute inset-x-0 bottom-0">
            <DialogPanel className="max-h-[88vh] rounded-b-none border-b-0 px-4 pb-5 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />

              {view === "main" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">导航</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => setOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setView("nodes")}
                    className="flex w-full items-center justify-between rounded-[20px] border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Compass className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{nodeEntryTitle}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{nodeEntryDescription}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">快捷操作</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={isLoggedIn ? "/write" : "/login"}
                        className="rounded-[18px] border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40"
                        onClick={() => setOpen(false)}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <PenSquare className="h-4 w-4 text-muted-foreground" />
                          <span>发帖</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{isLoggedIn ? "发布新的主题内容" : "登录后即可发帖"}</p>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          void handleCheckIn()
                        }}
                        disabled={(isLoggedIn && (!checkInEnabled || checkedInToday)) || loading}
                        className={cn(
                          "rounded-[18px] border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40",
                          ((isLoggedIn && (!checkInEnabled || checkedInToday)) || loading) && "opacity-70",
                        )}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle2 className={checkedInToday ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-muted-foreground"} />
                          <span>签到</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{checkInLabel}</p>
                      </button>
                    </div>
                  </section>

                  {visibleAppLinks.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">应用入口</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {visibleAppLinks.map((item) => {
                          const isExternal = /^https?:\/\//i.test(item.href)

                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              target={isExternal ? "_blank" : undefined}
                              rel={isExternal ? "noreferrer noopener" : undefined}
                              className="rounded-[18px] border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40"
                              onClick={() => setOpen(false)}
                            >
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <LevelIcon icon={item.icon} className="h-4 w-4 text-base" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name} />
                                <span className="truncate">{item.name}</span>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => setView("main")}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="min-w-0">
                        <p className="text-base font-semibold">切换节点</p>
                        <p className="mt-1 text-xs text-muted-foreground">按分区浏览节点，也可以直接搜索。</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => setOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder="搜索分区或节点..."
                      className="h-10 w-full rounded-full border border-border bg-muted/50 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
                      type="search"
                    />
                  </div>

                  {!normalizedKeyword ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {zones.map((zone) => {
                        const active = zone.slug === selectedZoneSlug

                        return (
                          <button
                            key={zone.id}
                            type="button"
                            onClick={() => setSelectedZoneSlug(zone.slug)}
                            className={active ? "shrink-0 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background" : "shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                          >
                            {zone.name}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                    {visibleBoards.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        没找到匹配的节点。
                      </div>
                    ) : null}

                    {visibleBoards.map((board) => {
                      const isActive = board.slug === currentBoard?.slug

                      return (
                        <Link
                          key={board.id}
                          href={`/boards/${board.slug}`}
                          className={isActive ? "block rounded-[20px] border border-foreground/15 bg-accent px-4 py-3" : "block rounded-[20px] border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40"}
                          onClick={() => setOpen(false)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <LevelIcon icon={board.icon} className="h-4 w-4 text-base" svgClassName="[&>svg]:block" />
                                <p className="truncate text-sm font-medium text-foreground">{board.name}</p>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{board.zone?.name ?? "未分区节点"}</p>
                            </div>
                            {isActive ? <span className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-background">当前</span> : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </DialogPanel>
          </div>
        </div>
      </DialogPortal>
    </>
  )
}
