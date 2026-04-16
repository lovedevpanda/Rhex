"use client"

import Link from "next/link"
import { type ReactNode, useState, useTransition } from "react"

import { AddonSurfaceClientRenderer } from "@/addons-host/client/addon-surface-client-renderer"
import { ForumPostListItem } from "@/components/forum/forum-post-list-item"
import { PageNumberPagination } from "@/components/page-number-pagination"
import { Button } from "@/components/ui/rbutton"
import { showConfirm } from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"
import type { SitePostItem } from "@/lib/posts"

interface FavoriteCollectionDetailProps {
  postLinkDisplayMode?: "SLUG" | "ID"
  heroBefore?: ReactNode
  heroAfter?: ReactNode
  pendingBefore?: ReactNode
  pendingAfter?: ReactNode
  contentBefore?: ReactNode
  contentAfter?: ReactNode
  initialData: {
    id: string
    title: string
    description: string | null
    visibility: "PUBLIC" | "PRIVATE"
    allowOtherUsersToContribute: boolean
    requireContributionApproval: boolean
    postCount: number
    ownerId: number
    ownerName: string
    createdAt: string
    updatedAt: string
    isOwner: boolean
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
      hasPrevPage: boolean
      hasNextPage: boolean
    }
    pendingPagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
      hasPrevPage: boolean
      hasNextPage: boolean
    }
    items: Array<{
      id: string
      postId: string
      addedAt: string
      addedByName: string
      post: SitePostItem
    }>
    pendingSubmissions: Array<{
      id: string
      postId: string
      postTitle: string
      postSlug: string
      submittedAt: string
      submittedByName: string
    }>
  }
}

async function submitFavoriteCollectionAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/favorite-collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.message ?? "操作失败")
  }

  return result
}

function mapCollectionPostToForumItem(item: FavoriteCollectionDetailProps["initialData"]["items"][number]) {
  return {
    id: item.post.id,
    slug: item.post.slug,
    title: item.post.title,
    type: item.post.type,
    typeLabel: item.post.typeLabel,
    pinScope: item.post.pinScope,
    pinLabel: item.post.pinScope === "GLOBAL" ? "全局置顶" : null,
    hasRedPacket: Boolean(item.post.hasRedPacket),
    rewardMode: item.post.rewardMode,
    minViewLevel: item.post.minViewLevel,
    minViewVipLevel: item.post.minViewVipLevel,
    isFeatured: item.post.isFeatured,
    boardName: item.post.board,
    boardSlug: item.post.boardSlug,
    boardIcon: item.post.boardIcon,
    authorName: item.post.author,
    authorUsername: item.post.authorUsername ?? "",
    authorAvatarPath: item.post.authorAvatarPath ?? null,
    authorStatus: item.post.authorStatus,
    authorIsVip: item.post.authorIsVip ?? false,
    authorVipLevel: item.post.authorVipLevel ?? null,
    authorDisplayedBadges: (item.post.authorDisplayedBadges ?? []).map((badge) => ({
      id: badge.id,
      name: badge.name,
      color: badge.color,
      iconText: badge.iconText,
    })),
    metaPrimary: item.post.publishedAt,
    metaPrimaryRaw: item.post.publishedAtRaw,
    metaSecondary: `收录者 ${item.addedByName}`,
    commentCount: item.post.stats.comments,
    commentAccentColor: "#64748b",
  }
}

