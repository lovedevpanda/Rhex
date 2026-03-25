import Link from "next/link"
import { ChevronRight, Link2 } from "lucide-react"

import type { FriendLinkItem } from "@/lib/friend-links"

interface FriendLinkSectionProps {
  links: FriendLinkItem[]
  total: number
}

export function FriendLinkSection({ links }: FriendLinkSectionProps) {

  if (links.length === 0) {
    return null
  }

  return (
    <section className="mt-6 rounded-[24px] border border-border bg-card p-5 shadow-sm shadow-black/5 dark:shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-sky-500" />
          <div>
            <h2 className="text-base font-semibold">友情链接</h2>
          </div>
        </div>
        <Link href="/link" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">
          全部链接
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        {links.map((link) => (
          <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="truncate rounded-lg px-2 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" title={link.name}>
            {link.name}
          </a>
        ))}
      </div>
    </section>
  )
}
