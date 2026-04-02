import type { Metadata } from "next"

import { ExternalSearchOptions } from "@/components/external-search-options"
import { ForumPostStream } from "@/components/forum-post-stream"
import { SearchForm } from "@/components/search-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { readSearchParam } from "@/lib/search-params"
import { searchPosts } from "@/lib/search"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `搜索 - ${settings.siteName}`,
    description: settings.search.enabled
      ? `搜索 ${settings.siteName} 中的帖子、节点与作者内容。`
      : `${settings.siteName} 当前关闭了站内搜索，可改用外部搜索引擎继续查找内容。`,
  }
}

export default async function SearchPage(props: PageProps<"/search">) {
  const settings = await getSiteSettings()
  const searchParams = await props.searchParams;
  const keyword = readSearchParam(searchParams?.q)?.trim() ?? ""
  const currentPage = Math.max(1, Number(readSearchParam(searchParams?.page) ?? "1") || 1)
  const results = settings.search.enabled ? await searchPosts(keyword, currentPage, 10) : null
  const hasPrevPage = currentPage > 1
  const hasNextPage = results ? currentPage * 10 < results.total : false

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-6 lg:px-6">
        <div className="space-y-6">
          <Card className="overflow-hidden border-none bg-gradient-to-r from-[#1f1b16] via-[#2e261f] to-[#382c22] text-white shadow-soft">
            <CardContent className="space-y-5 p-8">
              <div>
                <p className="text-sm text-white/70">论坛搜索</p>
                <h1 className="mt-2 text-3xl font-semibold">{settings.search.enabled ? "搜索帖子、节点与作者内容" : "站内搜索已关闭"}</h1>
              </div>
              <SearchForm defaultValue={keyword} search={settings.search} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              {!keyword ? settings.search.enabled ? (
                <p className="text-sm text-muted-foreground">你可以搜索帖子标题、正文摘要、作者昵称和节点名称。</p>
              ) : (
                <p className="text-sm text-muted-foreground">站内搜索当前已关闭。输入关键词后，使用 Google 或 Bing 继续查找内容。</p>
              ) : !settings.search.enabled ? (
                <>
                  <p className="text-sm text-muted-foreground">站内搜索当前已关闭，请选择外部搜索引擎继续搜索 “{keyword}”。</p>
                  <ExternalSearchOptions keyword={keyword} engines={settings.search.externalEngines} variant="panel" />
                </>
              ) : results!.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">没有找到相关内容，试试更短的关键词或其他表达方式。</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">共找到 {results!.total} 条结果</p>
                  <ForumPostStream posts={results!.items} />
                  <div className="flex items-center justify-between pt-2">
                    <a href={`/search?q=${encodeURIComponent(results!.keyword)}&page=${Math.max(1, currentPage - 1)}`} className={hasPrevPage ? "" : "pointer-events-none opacity-50"}>
                      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">上一页</span>
                    </a>
                    <span className="text-sm text-muted-foreground">第 {currentPage} 页</span>
                    <a href={`/search?q=${encodeURIComponent(results!.keyword)}&page=${currentPage + 1}`} className={hasNextPage ? "" : "pointer-events-none opacity-50"}>
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
