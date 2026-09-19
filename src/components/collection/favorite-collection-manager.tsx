"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"

import { PageNumberPagination } from "@/components/page-number-pagination"
import { Button } from "@/components/ui/rbutton"
import { showConfirm } from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"
import { formatCompactNumber, formatDateTime, formatNumber } from "@/lib/formatters"

type FavoriteCollectionManageData = {
  collections: Array<{
    id: string
    title: string
    description: string | null
    visibility: "PUBLIC" | "PRIVATE"
    allowOtherUsersToContribute: boolean
    requireContributionApproval: boolean
    postCount: number
    pendingSubmissionCount: number
    createdAt: string
    updatedAt: string
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
    prevCursor: string | null
    nextCursor: string | null
  }
}

type Draft = {
  title: string
  description: string
  visibility: "PUBLIC" | "PRIVATE"
  allowOtherUsersToContribute: boolean
  requireContributionApproval: boolean
}

function createEmptyDraft(): Draft {
  return {
    title: "",
    description: "",
    visibility: "PRIVATE",
    allowOtherUsersToContribute: false,
    requireContributionApproval: false,
  }
}

function createDraftFromItem(item: FavoriteCollectionManageData["collections"][number]): Draft {
  return {
    title: item.title,
    description: item.description ?? "",
    visibility: item.visibility,
    allowOtherUsersToContribute: item.allowOtherUsersToContribute,
    requireContributionApproval: item.requireContributionApproval,
  }
}

