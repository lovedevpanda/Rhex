import type { Metadata } from "next"

import { ForumPostStream } from "@/components/forum-post-stream"
import { SearchForm } from "@/components/search-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { searchPosts } from "@/lib/search"
import { getSiteSettings } from "@/lib/site-settings"

interface SearchPageProps {
  searchParams?: {
    q?: string
    page?: string
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `搜索 - ${settings.siteName}`,
    description: `搜索 ${settings.siteName} 中的帖子、节点与作者内容。`,
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const keyword = searchParams?.q?.trim() ?? ""
  const currentPage = Math.max(1, Number(searchParams?.page ?? "1") || 1)
  const results = await searchPosts(keyword, currentPage, 10)
  const hasPrevPage = currentPage > 1
  const hasNextPage = currentPage * 10 < results.total

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-6 lg:px-6">
        <div className="space-y-6">
          <Card className="overflow-hidden border-none bg-gradient-to-r from-[#1f1b16] via-[#2e261f] to-[#382c22] text-white shadow-soft">
            <CardContent className="space-y-5 p-8">
              <div>
                <p className="text-sm text-white/70">论坛搜索</p>
                <h1 className="mt-2 text-3xl font-semibold">搜索帖子、节点与作者内容</h1>
              </div>
              <SearchForm defaultValue={keyword} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              {!keyword ? (
                <p className="text-sm text-muted-foreground">你可以搜索帖子标题、正文摘要、作者昵称和节点名称。</p>
              ) : results.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">没有找到相关内容，试试更短的关键词或其他表达方式。</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">共找到 {results.total} 条结果</p>
                  <ForumPostStream posts={results.items} />
                  <div className="flex items-center justify-between pt-2">
                    <a href={`/search?q=${encodeURIComponent(results.keyword)}&page=${Math.max(1, currentPage - 1)}`} className={hasPrevPage ? "" : "pointer-events-none opacity-50"}>
                      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">上一页</span>
                    </a>
                    <span className="text-sm text-muted-foreground">第 {currentPage} 页</span>
                    <a href={`/search?q=${encodeURIComponent(results.keyword)}&page=${currentPage + 1}`} className={hasNextPage ? "" : "pointer-events-none opacity-50"}>
                      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">下一页</span>
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
