"use client"

import { useMemo, useState, useTransition } from "react"

import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"


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
  grantedUserCount?: number
  rules: Array<{ id: string; ruleType: string; operator: string; value: string; extraValue?: string | null; sortOrder: number }>
  eligibility: {
    badgeId: string
    eligible: boolean
    alreadyGranted: boolean
    progressText: string
    failedRules: string[]
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
            <p className="mt-2 text-sm leading-7 text-muted-foreground">满足条件后由你自己手动领取。已领取的勋章可以选择展示在帖子用户名右侧，最多展示 {MAX_DISPLAYED_BADGES} 个。</p>
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
        {isLoggedIn ? <p className="mt-4 text-xs text-muted-foreground">当前已展示 {displayedCount} / {MAX_DISPLAYED_BADGES} 个勋章。</p> : null}
      </div>

      {!isLoggedIn ? <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">登录后可以查看自己哪些勋章已达成，并手动领取。</div> : null}
      {feedback ? <div className="rounded-[20px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((badge) => {
          const statusLabel = badge.eligibility.alreadyGranted ? "已领取" : badge.eligibility.eligible ? "可领取" : "未达成"
          const claimButtonLabel = badge.eligibility.alreadyGranted ? "已领取" : badge.eligibility.eligible ? "立即领取" : badge.eligibility.progressText
          const claimButtonDisabled = !isLoggedIn || badge.eligibility.alreadyGranted || !badge.eligibility.eligible || isPending
          const displayButtonLabel = badge.display.isDisplayed ? "取消展示" : "展示到帖子" 
          const displayButtonDisabled = !isLoggedIn || !badge.display.canDisplay || isPending || (!badge.display.isDisplayed && displayedCount >= MAX_DISPLAYED_BADGES)

          return (
            <div key={badge.id} className="overflow-hidden rounded-[28px] border border-border bg-card shadow-soft">
              <div className="p-5" style={{ background: `linear-gradient(135deg, ${badge.color}22 0%, transparent 100%)` }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] text-3xl" style={{ color: badge.color, backgroundColor: `${badge.color}14` }}>
                      <LevelIcon icon={badge.iconText} color={badge.color} className="h-7 w-7 text-[28px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">{badge.category || "社区成就"}</p>
                      <h2 className="mt-1 text-lg font-semibold">{badge.name}</h2>
                    </div>
                  </div>
                  <span className={badge.eligibility.alreadyGranted ? "rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700" : badge.eligibility.eligible ? "rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"}>{statusLabel}</span>
                </div>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{badge.description || "收集社区勋章，展示你的独特身份。"}</p>
              </div>

              <div className="space-y-4 p-5 pt-0">
                <div className="rounded-[22px] bg-secondary/40 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">领取条件</p>
                  <ul className="mt-2 space-y-1.5">
                    {badge.rules.length === 0 ? <li>无门槛，登录即可领取</li> : badge.rules.map((rule) => <li key={rule.id}>- {rule.value}{rule.extraValue ? ` ~ ${rule.extraValue}` : ""} · {rule.ruleType}</li>)}
                  </ul>
                </div>

                {badge.eligibility.failedRules.length > 0 && !badge.eligibility.alreadyGranted ? (
                  <div className="rounded-[22px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    当前差一点：{badge.eligibility.failedRules[0]}
                  </div>
                ) : null}

                {badge.eligibility.alreadyGranted ? (
                  <div className="rounded-[22px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    {badge.display.isDisplayed ? `当前已展示，展示顺序第 ${badge.display.displayOrder || 1} 位。` : `你已领取该勋章，可选择展示到帖子用户名右侧（最多 ${MAX_DISPLAYED_BADGES} 个）。`}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">已领取 {badge.grantedUserCount ?? 0} 人</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {badge.display.canDisplay ? (
                      <Button type="button" variant={badge.display.isDisplayed ? "secondary" : "outline"} disabled={displayButtonDisabled} onClick={() => handleToggleDisplay(badge.id)} className="rounded-full px-4">
                        {displayButtonLabel}
                      </Button>
                    ) : null}
                    <Button type="button" disabled={claimButtonDisabled} onClick={() => handleClaim(badge.id)} className="rounded-full px-5">
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
