"use client"

import Link from "next/link"

interface AdminPillTabItem {
  key: string
  label: string
  href?: string
  onSelect?: () => void
}

interface AdminPillTabsProps {
  items: readonly AdminPillTabItem[]
  activeKey: string
  containerClassName?: string
  inactiveStyle?: "secondary" | "outlined"
}

export function AdminPillTabs({
  items,
  activeKey,
  containerClassName = "flex flex-wrap gap-2",
  inactiveStyle = "secondary",
}: AdminPillTabsProps) {
  return (
    <div className={containerClassName}>
      {items.map((item) => {
        const active = activeKey === item.key
        const className = active
          ? "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          : inactiveStyle === "outlined"
            ? "rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            : "rounded-full bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={className}>
              {item.label}
            </Link>
          )
        }

        return (
          <button key={item.key} type="button" onClick={item.onSelect} className={className}>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
