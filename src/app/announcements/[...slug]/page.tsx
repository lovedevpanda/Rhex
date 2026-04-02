import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Pin } from "lucide-react"

import { MarkdownContent } from "@/components/markdown-content"
import { SiteHeader } from "@/components/site-header"
import { getPublishedSiteDocumentBySlug } from "@/lib/site-documents"
import { getSiteSettings } from "@/lib/site-settings"

interface AnnouncementDocumentPageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateMetadata({ params }: AnnouncementDocumentPageProps): Promise<Metadata> {
  const { slug } = await params
  const [settings, item] = await Promise.all([
    getSiteSettings(),
    getPublishedSiteDocumentBySlug("ANNOUNCEMENT", slug),
  ])

  return {
    title: item ? `${item.title} - 站点文档 - ${settings.siteName}` : `站点文档 - ${settings.siteName}`,
    description: item?.content.slice(0, 120) || "查看站点公告文档详情。",
  }
}

export default async function AnnouncementDocumentPage({ params }: AnnouncementDocumentPageProps) {
  const { slug } = await params
  const item = await getPublishedSiteDocumentBySlug("ANNOUNCEMENT", slug)

  if (!item || item.sourceType !== "DOCUMENT") {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-1 py-6">
        <article className="rounded-[28px] border border-border bg-card p-6">
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

          <h1 style={{ color: item.titleColor ?? undefined }} className={item.titleBold ? "mt-4 text-3xl font-semibold" : "mt-4 text-3xl font-medium"}>
            {item.title}
          </h1>

          <div className="mt-6 rounded-[22px] border border-border/70 bg-background px-5 py-4">
            <MarkdownContent content={item.content} emptyText="暂无公告正文" className="markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1" />
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            <Link href="/announcements" className="transition hover:text-foreground">返回站点文档列表</Link>
          </div>
        </article>
      </main>
    </div>
  )
}
