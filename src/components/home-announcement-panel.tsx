import Link from "next/link"
import { Megaphone, Pin } from "lucide-react"

import type { AnnouncementItem } from "@/lib/announcements"

interface HomeAnnouncementPanelProps {
  announcements: AnnouncementItem[]
}

export function HomeAnnouncementPanel({ announcements }: HomeAnnouncementPanelProps) {
  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-sky-500" />
          <div>
            <h3 className="font-semibold">站内公告</h3>
          </div>
        </div>
        <Link href="/announcements" className="text-xs text-muted-foreground transition hover:text-foreground">更多公告</Link>
      </div>

      {announcements.length > 0 ? (
        <div className="space-y-2">
          {announcements.map((announcement) => (
            <Link
              key={announcement.id}
              href="/announcements"
              className="block rounded-[18px] border border-border/70 bg-background px-3 py-3 transition hover:border-foreground/15 hover:bg-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {announcement.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-orange-500" /> : null}
                    <p className="truncate text-sm font-medium text-foreground">{announcement.title}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{announcement.publishedAtText}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-border px-3 py-4 text-xs leading-6 text-muted-foreground">
          当前还没有已发布公告，运营发布后会显示在这里。
        </div>
      )}
    </section>
  )
}
