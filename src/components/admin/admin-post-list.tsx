"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Filter,
  Megaphone,
  Pin,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { useMemo, useState } from "react"

import { AdminPostActionButton } from "@/components/admin/admin-post-action-button"
import {
  AdminFilterActions,
  AdminFilterCard,
  AdminFilterGroupedSelectField,
  AdminFilterSearchField,
  AdminFilterSelectField,
} from "@/components/admin/admin-filter-card"
import { AdminPostPreviewModal } from "@/components/admin/admin-post-preview-modal"
import { AdminPostMoveBoardButton } from "@/components/admin/admin-post-move-board-button"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip } from "@/components/ui/tooltip"
import type { AdminPostListItem, AdminPostListResult } from "@/lib/admin-post-management"
import { formatMonthDayTime, formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface AdminPostListProps {
  data: AdminPostListResult
}

const typeFilters = [
  { value: "ALL", label: "全部类型" },
  { value: "NORMAL", label: "普通帖" },
  { value: "BOUNTY", label: "悬赏帖" },
  { value: "POLL", label: "投票帖" },
  { value: "LOTTERY", label: "抽奖帖" },
  { value: "AUCTION", label: "拍卖帖" },
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
  const [filters, setFilters] = useState({
    type: data.filters.type,
    status: data.filters.status,
    board: data.filters.board,
    keyword: data.filters.keyword,
    sort: data.filters.sort,
    pin: data.filters.pin,
    featured: data.filters.featured,
    review: data.filters.review,
    pageSize: String(data.pagination.pageSize),
  })

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
      {
        label: "帖子总数",
        value: data.summary.total,
        icon: <FileText className="h-4 w-4" />,
        hint: `当前结果 ${formatNumber(data.pagination.total)} 篇`,
      },
      {
        label: "待审核",
        value: data.summary.pending,
        icon: <TrendingUp className="h-4 w-4" />,
        hint: "优先处理待发布内容",
        tone: "amber" as const,
      },
      {
        label: "已置顶",
        value: data.summary.pinned,
        icon: <Pin className="h-4 w-4" />,
        hint: "含节点 / 分区 / 全局置顶",
        tone: "orange" as const,
      },
      {
        label: "已推荐",
        value: data.summary.featured,
        icon: <Sparkles className="h-4 w-4" />,
        hint: "首页或运营位可见",
        tone: "emerald" as const,
      },
      {
        label: "公告帖",
        value: data.summary.announcement,
        icon: <Megaphone className="h-4 w-4" />,
        hint: "用于公告和通知类内容",
        tone: "sky" as const,
      },
    ],
    [data.pagination.total, data.summary],
  )

  const activeFilterBadges = useMemo(() => {
    const badges: string[] = []

    if (filters.keyword.trim()) {
      badges.push(`关键词: ${filters.keyword.trim()}`)
    }
    if (filters.type !== "ALL") {
      badges.push(`类型: ${typeFilters.find((item) => item.value === filters.type)?.label ?? filters.type}`)
    }
    if (filters.status !== "ALL") {
      badges.push(`状态: ${statusFilters.find((item) => item.value === filters.status)?.label ?? filters.status}`)
    }
    if (filters.board) {
      badges.push(`节点: ${data.boardOptions.find((item) => item.slug === filters.board)?.name ?? filters.board}`)
    }
    if (filters.sort !== "newest") {
      badges.push(`排序: ${sortFilters.find((item) => item.value === filters.sort)?.label ?? filters.sort}`)
    }
    if (filters.pin !== "ALL") {
      badges.push(`置顶: ${binaryFilters.pin.find((item) => item.value === filters.pin)?.label ?? filters.pin}`)
    }
    if (filters.featured !== "ALL") {
      badges.push(`推荐: ${binaryFilters.featured.find((item) => item.value === filters.featured)?.label ?? filters.featured}`)
    }
    if (filters.review !== "ALL") {
      badges.push(`审核: ${binaryFilters.review.find((item) => item.value === filters.review)?.label ?? filters.review}`)
    }
    if (filters.pageSize !== "20") {
      badges.push(`每页: ${filters.pageSize} 条`)
    }

    return badges
  }, [data.boardOptions, filters])

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
      <AdminFilterCard
        title="帖子筛选"
        description="按节点、状态、推荐置顶和关键词快速收敛待处理内容。"
        badge={<Badge variant="secondary" className="rounded-full">已命中 {formatNumber(data.pagination.total)} 篇</Badge>}
        activeBadges={activeFilterBadges}
      >
        <form action="/admin" className="grid gap-2 xl:grid-cols-[minmax(168px,1.5fr)_repeat(8,minmax(78px,1fr))_auto] xl:items-end">
          <input type="hidden" name="tab" value="posts" />
          <input type="hidden" name="postPage" value="1" />
          <input type="hidden" name="type" value={filters.type} />
          <input type="hidden" name="status" value={filters.status} />
          <input type="hidden" name="board" value={filters.board} />
          <input type="hidden" name="sort" value={filters.sort} />
          <input type="hidden" name="pin" value={filters.pin} />
          <input type="hidden" name="featured" value={filters.featured} />
          <input type="hidden" name="review" value={filters.review} />
          <input type="hidden" name="postPageSize" value={filters.pageSize} />

          <AdminFilterSearchField
            label="搜索帖子"
            name="keyword"
            value={filters.keyword}
            onChange={(value) => setFilters((current) => ({ ...current, keyword: value }))}
            placeholder="标题 / 摘要 / 作者"
          />

          <AdminFilterSelectField
            label="类型"
            value={filters.type}
            onValueChange={(value) => setFilters((current) => ({ ...current, type: value }))}
            options={typeFilters}
          />
          <AdminFilterSelectField
            label="状态"
            value={filters.status}
            onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={statusFilters}
          />
          <AdminFilterGroupedSelectField
            label="节点"
            value={filters.board}
            groups={groupedBoardOptions.map((group) => ({ label: group.zone, items: group.items }))}
            onValueChange={(value) => setFilters((current) => ({ ...current, board: value }))}
            allLabel="全部节点"
          />
          <AdminFilterSelectField
            label="排序"
            value={filters.sort}
            onValueChange={(value) => setFilters((current) => ({ ...current, sort: value }))}
            options={sortFilters}
          />
          <AdminFilterSelectField
            label="置顶"
            value={filters.pin}
            onValueChange={(value) => setFilters((current) => ({ ...current, pin: value }))}
            options={[...binaryFilters.pin]}
          />
          <AdminFilterSelectField
            label="推荐"
            value={filters.featured}
            onValueChange={(value) => setFilters((current) => ({ ...current, featured: value }))}
            options={[...binaryFilters.featured]}
          />
          <AdminFilterSelectField
            label="审核"
            value={filters.review}
            onValueChange={(value) => setFilters((current) => ({ ...current, review: value }))}
            options={[...binaryFilters.review]}
          />
          <AdminFilterSelectField
            label="每页"
            value={filters.pageSize}
            onValueChange={(value) => setFilters((current) => ({ ...current, pageSize: value }))}
            options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))}
          />

          <AdminFilterActions
            submitLabel="筛选帖子"
            resetHref="/admin?tab=posts"
            submitIcon={<Filter className="h-3.5 w-3.5" />}
          />
        </form>
      </AdminFilterCard>

      <AdminSummaryStrip items={statCards} />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>帖子列表</CardTitle>
          <CardDescription>支持快速预览、移动节点、审核、推荐和上下线操作。</CardDescription>
          <CardAction>
            <OverviewActionLink href="/admin?tab=posts&status=PENDING" label="查看待审核" />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {data.posts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <p className="text-sm font-medium">当前筛选条件下没有帖子</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                试试放宽节点、状态或关键词，或者重置筛选后重新查看。
              </p>
              <OverviewActionLink href="/admin?tab=posts" label="重置筛选" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>帖子</TableHead>
                  <TableHead className="w-[140px]">节点</TableHead>
                  <TableHead className="w-[130px]">作者</TableHead>
                  <TableHead className="w-[120px]">状态</TableHead>
                  <TableHead className="w-[180px]">标签 / 审核</TableHead>
                  <TableHead className="w-[110px]">评论 / 点赞</TableHead>
                  <TableHead className="w-[110px]">收藏 / 浏览</TableHead>
                  <TableHead className="w-[110px]">打赏 / 热度</TableHead>
                  <TableHead className="w-[140px]">时间</TableHead>
                  <TableHead className="w-[280px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="align-top">
                      <PostTitleCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostBoardCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostAuthorCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostStatusCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostFlagsCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostEngagementCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostTrafficCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostOpsCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostTimeCell post={post} />
                    </TableCell>
                    <TableCell className="align-top">
                      <PostActionsCell
                        post={post}
                        canUseGlobalPin={canUseGlobalPin}
                        groupedBoardOptions={groupedBoardOptions}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center gap-4 py-6">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 篇内容</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <PaginationLink href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"} disabled={!data.pagination.hasPrevPage}>上一页</PaginationLink>
            <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">{data.pagination.page}</Badge>
            <PaginationLink href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"} disabled={!data.pagination.hasNextPage}>下一页</PaginationLink>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function PostTitleCell({ post }: { post: AdminPostListItem }) {
  const postHref = post.href ?? `/posts/${post.id}`

  return (
    <div className="flex items-start gap-3">
      <Avatar size="sm" className="mt-0.5 rounded-lg">
        <AvatarFallback className="rounded-lg">{getInitials(post.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <Tooltip content={post.title} className="w-full" disabled={post.title.length < 20}>
          <Link
            href={postHref}
            className={cn(
              "block line-clamp-1 text-sm font-medium transition-colors hover:text-primary",
              getPostTitleAccentClassName(post),
            )}
          >
            {post.title}
          </Link>
        </Tooltip>
        {post.summary ? (
          <Tooltip content={post.summary} className="w-full" disabled={post.summary.length < 28}>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {post.summary}
            </p>
          </Tooltip>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">无摘要内容</p>
        )}
      </div>
    </div>
  )
}

function PostBoardCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-foreground">{post.boardName}</p>
      <p className="text-muted-foreground">{post.zoneName ?? "未分区"}</p>
    </div>
  )
}

function PostAuthorCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-foreground">{post.authorName}</p>
      <p className="text-muted-foreground">@{post.authorUsername}</p>
    </div>
  )
}

function PostStatusCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Badge className={getPostStatusBadgeClassName(post.status)}>{post.statusLabel}</Badge>
        <Badge variant="outline">{post.typeLabel}</Badge>
      </div>
    </div>
  )
}

function PostFlagsCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {post.pinScope ? <Badge className={getPinScopeBadgeClassName(post.pinScope)}>{getPinScopeLabel(post.pinScope)}</Badge> : null}
        {post.isFeatured ? (
          <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
            推荐
          </Badge>
        ) : null}
        {post.isAnnouncement ? (
          <Badge className="border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
            公告
          </Badge>
        ) : null}
      </div>
      {post.reviewNote ? (
        <Tooltip content={`审核备注：${post.reviewNote}`} className="w-full">
          <p className="line-clamp-2 text-[11px] leading-5 text-muted-foreground">
            审核备注：{post.reviewNote}
          </p>
        </Tooltip>
      ) : (
        <p className="text-[11px] text-muted-foreground">暂无审核备注</p>
      )}
    </div>
  )
}

function PostEngagementCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>评论 {formatNumber(post.commentCount)}</p>
      <p>点赞 {formatNumber(post.likeCount)}</p>
    </div>
  )
}

function PostTrafficCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>收藏 {formatNumber(post.favoriteCount)}</p>
      <p>浏览 {formatNumber(post.viewCount)}</p>
    </div>
  )
}

function PostOpsCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>打赏 {formatNumber(post.tipCount)}</p>
      <p>热度 {formatNumber(Math.round(post.score))}</p>
    </div>
  )
}

function PostTimeCell({ post }: { post: AdminPostListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>创建 {formatMonthDayTime(post.createdAt)}</p>
      <p>{post.publishedAt ? `发布 ${formatMonthDayTime(post.publishedAt)}` : "未发布"}</p>
    </div>
  )
}

function PostActionsCell({
  post,
  canUseGlobalPin,
  groupedBoardOptions,
}: {
  post: AdminPostListItem
  canUseGlobalPin: boolean
  groupedBoardOptions: Array<{ zone: string; items: Array<{ value: string; label: string }> }>
}) {
  const router = useRouter()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const postHref = post.href ?? `/posts/${post.id}`

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger className="h-7 rounded-full border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted">
          操作
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => router.push(postHref)}>
            前台
            <ExternalLink className="ml-auto h-3.5 w-3.5" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
            预览
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>
            移动节点
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {post.status === "PENDING" ? (
            <>
              <DropdownMenuItem onClick={() => setActiveAction("approve")}>
                通过
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveAction("reject")} variant="destructive">
                驳回
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveAction("delete")} variant="destructive">
                删除
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setActiveAction("feature")}>
                {post.isFeatured ? "取消推荐" : "推荐"}
              </DropdownMenuItem>
              {post.isPinned ? (
                post.pinScope === "GLOBAL" && !canUseGlobalPin ? null : (
                  <DropdownMenuItem onClick={() => setActiveAction("pin-none")}>
                    取消置顶
                  </DropdownMenuItem>
                )
              ) : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    置顶方式
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setActiveAction("pin-board")}>
                      节点置顶
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveAction("pin-zone")}>
                      分区置顶
                    </DropdownMenuItem>
                    {canUseGlobalPin ? (
                      <DropdownMenuItem onClick={() => setActiveAction("pin-global")}>
                        全局置顶
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {post.status === "OFFLINE" ? (
                <>
                  <DropdownMenuItem onClick={() => setActiveAction("show")}>
                    恢复
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveAction("delete")} variant="destructive">
                    删除
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setActiveAction("hide")} variant="destructive">
                    下线
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveAction("delete")} variant="destructive">
                    删除
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AdminPostPreviewModal post={post} hideTrigger open={previewOpen} onOpenChange={setPreviewOpen} />
      <AdminPostMoveBoardButton
        postId={post.id}
        postTitle={post.title}
        currentBoardSlug={post.boardSlug}
        boardOptions={groupedBoardOptions}
        className="h-7 rounded-full px-2.5 text-xs"
        hideTrigger
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />

      {post.status === "PENDING" ? (
        <>
          <AdminPostActionButton
            action="post.approve"
            targetId={post.id}
            label="通过"
            modalTitle="确认通过审核"
            modalDescription={`帖子：${post.title}`}
            placeholder="填写审核备注（可选）"
            confirmText="确认通过"
            className="h-7 rounded-full px-2.5 text-xs"
            hideTrigger
            open={activeAction === "approve"}
            onOpenChange={(open) => setActiveAction(open ? "approve" : null)}
          />
          <AdminPostActionButton
            action="post.reject"
            targetId={post.id}
            label="驳回"
            tone="danger"
            modalTitle="确认驳回帖子"
            modalDescription={`帖子：${post.title}`}
            placeholder="填写驳回原因"
            confirmText="确认驳回"
            className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500"
            hideTrigger
            open={activeAction === "reject"}
            onOpenChange={(open) => setActiveAction(open ? "reject" : null)}
          />
          <AdminPostActionButton
            action="post.delete"
            targetId={post.id}
            label="删除"
            tone="danger"
            modalTitle="确认删除帖子"
            modalDescription={`帖子：${post.title}`}
            placeholder="填写删除原因（可选）"
            confirmText="确认删除"
            className="h-7 rounded-full bg-red-700 px-2.5 text-xs text-white hover:bg-red-600"
            hideTrigger
            open={activeAction === "delete"}
            onOpenChange={(open) => setActiveAction(open ? "delete" : null)}
          />
        </>
      ) : (
        <>
          <AdminPostActionButton
            action="post.feature"
            targetId={post.id}
            label={post.isFeatured ? "取消推" : "推荐"}
            className="h-7 rounded-full px-2.5 text-xs"
            hideTrigger
            open={activeAction === "feature"}
            onOpenChange={(open) => setActiveAction(open ? "feature" : null)}
          />
          {post.isPinned ? (
            post.pinScope === "GLOBAL" && !canUseGlobalPin ? null : (
              <AdminPostActionButton
                action="post.pin"
                targetId={post.id}
                label="取消顶"
                payload={{ scope: "NONE" }}
                className="h-7 rounded-full px-2.5 text-xs"
                hideTrigger
                open={activeAction === "pin-none"}
                onOpenChange={(open) => setActiveAction(open ? "pin-none" : null)}
              />
            )
          ) : (
            <>
              <AdminPostActionButton
                action="post.pin"
                targetId={post.id}
                label="节点顶"
                payload={{ scope: "BOARD" }}
                className="h-7 rounded-full px-2.5 text-xs"
                hideTrigger
                open={activeAction === "pin-board"}
                onOpenChange={(open) => setActiveAction(open ? "pin-board" : null)}
              />
              <AdminPostActionButton
                action="post.pin"
                targetId={post.id}
                label="分区顶"
                payload={{ scope: "ZONE" }}
                className="h-7 rounded-full px-2.5 text-xs"
                hideTrigger
                open={activeAction === "pin-zone"}
                onOpenChange={(open) => setActiveAction(open ? "pin-zone" : null)}
              />
              {canUseGlobalPin ? (
                <AdminPostActionButton
                  action="post.pin"
                  targetId={post.id}
                  label="全局顶"
                  payload={{ scope: "GLOBAL" }}
                  className="h-7 rounded-full px-2.5 text-xs"
                  hideTrigger
                  open={activeAction === "pin-global"}
                  onOpenChange={(open) => setActiveAction(open ? "pin-global" : null)}
                />
              ) : null}
            </>
          )}
          {post.status === "OFFLINE" ? (
            <>
              <AdminPostActionButton
                action="post.show"
                targetId={post.id}
                label="恢复"
                modalTitle="确认恢复帖子"
                modalDescription={`帖子：${post.title}`}
                placeholder="填写恢复说明（可选）"
                confirmText="确认恢复"
                className="h-7 rounded-full px-2.5 text-xs"
                hideTrigger
                open={activeAction === "show"}
                onOpenChange={(open) => setActiveAction(open ? "show" : null)}
              />
              <AdminPostActionButton
                action="post.delete"
                targetId={post.id}
                label="删除"
                tone="danger"
                modalTitle="确认删除帖子"
                modalDescription={`帖子：${post.title}`}
                placeholder="填写删除原因（可选）"
                confirmText="确认删除"
                className="h-7 rounded-full bg-red-700 px-2.5 text-xs text-white hover:bg-red-600"
                hideTrigger
                open={activeAction === "delete"}
                onOpenChange={(open) => setActiveAction(open ? "delete" : null)}
              />
            </>
          ) : (
            <>
              <AdminPostActionButton
                action="post.hide"
                targetId={post.id}
                label="下线"
                tone="danger"
                modalTitle="确认下线帖子"
                modalDescription={`帖子：${post.title}`}
                placeholder="填写下线原因（可选）"
                confirmText="确认下线"
                className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500"
                hideTrigger
                open={activeAction === "hide"}
                onOpenChange={(open) => setActiveAction(open ? "hide" : null)}
              />
              <AdminPostActionButton
                action="post.delete"
                targetId={post.id}
                label="删除"
                tone="danger"
                modalTitle="确认删除帖子"
                modalDescription={`帖子：${post.title}`}
                placeholder="填写删除原因（可选）"
                confirmText="确认删除"
                className="h-7 rounded-full bg-red-700 px-2.5 text-xs text-white hover:bg-red-600"
                hideTrigger
                open={activeAction === "delete"}
                onOpenChange={(open) => setActiveAction(open ? "delete" : null)}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={cn(
        buttonVariants({ variant: "outline", size: "default" }),
        "rounded-full px-3 text-xs",
        disabled ? "pointer-events-none opacity-40" : "",
      )}
    >
      {children}
    </Link>
  )
}

function OverviewActionLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "rounded-full shadow-xs"
      )}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function getInitials(name: string) {
  const normalized = name.trim()

  return normalized.slice(0, 2).toUpperCase() || "NA"
}

function getPostTitleAccentClassName(post: AdminPostListItem) {
  if (post.isFeatured) {
    return "text-emerald-700 dark:text-emerald-300"
  }

  if (post.isPinned) {
    return "text-orange-700 dark:text-orange-300"
  }

  return ""
}

function getPostStatusBadgeClassName(status: string) {
  if (status === "PENDING") {
    return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }

  if (status === "OFFLINE") {
    return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }

  return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}

function getPinScopeBadgeClassName(scope: string) {
  if (scope === "GLOBAL") {
    return "border-transparent bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
  }

  if (scope === "ZONE") {
    return "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200"
  }

  return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
}

function getPinScopeLabel(scope: string) {
  if (scope === "GLOBAL") {
    return "全局置顶"
  }

  if (scope === "ZONE") {
    return "分区置顶"
  }

  if (scope === "BOARD") {
    return "节点置顶"
  }

  return scope
}