async function submitCollectionAction(payload: Record<string, unknown>) {
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

export function FavoriteCollectionManager({ initialData }: { initialData: FavoriteCollectionManageData | null }) {
  const searchParams = useSearchParams()
  const [data, setData] = useState<FavoriteCollectionManageData>(initialData ?? {
    collections: [],
    pagination: {
      page: 1,
      pageSize: 8,
      total: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
    },
  })
  const [draft, setDraft] = useState<Draft>(createEmptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  function resetDraft() {
    setEditingId(null)
    setDraft(createEmptyDraft())
  }

  async function refreshData(page = data.pagination.page) {
    const response = await fetch(`/api/favorite-collections?view=owned&page=${page}`, {
      method: "GET",
      cache: "no-store",
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message ?? "合集数据加载失败")
    }

    const nextData = result.data as FavoriteCollectionManageData
    setData(nextData)
  }

  function buildCollectionPageHref(page: number) {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.set("tab", "post-management")
    nextSearchParams.set("postTab", "collections")
    nextSearchParams.set("collectionPage", String(page))
    nextSearchParams.delete("listAfter")
    nextSearchParams.delete("listBefore")
    const queryString = nextSearchParams.toString()

    return queryString ? `/settings?${queryString}` : "/settings?tab=post-management&postTab=collections"
  }

  function submitCreateOrUpdate() {
    setFeedback("")
    startTransition(async () => {
      try {
        const payload = {
          action: editingId ? "update" : "create",
          collectionId: editingId,
          collection: {
            title: draft.title,
            description: draft.description,
            visibility: draft.visibility,
            allowOtherUsersToContribute: draft.visibility === "PUBLIC" ? draft.allowOtherUsersToContribute : false,
            requireContributionApproval: draft.visibility === "PUBLIC" && draft.allowOtherUsersToContribute ? draft.requireContributionApproval : false,
          },
        }
        const result = await submitCollectionAction(payload)
        setFeedback(String(result.message ?? (editingId ? "合集已更新" : "合集已创建")))
        await refreshData()
        resetDraft()
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "合集保存失败")
      }
    })
  }

  function startEditing(item: FavoriteCollectionManageData["collections"][number]) {
    setEditingId(item.id)
    setDraft(createDraftFromItem(item))
    setFeedback("")
  }

  async function deleteCollection(collectionId: string) {
    const confirmed = await showConfirm({
      title: "删除合集",
      description: "删除后合集和其中的收录关系会一起移除，但不会影响帖子本身和普通收藏记录。确认继续吗？",
      confirmText: "删除合集",
      cancelText: "取消",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        const result = await submitCollectionAction({
          action: "delete",
          collectionId,
        })
        toast.success(String(result.message ?? "合集已删除"), "操作成功")
        await refreshData()
        if (editingId === collectionId) {
          resetDraft()
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除合集失败", "操作失败")
      }
    })
  }

  if (!initialData) {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">合集数据暂时无法加载，请稍后刷新重试。</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">我的合集</h3>
            <p className="mt-1 text-sm text-muted-foreground">在这里管理你创建的收藏合集，控制公开范围、他人投稿和审核规则。</p>
          </div>
          <Link href="/collections" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
            浏览合集广场
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-xl border border-border bg-secondary/10 p-4">
            <h4 className="text-sm font-semibold">{editingId ? "编辑合集" : "新建合集"}</h4>
            <div className="mt-4 space-y-3">
              <label className="block space-y-2 text-sm">
                <span className="font-medium">合集名称</span>
                <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden transition-colors focus:border-foreground/30" placeholder="例如：硬核技术帖精选" />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-medium">合集说明</span>
                <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-[100px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-hidden transition-colors focus:border-foreground/30" placeholder="可选，说明收录标准或合集用途。" />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-medium">可见性</span>
                <select value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value === "PUBLIC" ? "PUBLIC" : "PRIVATE", allowOtherUsersToContribute: event.target.value === "PUBLIC" ? current.allowOtherUsersToContribute : false, requireContributionApproval: event.target.value === "PUBLIC" ? current.requireContributionApproval : false }))} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden transition-colors focus:border-foreground/30">
                  <option value="PRIVATE">私有，仅自己可见和使用</option>
                  <option value="PUBLIC">公开，其他用户可见</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-background px-4 py-3 text-sm">
                <span>允许其他用户投稿</span>
                <input type="checkbox" checked={draft.visibility === "PUBLIC" && draft.allowOtherUsersToContribute} disabled={draft.visibility !== "PUBLIC"} onChange={(event) => setDraft((current) => ({ ...current, allowOtherUsersToContribute: event.target.checked, requireContributionApproval: event.target.checked ? current.requireContributionApproval : false }))} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-background px-4 py-3 text-sm">
                <span>其他用户投稿需要审核</span>
                <input type="checkbox" checked={draft.visibility === "PUBLIC" && draft.allowOtherUsersToContribute && draft.requireContributionApproval} disabled={draft.visibility !== "PUBLIC" || !draft.allowOtherUsersToContribute} onChange={(event) => setDraft((current) => ({ ...current, requireContributionApproval: event.target.checked }))} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={isPending || !draft.title.trim()} onClick={submitCreateOrUpdate}>
                  {isPending ? "提交中..." : editingId ? "保存修改" : "创建合集"}
                </Button>
                <Button type="button" variant="ghost" disabled={isPending} onClick={resetDraft}>
                  {editingId ? "取消编辑" : "清空"}
                </Button>
              </div>
              {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
            </div>
          </div>

          <div className="space-y-3">
            {data.collections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">你还没有创建任何合集。创建后，收藏帖子时就能直接加入这些合集。</div>
            ) : data.collections.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{item.visibility === "PUBLIC" ? "公开" : "私有"}</span>
                      {item.allowOtherUsersToContribute ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{item.requireContributionApproval ? "允许投稿 / 需审核" : "允许投稿 / 免审核"}</span> : null}
                      {item.pendingSubmissionCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 tabular-nums" title={`${formatNumber(item.pendingSubmissionCount)} 个待审核投稿`}>待审核 {formatCompactNumber(item.pendingSubmissionCount)}</span> : null}
                    </div>
                    {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span title={`${formatNumber(item.postCount)} 帖`}>帖子 {formatCompactNumber(item.postCount)}</span>
                      <span>更新于 {formatDateTime(item.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/collections/${item.id}`} className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">查看详情</Link>
                    <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => startEditing(item)}>编辑</Button>
                    <Button type="button" variant="ghost" className="h-9 px-3 text-xs text-red-600 hover:text-red-500" disabled={isPending} onClick={() => void deleteCollection(item.id)}>删除</Button>
                  </div>
                </div>
              </div>
            ))}

            {data.pagination.total > 0 ? (
              <PageNumberPagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                hasPrevPage={data.pagination.hasPrevPage}
                hasNextPage={data.pagination.hasNextPage}
                buildHref={buildCollectionPageHref}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

