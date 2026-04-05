"use client"

import { Eye, MessageSquare, Search, Sparkles, Star, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { AdminPostActionButton } from "@/components/admin-post-action-button"
import { AdminPostPreviewModal } from "@/components/admin-post-preview-modal"
import type { AdminPostListResult } from "@/lib/admin-post-management"
import { AdminPostMoveBoardButton } from "./admin-post-move-board-button"

interface AdminPostListProps {
  data: AdminPostListResult
}

const typeFilters = [
  { value: "ALL", label: "全部类型" },
  { value: "NORMAL", label: "普通帖" },
  { value: "BOUNTY", label: "悬赏帖" },
  { value: "POLL", label: "投票帖" },
  { value: "LOTTERY", label: "抽奖帖" },
]


const statusFilters = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待审核" },
  { value: "NORMAL", label: "正常" },
  { value: "OFFLINE", label: "已下线" },
]

const sortFilters = [
  { value: "newest", label: "最新发布" },
  { value: "oldest", label: "最早发布" },
  { value: "recentReply", label: "最近活跃" },
  { value: "mostComments", label: "评论最多" },
  { value: "mostLikes", label: "点赞最多" },
  { value: "mostViews", label: "浏览最多" },
  { value: "highestScore", label: "热度最高" },
]

const binaryFilters = {
  pin: [
    { value: "ALL", label: "全部置顶" },
    { value: "pinned", label: "仅置顶" },
    { value: "not-pinned", label: "未置顶" },
  ],
  featured: [
    { value: "ALL", label: "全部推荐" },
    { value: "featured", label: "仅推荐" },
    { value: "not-featured", label: "未推荐" },
  ],
  review: [
    { value: "ALL", label: "全部审核" },
    { value: "reviewed", label: "有备注" },
    { value: "unreviewed", label: "无备注" },
  ],
} as const

const pageSizeOptions = [20, 50, 100]