export function FavoriteCollectionDetail({
  initialData,
  postLinkDisplayMode = "SLUG",
  heroBefore,
  heroAfter,
  pendingBefore,
  pendingAfter,
  contentBefore,
  contentAfter,
}: FavoriteCollectionDetailProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  function buildPageHref(page: number) {
    const searchParams = new URLSearchParams()
    if (page > 1) {
      searchParams.set("page", String(page))
    }
    if (data.pendingPagination.page > 1) {
      searchParams.set("pendingPage", String(data.pendingPagination.page))
    }
    const queryString = searchParams.toString()
    return queryString ? `/collections/${data.id}?${queryString}` : `/collections/${data.id}`
  }

  function buildPendingPageHref(page: number) {
    const searchParams = new URLSearchParams()
    if (data.pagination.page > 1) {
      searchParams.set("page", String(data.pagination.page))
    }
    if (page > 1) {
      searchParams.set("pendingPage", String(page))
    }
    const queryString = searchParams.toString()
    return queryString ? `/collections/${data.id}?${queryString}` : `/collections/${data.id}`
  }

  async function removePost(postId: string) {
    const confirmed = await showConfirm({
      title: "移出合集",
      description: "这只会把帖子从当前合集移出，不会影响帖子本身，也不会取消普通收藏。确认继续吗？",
      confirmText: "移出合集",
      cancelText: "取消",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        const result = await submitFavoriteCollectionAction({
          action: "remove-post",
          collectionId: data.id,
          postId,
        })
        toast.success(String(result.message ?? "帖子已移出合集"), "操作成功")
        setData((current) => ({
          ...current,
          postCount: Math.max(0, current.postCount - 1),
          pagination: {
            ...current.pagination,
            total: Math.max(0, current.pagination.total - 1),
          },
          items: current.items.filter((item) => item.postId !== postId),
        }))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "移出合集失败", "操作失败")
      }
    })
  }

  function reviewSubmission(submissionId: string, decision: "APPROVE" | "REJECT") {
    startTransition(async () => {
      try {
        const result = await submitFavoriteCollectionAction({
          action: "review-submission",
          submissionId,
          decision,
        })
        toast.success(String(result.message ?? (decision === "APPROVE" ? "投稿已通过" : "投稿已驳回")), "操作成功")
        setData((current) => ({
          ...current,
          postCount: decision === "APPROVE" ? current.postCount + 1 : current.postCount,
          pagination: {
            ...current.pagination,
            total: decision === "APPROVE" ? current.pagination.total + 1 : current.pagination.total,
          },
          pendingPagination: {
            ...current.pendingPagination,
            total: Math.max(0, current.pendingPagination.total - 1),
          },
          pendingSubmissions: current.pendingSubmissions.filter((item) => item.id !== submissionId),
        }))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "审核失败", "操作失败")
      }
    })
  }

  return (
    <div className="space-y-4">
      {heroBefore}
      <AddonSurfaceClientRenderer
        surface="collection.hero"
        surfaceProps={{ data, isPending }}
        fallback={(
          <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold sm:text-xl">{data.title}</h1>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{data.visibility === "PUBLIC" ? "公开" : "私有"}</span>
                  {data.allowOtherUsersToContribute ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{data.requireContributionApproval ? "允许投稿 / 需审核" : "允许投稿 / 免审核"}</span> : null}
                </div>
                {data.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{data.description}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>创建者 {data.ownerName}</span>
                  <span>帖子 {data.postCount}</span>
                  <span>更新于 {new Date(data.updatedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/collections" className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">合集广场</Link>
                {data.isOwner ? <Link href="/settings?tab=post-management&postTab=collections" className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">我的合集</Link> : null}
              </div>
            </div>
          </section>
        )}
      />
      {heroAfter}

      {data.isOwner && data.pendingSubmissions.length > 0 ? (
        <>
          {pendingBefore}
          <AddonSurfaceClientRenderer
            surface="collection.pending"
            surfaceProps={{
              buildPendingPageHref,
              data,
              isPending,
              reviewSubmission,
            }}
            fallback={(
              <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">待审核投稿</h2>
                    <p className="mt-1 text-xs text-muted-foreground">只有创建者可见，通过后帖子会正式进入合集。</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700">待审核 {data.pendingPagination.total}</span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {data.pendingSubmissions.map((submission) => (
                    <div key={submission.id} className="rounded-[18px] border border-border bg-secondary/10 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/posts/${submission.postSlug}`} className="block truncate text-sm font-medium text-foreground transition hover:text-primary">
                            {submission.postTitle}
                          </Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span>投稿人 {submission.submittedByName}</span>
                            <span>{new Date(submission.submittedAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" className="h-8 px-3 text-[11px]" disabled={isPending} onClick={() => reviewSubmission(submission.id, "APPROVE")}>通过</Button>
                          <Button type="button" variant="outline" className="h-8 px-3 text-[11px]" disabled={isPending} onClick={() => reviewSubmission(submission.id, "REJECT")}>驳回</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {data.pendingPagination.totalPages > 1 ? (
                  <div className="mt-5">
                    <PageNumberPagination
                      page={data.pendingPagination.page}
                      totalPages={data.pendingPagination.totalPages}
                      hasPrevPage={data.pendingPagination.hasPrevPage}
                      hasNextPage={data.pendingPagination.hasNextPage}
                      buildHref={buildPendingPageHref}
                    />
                  </div>
                ) : null}
              </section>
            )}
          />
          {pendingAfter}
        </>
      ) : null}

      {contentBefore}
      <AddonSurfaceClientRenderer
        surface="collection.content"
        surfaceProps={{
          buildPageHref,
          data,
          isPending,
          postLinkDisplayMode,
          removePost,
        }}
        fallback={(
          <section className="rounded-[22px] border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">已收录帖子</h2>
                <p className="mt-1 text-xs text-muted-foreground">{data.items.length > 0 ? "按加入时间倒序显示。" : "这个合集里还没有帖子。"}</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{data.pagination.total} 帖</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {data.items.length === 0 ? <div className="rounded-[18px] border border-dashed border-border bg-secondary/10 px-4 py-6 text-sm text-muted-foreground">当前合集还没有帖子。</div> : null}
              {data.items.map((item) => (
                <div key={item.id} className="rounded-[18px] border border-border bg-secondary/10 px-2 py-1.5 sm:px-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <ForumPostListItem
                        item={mapCollectionPostToForumItem(item)}
                        showBoard
                        postLinkDisplayMode={postLinkDisplayMode}
                      />
                    </div>
                    {data.isOwner ? (
                      <div className="px-2 pb-2 sm:px-0 sm:pb-0">
                        <Button type="button" variant="ghost" className="h-8 px-3 text-[11px] text-red-600 hover:text-red-500" disabled={isPending} onClick={() => void removePost(item.postId)}>
                          移出合集
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {data.pagination.totalPages > 1 ? (
              <div className="mt-5">
                <PageNumberPagination
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  hasPrevPage={data.pagination.hasPrevPage}
                  hasNextPage={data.pagination.hasNextPage}
                  buildHref={buildPageHref}
                />
              </div>
            ) : null}
          </section>
        )}
      />
      {contentAfter}
    </div>
  )
}

