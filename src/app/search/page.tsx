import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight, Hash } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ExternalSearchOptions } from "@/components/external-search-options"
import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { LevelIcon } from "@/components/level-icon"
import { SearchForm } from "@/components/search-form"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/user/user-avatar"
import { getCurrentUser } from "@/lib/auth"
import { formatCompactNumber, formatNumber, formatRelativeTime } from "@/lib/formatters"
import { readSearchParam } from "@/lib/search-params"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"
import { resolveExternalSearchSiteHost } from "@/lib/site-search-settings"
import {
  DEFAULT_SEARCH_SCOPE,
  SEARCH_SCOPE_LABELS,
  SEARCH_SCOPES,
  normalizeSearchScope,
  searchByScope,
  type SearchBoardItem,
  type SearchFavoriteCollectionItem,
  type SearchPagedResults,
  type SearchScope,
  type SearchScopedResults,
  type SearchTagItem,
  type SearchUserItem,
} from "@/lib/search"
import { getSiteSettings } from "@/lib/site-settings"
import { getPublicUserRoleBadgeLabel } from "@/lib/user-presentation"
import { cn } from "@/lib/utils"

const POST_SEARCH_PAGE_SIZE = 10
const ENTITY_SEARCH_PAGE_SIZE = 12

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `搜索 - ${settings.siteName}`,
    description: settings.search.enabled
      ? `按帖子、节点、标签、用户和收藏搜索 ${settings.siteName} 的内容。`
      : `${settings.siteName} 当前关闭了站内搜索，可改用外部搜索引擎继续查找内容。`,
  }
}