export function AdminPostList({ data }: AdminPostListProps) {
  const canUseGlobalPin = data.actorRole === "ADMIN"
  const groupedBoardOptions = useMemo(() => {
    const groups = new Map<string, Array<{ value: string; label: string }>>()

    for (const board of data.boardOptions) {
      const zoneName = board.zoneName ?? "未分区"
      const currentItems = groups.get(zoneName) ?? []
      currentItems.push({ value: board.slug, label: board.name })
      groups.set(zoneName, currentItems)
    }

    return Array.from(groups.entries()).map(([zone, items]) => ({ zone, items }))
  }, [data.boardOptions])

  const statCards = useMemo(

    () => [
      { label: "帖子总数", value: data.summary.total, icon: <MessageSquare className="h-4 w-4" /> },
      { label: "待审核", value: data.summary.pending, icon: <TrendingUp className="h-4 w-4" /> },
      { label: "已置顶", value: data.summary.pinned, icon: <Star className="h-4 w-4" /> },
      { label: "已推荐", value: data.summary.featured, icon: <Sparkles className="h-4 w-4" /> },
      { label: "公告帖", value: data.summary.announcement, icon: <Eye className="h-4 w-4" /> },
    ],
    [data.summary],
  )

  const baseQuery = new URLSearchParams({
    tab: "posts",
    type: data.filters.type,
    status: data.filters.status,
    board: data.filters.board,
    keyword: data.filters.keyword,
    sort: data.filters.sort,
    pin: data.filters.pin,
    featured: data.filters.featured,
    review: data.filters.review,
    postPageSize: String(data.pagination.pageSize),
  })

  function buildPageHref(page: number) {
    const query = new URLSearchParams(baseQuery)
    query.set("postPage", String(page))
    return `/admin?${query.toString()}`
  }

  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-[22px] border border-border bg-card p-4 xl:grid-cols-[minmax(120px,1.8fr)_110px_110px_140px_130px_130px_130px_92px_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索帖子</span>
          <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input name="keyword" defaultValue={data.filters.keyword} placeholder="标题 / 摘要 / 作者" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </label>
        <CompactSelect name="type" label="类型" value={data.filters.type} options={typeFilters} />
        <CompactSelect name="status" label="状态" value={data.filters.status} options={statusFilters} />
        <CompactSelect name="board" label="节点" value={data.filters.board} options={[{ value: "", label: "全部节点" }, ...data.boardOptions.map((item) => ({ value: item.slug, label: item.name }))]} />
        <CompactSelect name="sort" label="排序" value={data.filters.sort} options={sortFilters} />
        <CompactSelect name="pin" label="置顶" value={data.filters.pin} options={[...binaryFilters.pin]} />
        <CompactSelect name="featured" label="推荐" value={data.filters.featured} options={[...binaryFilters.featured]} />
        <CompactSelect name="review" label="审核" value={data.filters.review} options={[...binaryFilters.review]} />
        <CompactSelect name="postPageSize" label="每页" value={String(data.pagination.pageSize)} options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />
        <div className="flex items-end gap-2">
          <input type="hidden" name="tab" value="posts" />
          <input type="hidden" name="postPage" value="1" />
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            筛选
          </button>
          <Link href="/admin?tab=posts" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
            重置
          </Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-[18px] border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="text-xs">{card.label}</span>
              {card.icon}
            </div>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[minmax(0,1.4fr)_120px_100px_190px_240px]">
          <span>帖子</span>
          <span>节点/作者</span>
          <span>状态</span>
          <span>运营指标</span>
          <span className="text-right">操作</span>
        </div>
        {data.posts.length === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有帖子。</div> : null}
        {data.posts.map((post) => (
          <div key={post.id} className="grid items-center gap-3 border-b border-border px-4 py-2.5 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1.4fr)_120px_100px_190px_240px]">
            <div className="min-w-0">
              <div className={post.isFeatured ? "truncate font-semibold text-emerald-700 dark:text-emerald-300" : post.isPinned ? "truncate font-semibold text-orange-700 dark:text-orange-300" : "truncate font-medium"}>{post.title}</div>
              {post.summary ? <p className="mt-1 truncate text-muted-foreground">{post.summary}</p> : null}
              {post.reviewNote ? <p className="mt-1 truncate text-[11px] text-muted-foreground">审核备注：{post.reviewNote}</p> : null}
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                {post.pinScope === "GLOBAL" ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-500/15 dark:text-red-200">全局置顶</span> : null}
                {post.pinScope === "ZONE" ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">分区置顶</span> : null}
                {post.pinScope === "BOARD" ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">节点置顶</span> : null}
                {post.isFeatured ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">推荐</span> : null}
                {post.isAnnouncement ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">公告</span> : null}
              </div>
            </div>

            <div className="space-y-1 text-muted-foreground">
              <div className="truncate text-foreground">{post.boardName}</div>
              <div className="truncate">{post.authorName}</div>
              <div className="truncate">{post.zoneName ?? "未分区"}</div>
            </div>

            <div className="space-y-1 text-muted-foreground">
              <div>{post.typeLabel}</div>
              <div>{post.statusLabel}</div>
              <div>{post.createdAt.slice(0, 10)}</div>
            </div>

            <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-3 text-muted-foreground">
              <Metric label="评" value={post.commentCount} />
              <Metric label="赞" value={post.likeCount} />
              <Metric label="藏" value={post.favoriteCount} />
              <Metric label="览" value={post.viewCount} />
              <Metric label="赏" value={post.tipCount} />
              <Metric label="热" value={Math.round(post.score)} />
            </div>

            <div className="flex flex-wrap justify-end gap-1.5">
              <Link href={post.href ?? `/posts/${post.id}`} className="inline-flex h-7 items-center justify-center rounded-full border border-border px-2.5 text-xs transition-colors hover:bg-accent hover:text-foreground">

                前台
              </Link>
              <AdminPostPreviewModal post={post} />
              <AdminPostMoveBoardButton postId={post.id} postTitle={post.title} currentBoardSlug={post.boardSlug} boardOptions={groupedBoardOptions} className="h-7 rounded-full px-2.5 text-xs" />

              {post.status === "PENDING" ? (
                <>
                  <AdminPostActionButton action="post.approve" targetId={post.id} label="通过" modalTitle="确认通过审核" modalDescription={`帖子：${post.title}`} placeholder="填写审核备注（可选）" confirmText="确认通过" className="h-7 rounded-full px-2.5 text-xs" />
                  <AdminPostActionButton action="post.reject" targetId={post.id} label="驳回" tone="danger" modalTitle="确认驳回帖子" modalDescription={`帖子：${post.title}`} placeholder="填写驳回原因" confirmText="确认驳回" className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" />
                </>
              ) : (
                <>
                  <AdminPostActionButton action="post.feature" targetId={post.id} label={post.isFeatured ? "取消推" : "推荐"} className="h-7 rounded-full px-2.5 text-xs" />
                  {post.isPinned ? (
                    post.pinScope === "GLOBAL" && !canUseGlobalPin ? null : (
                    <AdminPostActionButton action="post.pin" targetId={post.id} label="取消顶" payload={{ scope: "NONE" }} className="h-7 rounded-full px-2.5 text-xs" />
                    )
                  ) : (
                    <>
                      <AdminPostActionButton action="post.pin" targetId={post.id} label="节点顶" payload={{ scope: "BOARD" }} className="h-7 rounded-full px-2.5 text-xs" />
                      <AdminPostActionButton action="post.pin" targetId={post.id} label="分区顶" payload={{ scope: "ZONE" }} className="h-7 rounded-full px-2.5 text-xs" />
                      {canUseGlobalPin ? <AdminPostActionButton action="post.pin" targetId={post.id} label="全局顶" payload={{ scope: "GLOBAL" }} className="h-7 rounded-full px-2.5 text-xs" /> : null}
                    </>
                  )}
                  <AdminPostActionButton action="post.hide" targetId={post.id} label="下线" tone="danger" modalTitle="确认下线帖子" modalDescription={`帖子：${post.title}`} placeholder="填写下线原因（可选）" confirmText="确认下线" className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" />
                </>
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 篇帖子</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"} aria-disabled={!data.pagination.hasPrevPage} className={data.pagination.hasPrevPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>
              上一页
            </Link>
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-foreground">{data.pagination.page}</span>
            <Link href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"} aria-disabled={!data.pagination.hasNextPage} className={data.pagination.hasNextPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>
              下一页
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompactSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-full border border-border bg-background px-2.5 text-sm outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-full bg-secondary/50 px-2 py-1 text-center">{label} {value}</div>
}
