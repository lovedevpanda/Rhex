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
  title: string
  icon: string
  description: string
  summary: string
  pills: CategoryPill[]
  defaultVisibleCount?: number
  actions?: ReactNode
}

export function CollapsibleInfoCard({ badge, title, icon, description, summary, pills, defaultVisibleCount = 7, actions }: CollapsibleInfoCardProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const shouldCollapsePills = pills.length > defaultVisibleCount
  const visiblePills = expanded || !shouldCollapsePills ? pills : pills.slice(0, defaultVisibleCount)

  return (
    <>
      <div className="px-4 pt-4 pb-1">
        <div className="flex flex-col gap-2 border-b border-border/80 pb-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {visiblePills.map((pill) => (
              <Link
                key={pill.id}
                href={pill.href}
                className={pill.active ? "inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors" : "inline-flex items-center gap-1 rounded-full border border-transparent bg-transparent px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"}
              >
                <LevelIcon icon={pill.icon} className="h-3.5 w-3.5 text-[13px] leading-none" svgClassName="[&>svg]:block" />
                <span>{pill.label}</span>
              </Link>

            ))}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 lg:pl-3">
           
            {shouldCollapsePills ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-transparent bg-transparent px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? "" : `${pills.length - defaultVisibleCount}`}
              </button>
            ) : null}

            <button
              type="button"
              className={open ? "inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2 py-1 text-[10px] font-medium text-foreground transition-colors" : "inline-flex items-center gap-1 rounded-full border border-transparent bg-transparent px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"}
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
            >
              <Info className="h-3 w-3" />

            </button>

                           {actions}

          </div>
        </div>
      </div>

      {open ? (
        <div className="overflow-hidden rounded-[28px] border-none bg-gradient-to-r from-[#1f1b16] via-[#2e261f] to-[#382c22] text-white shadow-soft">
          <div className="p-8">
            <div className="mb-4 flex items-center gap-3">
              <LevelIcon icon={icon} className="h-8 w-8 text-3xl" svgClassName="[&>svg]:block" />
              <div>

                <p className="text-sm text-white/70">{badge}</p>
                <h1 className="text-3xl font-semibold">{title}</h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-white/75 md:text-base">{description}</p>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/70">
              <span>{summary}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/15"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
                收起
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
