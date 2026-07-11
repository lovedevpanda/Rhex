"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface FavoriteCollectionDialogProps {
  open: boolean
  postId: string
  favored: boolean
  openMode: "newly-favored" | "manage"
  onClose: () => void
  onFavoriteChanged: (favored: boolean) => void
}

interface FavoriteCollectionModalData {
  favored: boolean
  keyword: string
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  collections: Array<{
    id: string
    title: string
    description: string | null
    visibility: "PUBLIC" | "PRIVATE"
    allowOtherUsersToContribute: boolean
    requireContributionApproval: boolean
    ownerId: number
    ownerName: string
    postCount: number
    alreadyIncluded: boolean
    pendingSubmission: boolean
    pendingOwnedByCurrentUser: boolean
    isOwner: boolean
    canContribute: boolean
  }>
}

const EMPTY_MODAL_DATA: FavoriteCollectionModalData = {
  favored: false,
  keyword: "",
  pagination: {
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  },
  collections: [],
}

function buildPageTokens(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "ellipsis">
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)

  const result: Array<number | "ellipsis"> = []
  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? result.at(-1) as number : null
    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }
    result.push(current)
  }

  return result
}

export function FavoriteCollectionDialog(props: FavoriteCollectionDialogProps) {
  if (!props.open) {
    return null
  }

  return <FavoriteCollectionDialogContent key={`${props.postId}:${props.openMode}`} {...props} />
}

