"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/rbutton"
import { Tooltip } from "@/components/ui/tooltip"


interface BadgeCenterItem {
  id: string
  name: string
  code: string
  description?: string | null
  iconPath?: string | null
  iconText?: string | null
  color: string
  imageUrl?: string | null
  category?: string | null
  pointsCost: number
  grantedUserCount?: number
  rules: Array<{ id: string; ruleType: string; operator: string; value: string; extraValue?: string | null; sortOrder: number }>
  eligibility: {
    badgeId: string
    eligible: boolean
    alreadyGranted: boolean
    progressText: string
    failedRules: string[]
    pointsCost: number
    purchaseRequired: boolean
    canAffordPurchase: boolean
  }
  display: {
    isDisplayed: boolean
    displayOrder: number
    canDisplay: boolean
  }
}

interface BadgeCenterProps {
  badges: BadgeCenterItem[]
  isLoggedIn: boolean
}

const MAX_DISPLAYED_BADGES = 3

export function BadgeCenter({ badges, isLoggedIn }: BadgeCenterProps) {
  const [items, setItems] = useState(badges)
  const [activeCategory, setActiveCategory] = useState<string>("全部")
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const categories = useMemo(() => {
    const values = Array.from(new Set(items.map((badge) => badge.category || "社区成就")))
    return ["全部", ...values]
  }, [items])

  const displayedCount = useMemo(() => items.filter((item) => item.display.isDisplayed).length, [items])

  const filteredItems = useMemo(() => {
    if (activeCategory === "全部") {
      return items
    }

    return items.filter((badge) => (badge.category || "社区成就") === activeCategory)
  }, [activeCategory, items])

  function handleClaim(badgeId: string) {
    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/badges/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "领取成功" : "领取失败"))
      if (response.ok) {
        setItems((current) => current.map((item) => (item.id === badgeId ? {
          ...item,
          grantedUserCount: (item.grantedUserCount ?? 0) + 1,
          eligibility: {
            ...item.eligibility,
            alreadyGranted: true,
            eligible: true,
            progressText: "已领取",
          },
          display: {
            ...item.display,
            canDisplay: true,
          },
        } : item)))
      }
    })
  }

  function handleToggleDisplay(badgeId: string) {
    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/badges/display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "设置成功" : "设置失败"))

      if (!response.ok) {
        return
      }

      const nextDisplayed = Boolean(result.data?.isDisplayed)
      const nextOrder = Number(result.data?.displayOrder ?? 0)

      setItems((current) => current.map((item) => {
        if (item.id !== badgeId) {
          return item
        }

        return {
          ...item,
          display: {
            ...item.display,
            isDisplayed: nextDisplayed,
            displayOrder: nextOrder,
          },
        }
      }))
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Badge Center</p>
            <h1 className="mt-2 text-3xl font-semibold">社区勋章中心</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">满足条件后由你自己手动领取。已领取的勋章可以选择佩戴在帖子用户名右侧，最多佩戴{MAX_DISPLAYED_BADGES} 个。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={activeCategory === category ? "rounded-full bg-foreground px-4 py-2 text-sm text-background" : "rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        {isLoggedIn ? <p className="mt-4 text-xs text-muted-foreground">当前已佩戴 {displayedCount} / {MAX_DISPLAYED_BADGES} 个勋章。</p> : null}
      </div>

      {!isLoggedIn ? <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">登录后可以查看自己哪些勋章已达成，并手动领取。</div> : null}
      {feedback ? <div className="rounded-[20px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {filteredItems.map((badge) => {
          const statusLabel = badge.eligibility.alreadyGranted ? "已领取" : badge.eligibility.eligible ? "可领取" : "未达成"
          const claimButtonLabel = badge.eligibility.alreadyGranted
            ? "已领取"
            : !badge.eligibility.eligible
              ? badge.eligibility.progressText
              : badge.eligibility.purchaseRequired
                ? badge.eligibility.canAffordPurchase
                  ? `支付 ${badge.eligibility.pointsCost} 积分领取`
                  : `需要 ${badge.eligibility.pointsCost} 积分`
                : "立即领取"
          const claimButtonDisabled = !isLoggedIn || badge.eligibility.alreadyGranted || !badge.eligibility.eligible || isPending || (badge.eligibility.purchaseRequired && !badge.eligibility.canAffordPurchase)
          const displayButtonLabel = badge.display.isDisplayed ? "取消佩戴" : "佩戴" 
          const displayButtonDisabled = !isLoggedIn || !badge.display.canDisplay || isPending || (!badge.display.isDisplayed && displayedCount >= MAX_DISPLAYED_BADGES)
          const displayButtonTooltip = badge.display.isDisplayed
            ? `当前已佩戴，顺序第 ${badge.display.displayOrder || 1} 位。`
            : `已领取，可佩戴到用户名右侧，最多 ${MAX_DISPLAYED_BADGES} 个。`

          return (
            <div key={badge.id} className="flex h-full flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-soft">
              <div className="p-4" style={{ background: `linear-gradient(135deg, ${badge.color}22 0%, transparent 100%)` }}>
                <div className="flex items-start justify-between gap-2.5">
                  <Link href={`/badges/${badge.code}`} className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-2xl" style={{ color: badge.color, backgroundColor: `${badge.color}14` }}>
                      <LevelIcon icon={badge.iconText} color={badge.color} className="h-5.5 w-5.5 text-[22px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[11px] leading-4 text-muted-foreground">{badge.category || "社区成就"}</p>
                      <h2 className="mt-0.5 line-clamp-1 text-base font-semibold leading-5">{badge.name}</h2>
                    </div>
                  </Link>
                  <span className={badge.eligibility.alreadyGranted ? "shrink-0 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700" : badge.eligibility.eligible ? "shrink-0 whitespace-nowrap rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-700" : "shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"}>{statusLabel}</span>
                </div>
                <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-muted-foreground">{badge.description || "收集社区勋章，佩戴你的独特身份。"}</p>
              </div>

              <div className="flex flex-1 items-center p-4 pt-3">
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {badge.display.canDisplay ? (
                      <Tooltip content={displayButtonTooltip}>
                        <Button type="button" variant={badge.display.isDisplayed ? "secondary" : "outline"} disabled={displayButtonDisabled} onClick={() => handleToggleDisplay(badge.id)} className="h-7 rounded-full px-3 text-xs">
                          {displayButtonLabel}
                        </Button>
                      </Tooltip>
                    ) : null}
                    <Button type="button" disabled={claimButtonDisabled} onClick={() => handleClaim(badge.id)} className="h-7 rounded-full px-4 text-xs">
                      {claimButtonLabel}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
