import Link from "next/link"
import { ExternalLink, Megaphone, Pin } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { MarkdownContent } from "@/components/markdown-content"
import type { AnnouncementItem } from "@/lib/announcements"

interface AnnouncementPageContentProps {
  items: AnnouncementItem[]
}

export function AnnouncementPageContent({ items }: AnnouncementPageContentProps) {
  return (
    <div className="space-y-6">
      <AddonSlotRenderer slot="announcements.hero.before" />
      <AddonSurfaceRenderer surface="announcements.hero" props={{ items }}>
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-xs shadow-black/5 dark:shadow-black/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-sky-500" />
              <h1 className="text-2xl font-semibold">站点文档</h1>
            </div>
            <Link href="/" className="inline-flex shrink-0 items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">
              返回首页
            </Link>
          </div>

        </section>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="announcements.hero.after" />

      <AddonSlotRenderer slot="announcements.content.before" />
      <AddonSurfaceRenderer surface="announcements.content" props={{ items }}>
        <section className="space-y-4">
          {items.map((item) => (
            <article key={item.id} id={item.id} className="rounded-[28px] border border-border bg-card p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">{item.sourceTypeLabel}</span>
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
              <h2 style={{ color: item.titleColor ?? undefined }} className={item.titleBold ? "mt-3 text-xl font-semibold" : "mt-3 text-xl font-medium"}>
                {item.title}
              </h2>

              {item.sourceType === "DOCUMENT" ? (
                <div className="mt-4 rounded-[22px] border border-border/70 bg-background px-5 py-4">
                  <MarkdownContent content={item.content} emptyText="暂无公告正文" className="markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1" />
                </div>
              ) : (
                <div className="mt-4 rounded-[22px] border border-border/70 bg-background px-5 py-4">
                  <p className="text-sm leading-7 text-muted-foreground">该公告配置为跳转链接，点击下方按钮前往目标地址。</p>
                  <div className="mt-4">
                    {item.isExternal ? (
                      <a href={item.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent">
                        前往链接
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <Link href={item.href} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent">
                        前往链接
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}

          {items.length === 0 ? (
            <section className="rounded-[28px] border border-border bg-card p-6 text-sm text-muted-foreground">
              当前还没有已发布公告文档。
            </section>
          ) : null}
        </section>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer slot="announcements.content.after" />
    </div>
  )
}
