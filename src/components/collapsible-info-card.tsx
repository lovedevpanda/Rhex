"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronUp, Info, X } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"

interface CategoryPill {
  id: string
  label: string
  icon: string
  href: string
  active?: boolean
}

interface CollapsibleInfoCardProps {
  badge: string
  title?: string
  icon: string
  description: string
  summary: string
  pills: CategoryPill[]
  defaultVisibleCount?: number
  actions?: ReactNode
  summaryActions?: ReactNode
  alwaysOpen?: boolean
  hidePills?: boolean
  detailAction?: ReactNode
}

export function CollapsibleInfoCard({
  badge,
  title,
  icon,
  description,
  summary,
  pills,
  defaultVisibleCount = 7,
  actions,
  summaryActions,
  alwaysOpen = false,
  hidePills = false,
  detailAction,
}: CollapsibleInfoCardProps) {
  const [open, setOpen] = useState(alwaysOpen)
  const [expanded, setExpanded] = useState(false)

  const shouldCollapsePills = !hidePills && pills.length > defaultVisibleCount
  const visiblePills = hidePills ? [] : expanded || !shouldCollapsePills ? pills : pills.slice(0, defaultVisibleCount)
  const showTopBar = visiblePills.length > 0 || shouldCollapsePills || !alwaysOpen || Boolean(actions)
  const resolvedDetailAction = detailAction ?? (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={() => setOpen(false)}
    >
      <X className="h-3 w-3" />
      收起
    </button>
  )

  return (
    <>
      {showTopBar ? (
        <div className="px-3 pt-2 pb-1">
          <div className="flex flex-col gap-1.5 border-b border-border/80 pb-1.5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {visiblePills.map((pill) => (
                <Link
                  key={pill.id}
                  href={pill.href}
                  className={pill.active ? "inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2 py-0.5 text-[10px] font-medium text-foreground transition-colors" : "inline-flex items-center gap-1 rounded-full border border-transparent bg-transparent px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"}
                >
                  <LevelIcon icon={pill.icon} className="h-3 w-3 text-[12px] leading-none" svgClassName="[&>svg]:block" />
                  <span>{pill.label}</span>
                </Link>
              ))}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1 lg:pl-3">
              {shouldCollapsePills ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-transparent bg-transparent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? "" : `${pills.length - defaultVisibleCount}`}
                </button>
              ) : null}

              {!alwaysOpen ? (
                <button
                  type="button"
                  className={open ? "inline-flex items-center gap-1 rounded-full border border-border bg-accent px-1.5 py-0.5 text-[10px] font-medium text-foreground transition-colors" : "inline-flex items-center gap-1 rounded-full border border-transparent bg-transparent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"}
                  onClick={() => setOpen((current) => !current)}
                  aria-expanded={open}
                >
                  <Info className="h-3 w-3" />
                </button>
              ) : null}
              {actions}
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 left-6 h-20 w-20 rounded-full bg-accent blur-2xl" />
          <div className="absolute bottom-3 right-3 top-3 z-10 flex w-[120px] flex-col items-end justify-between">
            {resolvedDetailAction}
            <div className="flex justify-end">
              {summaryActions}
            </div>
          </div>
          <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-4 pr-38">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] text-foreground/90 sm:h-11 sm:w-11">
              <LevelIcon icon={icon} className="h-full w-full text-[2rem]" svgClassName="[&>svg]:block" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{badge}</p>
                <span className="inline-flex max-w-full items-center rounded-full border border-border bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                  <span className="truncate">{summary}</span>
                </span>
              </div>
              {title ? <h1 className="text-base font-semibold leading-tight text-foreground sm:text-lg">{title}</h1> : null}
              <p className="min-w-0 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