function FavoriteCollectionDialogContent({
  open,
  postId,
  favored,
  openMode,
  onClose,
  onFavoriteChanged,
}: FavoriteCollectionDialogProps) {
  const [data, setData] = useState<FavoriteCollectionModalData>(EMPTY_MODAL_DATA)
  const [loading, setLoading] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftVisibility, setDraftVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE")
  const [draftAllowOtherUsersToContribute, setDraftAllowOtherUsersToContribute] = useState(false)
  const [draftRequireContributionApproval, setDraftRequireContributionApproval] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(
    openMode === "newly-favored"
      ? { tone: "success", message: "收藏成功，可选择加入合集；也可以直接关闭，仅保留默认收藏。" }
      : null,
  )
  const [searchDraft, setSearchDraft] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [activeTab, setActiveTab] = useState<"existing" | "create">(
    openMode === "newly-favored" ? "create" : "existing",
  )
  const [isPending, startTransition] = useTransition()

  const publicCreateEnabled = draftVisibility === "PUBLIC"

  const loadModalData = useCallback(async (page = 1, keyword = "") => {
    setLoading(true)
    const searchParams = new URLSearchParams({
      postId,
      page: String(page),
    })
    if (keyword.trim()) {
      searchParams.set("q", keyword.trim())
    }

    try {
      const response = await fetch(`/api/favorite-collections?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message ?? "合集数据加载失败")
      }
      setData(result.data as FavoriteCollectionModalData)
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "合集数据加载失败",
      })
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    queueMicrotask(() => {
      void loadModalData(1, "")
    })
  }, [loadModalData])

  function resetCreateDraft() {
    setDraftTitle("")
    setDraftDescription("")
    setDraftVisibility("PRIVATE")
    setDraftAllowOtherUsersToContribute(false)
    setDraftRequireContributionApproval(false)
  }

  async function runFavoriteToggle() {
    const response = await fetch("/api/posts/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "收藏操作失败")
    }

    const nextFavored = Boolean(result.data?.favored)
    onFavoriteChanged(nextFavored)
    setData((current) => ({
      ...current,
      favored: nextFavored,
    }))
    return {
      nextFavored,
      message: String(result.message ?? (nextFavored ? "收藏成功" : "已取消收藏")),
    }
  }

  function addToCollection(collectionId: string) {
    setFeedback(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/favorite-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-post",
            collectionId,
            postId,
          }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message ?? "加入合集失败")
        }

        const message = String(result.message ?? "帖子已加入合集")
        setFeedback({
          tone: "success",
          message,
        })
        setData((current) => ({
          ...current,
          collections: current.collections.map((item) => item.id === collectionId
            ? {
                ...item,
                alreadyIncluded: result.data?.status === "APPROVED",
                pendingSubmission: result.data?.status === "PENDING",
                pendingOwnedByCurrentUser: result.data?.status === "PENDING",
                postCount: result.data?.status === "APPROVED" ? item.postCount + 1 : item.postCount,
              }
            : item),
        }))
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "加入合集失败",
        })
      }
    })
  }

  function createAndAdd() {
    setFeedback(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/favorite-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            postId,
            collection: {
              title: draftTitle,
              description: draftDescription,
              visibility: draftVisibility,
              allowOtherUsersToContribute: publicCreateEnabled ? draftAllowOtherUsersToContribute : false,
              requireContributionApproval: publicCreateEnabled && draftAllowOtherUsersToContribute ? draftRequireContributionApproval : false,
            },
          }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message ?? "创建合集失败")
        }

        setFeedback({
          tone: "success",
          message: String(result.message ?? "合集已创建"),
        })
        resetCreateDraft()
        setSearchDraft("")
        setSearchKeyword("")
        await loadModalData(1, "")
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "创建合集失败",
        })
      }
    })
  }

  function cancelFavorite() {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await runFavoriteToggle()
        setFeedback({
          tone: "info",
          message: result.message,
        })
        onClose()
      } catch (error) {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "取消收藏失败",
        })
      }
    })
  }

  function submitSearch() {
    const nextKeyword = searchDraft.trim()
    setSearchKeyword(nextKeyword)
    setFeedback(null)
    void loadModalData(1, nextKeyword)
  }

  const pageTokens = buildPageTokens(data.pagination.page, data.pagination.totalPages)

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      size="xl"
      title="加入收藏合集"
      description="默认收藏保留不变，你可以额外把帖子加入合集里归档。"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <Button
              type="button"
              variant={activeTab === "existing" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setActiveTab("existing")}
            >
              现有合集
            </Button>
            <Button
              type="button"
              variant={activeTab === "create" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setActiveTab("create")}
            >
              新建合集
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {favored ? (
              <Button type="button" variant="ghost" disabled={isPending} onClick={cancelFavorite}>
                取消收藏
              </Button>
            ) : null}
            <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      )}
    >
      {feedback ? (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200"
              : feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={cn(activeTab === "existing" ? "block" : "hidden lg:block")}>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>选择现有合集</CardTitle>
              <CardDescription>搜索自己的合集，或把帖子投稿到允许参与的公开合集。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      submitSearch()
                    }
                  }}
                  placeholder="搜索合集名称或说明"
                  className="h-10 rounded-xl bg-background px-4 text-sm"
                />
                <Button type="button" variant="outline" className="h-10 sm:shrink-0" disabled={loading || isPending} onClick={submitSearch}>
                  搜索
                </Button>
                {searchKeyword ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10"
                    disabled={loading || isPending}
                    onClick={() => {
                      setSearchDraft("")
                      setSearchKeyword("")
                      setFeedback(null)
                      void loadModalData(1, "")
                    }}
                  >
                    清除
                  </Button>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="rounded-full">
                  共 <span title={`${formatNumber(data.pagination.total)} 个合集`}>{formatCompactNumber(data.pagination.total)}</span> 个合集
                </Badge>
                <Link href="/collections" className="text-xs text-muted-foreground transition hover:text-foreground">
                  查看合集页
                </Link>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <Card>
                    <CardContent className="py-5 text-sm text-muted-foreground">
                      加载合集中...
                    </CardContent>
                  </Card>
                ) : null}
                {!loading && data.collections.length === 0 ? (
                  <Card>
                    <CardContent className="py-5 text-sm text-muted-foreground">
                      {searchKeyword ? "没有找到匹配的合集，可以调整关键词或在右侧直接新建一个。" : "你当前还没有可用合集，右侧可以直接新建一个。"}
                    </CardContent>
                  </Card>
                ) : null}
                {!loading ? data.collections.map((collection) => (
                  <Card key={collection.id} size="sm">
                    <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-sm font-medium">{collection.title}</h5>
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            {collection.visibility === "PUBLIC" ? "公开" : "私有"}
                          </Badge>
                          {collection.isOwner ? (
                            <Badge variant="outline" className="rounded-full text-[10px]">我创建的</Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full text-[10px]">创建者 {collection.ownerName}</Badge>
                          )}
                          {collection.allowOtherUsersToContribute ? (
                            <Badge variant="outline" className="rounded-full text-[10px]">
                              {collection.requireContributionApproval ? "允许投稿 / 需审核" : "允许投稿 / 免审核"}
                            </Badge>
                          ) : null}
                        </div>
                        {collection.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{collection.description}</p> : null}
                        <p className="mt-2 text-xs text-muted-foreground" title={`已收录 ${formatNumber(collection.postCount)} 帖`}>已收录 {formatCompactNumber(collection.postCount)} 帖</p>
                      </div>
                      <div className="sm:shrink-0">
                        {collection.alreadyIncluded ? (
                          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
                            已加入
                          </Button>
                        ) : collection.pendingSubmission ? (
                          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
                            待审核
                          </Button>
                        ) : (
                          <Button type="button" className="w-full sm:w-auto" disabled={isPending || !collection.canContribute} onClick={() => addToCollection(collection.id)}>
                            加入
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )) : null}

                {!loading && data.pagination.totalPages > 1 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" disabled={!data.pagination.hasPrevPage || isPending} onClick={() => void loadModalData(data.pagination.page - 1, searchKeyword)}>
                      上一页
                    </Button>
                    {pageTokens.map((token, index) => token === "ellipsis" ? (
                      <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">...</span>
                    ) : (
                      <Button
                        key={token}
                        type="button"
                        variant={token === data.pagination.page ? "default" : "outline"}
                        size="sm"
                        className="min-w-8 px-2"
                        disabled={isPending || token === data.pagination.page}
                        onClick={() => void loadModalData(token, searchKeyword)}
                      >
                        {token}
                      </Button>
                    ))}
                    <Button type="button" variant="outline" size="sm" disabled={!data.pagination.hasNextPage || isPending} onClick={() => void loadModalData(data.pagination.page + 1, searchKeyword)}>
                      下一页
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={cn(activeTab === "create" ? "block" : "hidden lg:block")}>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>新建合集并加入</CardTitle>
              <CardDescription>移动端优先展示创建表单，方便直接新建后加入。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 py-4">
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-foreground">合集名称</span>
                <Input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="例如：前端设计灵感"
                  className="h-11 rounded-xl bg-background px-4 text-sm"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-foreground">合集说明</span>
                <Textarea
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  placeholder="可选，说明收录标准或合集用途。"
                  className="min-h-[96px] rounded-2xl bg-background px-4 py-3 text-sm"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-foreground">可见性</span>
                <Select
                  value={draftVisibility}
                  onValueChange={(value) => {
                    const nextVisibility = value === "PUBLIC" ? "PUBLIC" : "PRIVATE"
                    setDraftVisibility(nextVisibility)
                    if (nextVisibility === "PRIVATE") {
                      setDraftAllowOtherUsersToContribute(false)
                      setDraftRequireContributionApproval(false)
                    }
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background px-4 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">私有，仅自己可见和使用</SelectItem>
                    <SelectItem value="PUBLIC">公开，其他用户可见</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/35 px-4 py-3 text-sm">
                <span>允许其他用户投稿</span>
                <Checkbox
                  checked={draftVisibility === "PUBLIC" && draftAllowOtherUsersToContribute}
                  disabled={draftVisibility !== "PUBLIC"}
                  onCheckedChange={(value) => setDraftAllowOtherUsersToContribute(Boolean(value))}
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/35 px-4 py-3 text-sm">
                <span>其他用户投稿需要审核</span>
                <Checkbox
                  checked={draftVisibility === "PUBLIC" && draftAllowOtherUsersToContribute && draftRequireContributionApproval}
                  disabled={draftVisibility !== "PUBLIC" || !draftAllowOtherUsersToContribute}
                  onCheckedChange={(value) => setDraftRequireContributionApproval(Boolean(value))}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={isPending || !draftTitle.trim()} onClick={createAndAdd}>
                  {isPending ? "提交中..." : "创建并加入"}
                </Button>
                <Button type="button" variant="ghost" disabled={isPending} onClick={resetCreateDraft}>
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Modal>
  )
}