export default async function SearchPage(props: PageProps<"/search">) {
  const settings = await getSiteSettings()
  const requestHeaders = await headers()
  const searchParams = await props.searchParams
  const keyword = readSearchParam(searchParams?.q)?.trim() ?? ""
  const activeScope = normalizeSearchScope(readSearchParam(searchParams?.type))
  const after = activeScope === "posts" ? readSearchParam(searchParams?.after) ?? null : null
  const before = activeScope === "posts" ? readSearchParam(searchParams?.before) ?? null : null
  const currentPage = normalizeSearchPage(readSearchParam(searchParams?.page))
  const currentUser = settings.search.enabled && activeScope === "collections" ? await getCurrentUser() : null
  const siteHost = resolveExternalSearchSiteHost({
    configuredOrigin: getConfiguredSiteOrigin(),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    host: requestHeaders.get("host"),
  })
  const scopedResults = settings.search.enabled
    ? await searchByScope(activeScope, keyword, {
        page: currentPage,
        pageSize: activeScope === "posts" ? POST_SEARCH_PAGE_SIZE : ENTITY_SEARCH_PAGE_SIZE,
        after,
        before,
        includeTotal: !after && !before,
        currentUserId: currentUser?.id ?? null,
        searchEnabled: settings.search.enabled,
        postLinkDisplayMode: settings.postLinkDisplayMode,
      })
    : null
  const hasKeyword = keyword.length > 0
  const activeLabel = SEARCH_SCOPE_LABELS[activeScope]
  const activeData = scopedResults?.data ?? null
  const resultItems = scopedResults?.scope === "posts" ? scopedResults.data.items : []
  const resultCount = getResultCount(scopedResults)
  const resultSummary = getResultSummary(scopedResults)

  function buildScopeHref(scope: SearchScope) {
    const query = new URLSearchParams()

    if (keyword) {
      query.set("q", keyword)
    }

    if (scope !== DEFAULT_SEARCH_SCOPE) {
      query.set("type", scope)
    }

    const queryString = query.toString()
    return queryString ? `/search?${queryString}` : "/search"
  }

  function buildPostSearchHref(params: { before?: string | null; after?: string | null }) {
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

  function buildPagedSearchHref(page: number) {
    const query = new URLSearchParams()
    query.set("q", keyword)

    if (activeScope !== DEFAULT_SEARCH_SCOPE) {
      query.set("type", activeScope)
    }

    if (page > 1) {
      query.set("page", String(page))
    }

    return `/search?${query.toString()}`
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-1 py-8">
        <div className="flex flex-col gap-5">
          <AddonSlotRenderer slot="search.page.before" />
          <AddonSurfaceRenderer surface="search.page" pathname="/search" props={{ activeScope, hasKeyword, keyword, results: activeData, scopedResults, settings }}>
            <>
              <AddonSlotRenderer slot="search.hero.before" />
              <AddonSurfaceRenderer
                surface="search.hero"
                pathname="/search"
                props={{
                  activeScope,
                  search: settings.search,
                  keyword,
                  hasKeyword,
                }}
              >
                <section className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex flex-col gap-4 p-5 sm:p-6">
                    {/*
                      key 绑定关键词：SearchForm 内部用 useState(defaultValue) 管输入框，
                      而 Next 的软导航会复用同一个组件实例 —— 不换 key 的话，
                      从顶部导航栏搜新词时 URL 和结果都变了，页面里这个输入框
                      还会显示旧关键词（再按回车就用旧词重搜）。
                    */}
                    <SearchForm key={keyword} defaultValue={keyword} search={settings.search} />
                  </div>
                  <SearchScopeTabs activeScope={activeScope} buildHref={buildScopeHref} disabled={!settings.search.enabled} />
                </section>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="search.hero.after" />

              <AddonSlotRenderer slot="search.results.before" />
              <AddonSurfaceRenderer surface="search.results" pathname="/search" props={{ activeScope, hasKeyword, keyword, resultItems, results: activeData, scopedResults, settings }}>
                <section className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="border-b border-border px-5 py-4 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h1 className="text-base font-medium">
                          {!hasKeyword
                            ? "开始搜索"
                            : !settings.search.enabled
                              ? "外部搜索"
                              : resultCount === 0
                                ? `没有找到相关${activeLabel}`
                                : `${activeLabel}搜索结果`}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {!hasKeyword
                            ? (settings.search.enabled ? "输入关键词后，选择上方分类查看对应结果。" : "输入关键词后，可继续使用外部搜索查找本站内容。")
                            : !settings.search.enabled
                              ? `站内搜索已关闭，请选择外部搜索继续搜索 “${keyword}”。`
                              : resultCount === 0
                                ? `没有找到与 “${keyword}” 相关的${activeLabel}。`
                                : `按 “${keyword}” 返回的${activeLabel}列表。`}
                        </p>
                      </div>
                      {hasKeyword && settings.search.enabled && resultSummary ? (
                        <p className="text-sm text-muted-foreground">{resultSummary}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-5 p-4">
                    {!hasKeyword ? (
                      <SearchEmptyPanel>
                        支持按帖子、节点、标签、用户、收藏分别搜索。切换分类不会混合不同类型的结果。
                      </SearchEmptyPanel>
                    ) : !settings.search.enabled ? (
                      <ExternalSearchOptions keyword={keyword} engines={settings.search.externalEngines} siteHost={siteHost ?? undefined} variant="panel" />
                    ) : !scopedResults || resultCount === 0 ? (
                      <>
                        <SearchEmptyPanel>
                          试试缩短关键词、替换近义词，或者直接使用外部搜索扩大范围。
                        </SearchEmptyPanel>
                        <ExternalSearchOptions keyword={keyword} engines={settings.search.externalEngines} siteHost={siteHost ?? undefined} variant="panel" />
                      </>
                    ) : (
                      <SearchResultsContent
                        results={scopedResults}
                        buildPostSearchHref={buildPostSearchHref}
                        buildPagedSearchHref={buildPagedSearchHref}
                      />
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

function normalizeSearchPage(value: string | null | undefined) {
  const page = Number(value ?? "1")
  return Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1
}

function getResultCount(results: SearchScopedResults | null) {
  return results?.data.items.length ?? 0
}

function getResultSummary(results: SearchScopedResults | null) {
  if (!results) {
    return null
  }

  if (results.scope === "posts") {
    return results.data.total === null
      ? `当前页返回 ${formatNumber(results.data.items.length)} 条`
      : `共找到 ${formatCompactNumber(results.data.total)} 条`
  }

  return `共找到 ${formatCompactNumber(results.data.total)} 条，第 ${results.data.page} / ${results.data.totalPages} 页`
}

function SearchScopeTabs({
  activeScope,
  buildHref,
  disabled,
}: {
  activeScope: SearchScope
  buildHref: (scope: SearchScope) => string
  disabled: boolean
}) {
  return (
    <nav className="overflow-x-auto border-t border-border" aria-label="搜索类型">
      <div className="flex min-w-max items-center gap-1 px-3">
        {SEARCH_SCOPES.map((scope) => {
          const active = scope === activeScope
          const className = cn(
            "relative inline-flex h-12 min-w-16 items-center justify-center px-3 text-sm font-medium transition-colors",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            active ? "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground" : "",
            disabled ? "pointer-events-none opacity-60" : "",
          )

          return (
            <Link key={scope} href={buildHref(scope)} className={className} aria-current={active ? "page" : undefined}>
              {SEARCH_SCOPE_LABELS[scope]}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function SearchResultsContent({
  results,
  buildPostSearchHref,
  buildPagedSearchHref,
}: {
  results: SearchScopedResults
  buildPostSearchHref: (params: { before?: string | null; after?: string | null }) => string
  buildPagedSearchHref: (page: number) => string
}) {
  switch (results.scope) {
    case "boards":
      return (
        <>
          <BoardSearchResults items={results.data.items} />
          <PagedPagination data={results.data} buildHref={buildPagedSearchHref} />
        </>
      )
    case "tags":
      return (
        <>
          <TagSearchResults items={results.data.items} />
          <PagedPagination data={results.data} buildHref={buildPagedSearchHref} />
        </>
      )
    case "users":
      return (
        <>
          <UserSearchResults items={results.data.items} />
          <PagedPagination data={results.data} buildHref={buildPagedSearchHref} />
        </>
      )
    case "collections":
      return (
        <>
          <FavoriteCollectionSearchResults items={results.data.items} />
          <PagedPagination data={results.data} buildHref={buildPagedSearchHref} />
        </>
      )
    case "posts":
    default:
      return (
        <>
          <ForumPostStream posts={results.data.items} compactFirstItem={false} />
          <div className="flex items-center justify-between gap-2 border-t border-border p-4">
            <PaginationLink
              href={results.data.hasPrevPage && results.data.prevCursor ? buildPostSearchHref({ before: results.data.prevCursor }) : null}
              label="上一页"
              direction="prev"
            />
            <PaginationLink
              href={results.data.hasNextPage && results.data.nextCursor ? buildPostSearchHref({ after: results.data.nextCursor }) : null}
              label="下一页"
              direction="next"
            />
          </div>
        </>
      )
  }
}

function BoardSearchResults({ items }: { items: SearchBoardItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((board) => (
        <Link key={board.id} href={`/boards/${board.slug}`} className="group flex min-h-32 gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-accent/60">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-lg">
            <LevelIcon icon={board.icon} className="size-6 text-[22px]" svgClassName="[&>svg]:block" emojiClassName="text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent-foreground">{board.name}</p>
              {board.zoneName ? <Badge variant="outline">{board.zoneName}</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{board.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span title={`${formatNumber(board.postCount)} 篇帖子`}>{formatCompactNumber(board.postCount)} 篇帖子</span>
              <span title={`${formatNumber(board.followerCount)} 人关注`}>{formatCompactNumber(board.followerCount)} 人关注</span>
              <span>/{board.slug}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function TagSearchResults({ items }: { items: SearchTagItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((tag) => (
        <Link key={tag.id} href={`/tags/${tag.slug}`} className="group flex min-h-28 flex-col justify-between rounded-xl border border-border bg-background p-4 transition-colors hover:bg-accent/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent-foreground">#{tag.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">/{tag.slug}</p>
            </div>
            <Hash className="size-4 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span title={`${formatNumber(tag.postCount)} 篇帖子`}>{formatCompactNumber(tag.postCount)} 篇帖子</span>
            <span>{formatRelativeTime(tag.createdAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function UserSearchResults({ items }: { items: SearchUserItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((user) => {
        const roleBadgeLabel = getPublicUserRoleBadgeLabel(user)
        const levelLabel = user.levelName ? `Lv.${user.level} ${user.levelName}` : `Lv.${user.level}`

        return (
          <Link key={user.id} href={`/users/${user.username}`} className="group flex min-h-36 gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-accent/60">
            <UserAvatar name={user.displayName} avatarPath={user.avatarPath} size="md" isVip={user.vipLevel > 0} vipLevel={user.vipLevel} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent-foreground">{user.displayName}</p>
                {roleBadgeLabel ? <Badge variant="secondary">{roleBadgeLabel}</Badge> : null}
                {user.status === "MUTED" ? <Badge variant="outline">禁言中</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{user.bio}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span title={`${formatNumber(user.postCount)} 帖子`}>{formatCompactNumber(user.postCount)} 帖子</span>
                <span title={`${formatNumber(user.followerCount)} 粉丝`}>{formatCompactNumber(user.followerCount)} 粉丝</span>
                <span>{levelLabel}</span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function FavoriteCollectionSearchResults({ items }: { items: SearchFavoriteCollectionItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((collection) => (
        <Link key={collection.id} href={`/collections/${collection.id}`} className="group flex min-h-36 flex-col justify-between rounded-xl border border-border bg-background p-4 transition-colors hover:bg-accent/60">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent-foreground">{collection.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">由 {collection.owner.displayName} 创建</p>
              </div>
              <Badge variant={collection.visibility === "PUBLIC" ? "secondary" : "outline"}>
                {collection.visibility === "PUBLIC" ? "公开" : "私有"}
              </Badge>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{collection.description}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span title={`${formatNumber(collection.postCount)} 篇内容`}>{formatCompactNumber(collection.postCount)} 篇内容</span>
            {collection.allowOtherUsersToContribute ? <span>允许投稿</span> : null}
            <span>更新于 {formatRelativeTime(collection.updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function PagedPagination<TItem>({
  data,
  buildHref,
}: {
  data: SearchPagedResults<TItem>
  buildHref: (page: number) => string
}) {
  if (data.totalPages <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border p-4">
      <PaginationLink
        href={data.hasPrevPage ? buildHref(data.page - 1) : null}
        label="上一页"
        direction="prev"
      />
      <span className="text-sm text-muted-foreground">
        {data.page} / {data.totalPages}
      </span>
      <PaginationLink
        href={data.hasNextPage ? buildHref(data.page + 1) : null}
        label="下一页"
        direction="next"
      />
    </div>
  )
}

function PaginationLink({
  href,
  label,
  direction,
}: {
  href: string | null
  label: string
  direction: "prev" | "next"
}) {
  const className = "inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors sm:flex-none sm:min-w-24"
  const icon = direction === "prev" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />
  const content = direction === "prev"
    ? <>{icon}<span>{label}</span></>
    : <><span>{label}</span>{icon}</>

  if (!href) {
    return <span className={`${className} pointer-events-none opacity-50`}>{content}</span>
  }

  return (
    <Link href={href} className={`${className} hover:bg-muted`}>
      {content}
    </Link>
  )
}

function SearchEmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  )
}
