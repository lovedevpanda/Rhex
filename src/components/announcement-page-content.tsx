import Link from "next/link"
import { Megaphone, Pin } from "lucide-react"

import { MarkdownContent } from "@/components/markdown-content"
import type { AnnouncementItem } from "@/lib/announcements"

interface AnnouncementPageContentProps {
  items: AnnouncementItem[]
}

export function AnnouncementPageContent({ items }: AnnouncementPageContentProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-sky-500" />
          <h1 className="text-2xl font-semibold">站内公告</h1>
        </div>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          查看社区最新公告、维护通知与运营消息。
        </p>
      </section>

      <section className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-[28px] border border-border bg-card p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {item.isPinned ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                  <Pin className="h-3 w-3" />
                  置顶公告
                </span>
              ) : null}
              <span>{item.publishedAtText}</span>
              <span>·</span>
              <span>{item.creatorName}</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold">{item.title}</h2>
            <div className="mt-4 rounded-[22px] border border-border/70 bg-background px-5 py-4">
              <MarkdownContent content={item.content} emptyText="暂无公告内容" className="markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1" />
            </div>
          </article>
        ))}

        {items.length === 0 ? (
          <section className="rounded-[28px] border border-border bg-card p-6 text-sm text-muted-foreground">
            当前还没有已发布公告。
          </section>
        ) : null}
      </section>

      <div className="text-sm text-muted-foreground">
        <Link href="/" className="transition hover:text-foreground">返回首页</Link>
      </div>
    </div>
  )
}
