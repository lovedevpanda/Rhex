import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ExternalSearchOptions } from "@/components/external-search-options"
import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { SearchForm } from "@/components/search-form"
import { SiteHeader } from "@/components/site-header"
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
  const requestHeaders = await headers()
  const searchParams = await props.searchParams;
  const keyword = readSearchParam(searchParams?.q)?.trim() ?? ""
  const after = readSearchParam(searchParams?.after) ?? null
  const before = readSearchParam(searchParams?.before) ?? null
  const siteHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() || requestHeaders.get("host")?.trim() || null
  const results = settings.search.enabled
    ? await searchPosts(keyword, {
        pageSize: 10,
        after,
        before,
        includeTotal: !after && !before,
        searchEnabled: settings.search.enabled,
        postLinkDisplayMode: settings.postLinkDisplayMode,
      })
    : null
  const hasKeyword = keyword.length > 0
  const resultItems = results?.items ?? []
  const resultSummary = results
    ? (results.total === null ? `当前页返回 ${resultItems.length} 条结果` : `共找到 ${results.total} 条结果`)
    : null

  function buildSearchHref(params: { before?: string | null; after?: string | null }) {
    const query = new URLSearchParams()
    query.set("q", keyword)

    if (params.before) {
      query.set("before", params.before)
    }

    if (params.after) {
      query.set("after", params.after)
    }

    return `/search?${query.toString()}`
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[920px] px-4 py-8 lg:px-6">
        <div className="space-y-5">
          <AddonSlotRenderer slot="search.page.before" />
          <AddonSurfaceRenderer surface="search.page" pathname="/search" props={{ hasKeyword, keyword, results, settings }}>
            <>
              <AddonSlotRenderer slot="search.hero.before" />
              <AddonSurfaceRenderer
                surface="search.hero"
                pathname="/search"
                props={{
                  search: settings.search,
                  keyword,
                  hasKeyword,
                }}
              >
                <section className="rounded-2xl border border-border bg-card">
                  <div className="space-y-5 p-5 sm:p-6">
                    <div>
                      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">站内搜索</p>
                      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{settings.search.enabled ? "搜索帖子、节点与作者内容" : "站内搜索已关闭"}</h1>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {settings.search.enabled
                          ? null
                          : "当前站内搜索不可用，但你仍然可以输入关键词后继续使用外部搜索引擎查找本站内容。"}
                      </p>
                    </div>
                    <SearchForm defaultValue={keyword} search={settings.search} />
                    {hasKeyword ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">当前关键词</span>
                        <span className="rounded-full border border-border bg-background px-3 py-1 font-medium text-foreground">{keyword}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">输入关键词后即可开始搜索。</p>
                    )}
                  </div>
                </section>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="search.hero.after" />

              <AddonSlotRenderer slot="search.results.before" />
              <AddonSurfaceRenderer surface="search.results" pathname="/search" props={{ hasKeyword, keyword, resultItems, results, settings }}>
                <section className="rounded-2xl border border-border bg-card">
                  <div className="border-b border-border px-5 py-4 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base font-medium">
                          {!hasKeyword
                            ? "开始搜索"
                            : !settings.search.enabled
                              ? "外部搜索"
                              : resultItems.length === 0
                                ? "没有找到相关内容"
                                : "搜索结果"}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {!hasKeyword
                            ? (settings.search.enabled ? "搜索结果会显示在这里。" : "输入关键词后，可继续使用外部搜索查找本站内容。")
                            : !settings.search.enabled
                              ? `站内搜索已关闭，请选择外部搜索继续搜索 “${keyword}”。`
                              : resultItems.length === 0
                                ? `没有找到与 “${keyword}” 相关的内容。`
                                : "按当前关键词返回的内容列表。"}
                        </p>
                      </div>
                      {hasKeyword && settings.search.enabled && resultSummary ? (
                        <p className="text-sm text-muted-foreground">{resultSummary}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-5 pt-5">
                    {!hasKeyword ? (
                      <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm leading-6 text-muted-foreground">
                        {settings.search.enabled
                          ? "支持搜索帖子标题、正文摘要、作者昵称和节点名称。输入更短、更明确的关键词通常更容易找到结果。"
                          : "站内搜索当前已关闭。输入关键词后，可直接使用下方的外部搜索选项继续查找。"}
                      </div>
                    ) : !settings.search.enabled ? (
                      <ExternalSearchOptions keyword={keyword} engines={settings.search.externalEngines} siteHost={siteHost} variant="panel" />
                    ) : resultItems.length === 0 ? (
                      <>
                        <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm leading-6 text-muted-foreground">
                          试试缩短关键词、替换近义词，或者直接使用外部搜索扩大范围。
                        </div>
                        <ExternalSearchOptions keyword={keyword} engines={settings.search.externalEngines} siteHost={siteHost} variant="panel" />
                      </>
                    ) : (
                      <>
                        <ForumPostStream posts={resultItems} compactFirstItem={false} />
                        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <PaginationLink
                            href={results!.hasPrevPage && results!.prevCursor ? buildSearchHref({ before: results!.prevCursor }) : null}
                            label="上一页"
                          />
                          <p className="text-sm text-muted-foreground">使用上一页和下一页继续浏览当前关键词的结果。</p>
                          <PaginationLink
                            href={results!.hasNextPage && results!.nextCursor ? buildSearchHref({ after: results!.nextCursor }) : null}
                            label="下一页"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="search.results.after" />
            </>
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="search.page.after" />
        </div>
      </main>
    </div>
  )
}

function PaginationLink({ href, label }: { href: string | null; label: string }) {
  const className = "inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors"

  if (!href) {
    return <span className={`${className} pointer-events-none opacity-50`}>{label}</span>
  }

  return (
    <Link href={href} className={`${className} hover:bg-muted`}>
      {label}
    </Link>
  )
}
