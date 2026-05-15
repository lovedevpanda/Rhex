"use client"

import { useCallback, useEffect, useState, useTransition } from "react"

import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { formatOptionalPreciseDateTime } from "@/lib/formatters"

interface SummaryCacheItem {
  id: string
  sourceKind: string
  sourceId: string
  modelKey: string
  contentHash: string
  summary: string
  hitCount: number
  createdAt: string
  lastHitAt: string | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Stats {
  totalEntries: number
  totalHits: number
}

interface ListResponse {
  code: number
  message?: string
  data?: {
    items: SummaryCacheItem[]
    pagination: Pagination
    stats: Stats
  }
}

interface ClearResponse {
  code: number
  message?: string
  data?: { deleted: number }
}

interface Filters {
  sourceKind: "" | "post" | "comment"
  sourceId: string
  modelKey: string
}

export function AiReplySummaryPage() {
  const [items, setItems] = useState<SummaryCacheItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [stats, setStats] = useState<Stats>({ totalEntries: 0, totalHits: 0 })
  const [loading, setLoading] = useState(false)
  const [pendingAction, startTransition] = useTransition()
  const [filters, setFilters] = useState<Filters>({ sourceKind: "", sourceId: "", modelKey: "" })
  const [page, setPage] = useState(1)
  const [olderThanDays, setOlderThanDays] = useState("30")

  const loadPage = useCallback(
    async (targetPage: number, f: Filters) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("page", String(targetPage))
        if (f.sourceKind) params.set("sourceKind", f.sourceKind)
        if (f.sourceId.trim()) params.set("sourceId", f.sourceId.trim())
        if (f.modelKey.trim()) params.set("modelKey", f.modelKey.trim())
        const res = await fetch(`/api/admin/apps/ai-reply/summary/list?${params.toString()}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as ListResponse
        if (json.code !== 0 || !json.data) {
          toast.error(json.message ?? "加载失败")
          return
        }
        setItems(json.data.items)
        setPagination(json.data.pagination)
        setStats(json.data.stats)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadPage(page, filters)
  }, [page, loadPage, filters])

  const callClear = useCallback(
    async (body: Record<string, unknown>, successMsg: string) => {
      try {
        const res = await fetch("/api/admin/apps/ai-reply/summary/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        })
        const json = (await res.json()) as ClearResponse
        if (json.code !== 0 || !json.data) {
          toast.error(json.message ?? "清理失败")
          return
        }
        toast.success(`${successMsg}：已删除 ${json.data.deleted} 条`)
        await loadPage(1, filters)
        setPage(1)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "清理失败")
      }
    },
    [filters, loadPage],
  )

  const handleDeleteOne = useCallback(
    (id: string) => {
      if (!window.confirm("确认删除该条缓存？")) return
      startTransition(() => {
        void callClear({ id }, "已删除")
      })
    },
    [callClear],
  )

  const handleClearAll = useCallback(() => {
    if (!window.confirm("确认清理全部 AI 总结缓存？此操作不可撤销。")) return
    startTransition(() => {
      void callClear({ all: true }, "已清理全部")
    })
  }, [callClear])

  const handleClearOld = useCallback(() => {
    const days = Number(olderThanDays)
    if (!Number.isFinite(days) || days < 0) {
      toast.error("天数必须为非负整数")
      return
    }
    if (!window.confirm(`确认删除创建时间早于 ${days} 天的缓存？`)) return
    startTransition(() => {
      void callClear({ olderThanDays: Math.trunc(days) }, `已清理 ${days} 天前数据`)
    })
  }, [callClear, olderThanDays])

  const applyFilters = useCallback(() => {
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({ sourceKind: "", sourceId: "", modelKey: "" })
    setPage(1)
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>缓存概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">当前筛选匹配</div>
              <div className="text-lg font-semibold">{pagination.total}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">全部缓存条目</div>
              <div className="text-lg font-semibold">{stats.totalEntries}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">累计命中次数</div>
              <div className="text-lg font-semibold">{stats.totalHits}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>筛选 & 操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-xs text-muted-foreground">来源类型</span>
              <select
                className="rounded border border-border bg-background px-2 py-1"
                value={filters.sourceKind}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, sourceKind: e.target.value as Filters["sourceKind"] }))
                }
              >
                <option value="">全部</option>
                <option value="post">帖子</option>
                <option value="comment">评论</option>
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-xs text-muted-foreground">来源 ID</span>
              <input
                className="rounded border border-border bg-background px-2 py-1"
                value={filters.sourceId}
                onChange={(e) => setFilters((prev) => ({ ...prev, sourceId: e.target.value }))}
                placeholder="post/comment id"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-xs text-muted-foreground">模型 Key</span>
              <input
                className="rounded border border-border bg-background px-2 py-1"
                value={filters.modelKey}
                onChange={(e) => setFilters((prev) => ({ ...prev, modelKey: e.target.value }))}
                placeholder="例如 gpt-4o-mini"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={applyFilters} disabled={loading || pendingAction}>
              应用筛选
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters} disabled={loading || pendingAction}>
              重置
            </Button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-xs text-muted-foreground">清理早于</span>
                <input
                  className="w-16 rounded border border-border bg-background px-2 py-1"
                  value={olderThanDays}
                  onChange={(e) => setOlderThanDays(e.target.value)}
                  inputMode="numeric"
                />
                <span className="text-xs text-muted-foreground">天</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearOld} disabled={pendingAction}>
                按天数清理
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={pendingAction}>
                清理全部
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>缓存列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="rounded border border-border p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{it.sourceKind}</span>
                    <span className="font-mono">{it.sourceId}</span>
                    <span>model: {it.modelKey}</span>
                    <span>命中 {it.hitCount}</span>
                    <span>created {formatOptionalPreciseDateTime(it.createdAt) ?? "-"}</span>
                    {it.lastHitAt ? <span>last hit {formatOptionalPreciseDateTime(it.lastHitAt) ?? "-"}</span> : null}
                    <span className="font-mono" title={it.contentHash}>
                      hash: {it.contentHash.slice(0, 10)}…
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => handleDeleteOne(it.id)}
                      disabled={pendingAction}
                    >
                      删除
                    </Button>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{it.summary}</div>
                </div>
              ))}
            </div>
          )}

          {pagination.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm pr-16 sm:pr-20">
              <span>
                第 {pagination.page} / {pagination.totalPages} 页（共 {pagination.total} 条）
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={loading || pendingAction || page <= 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={loading || pendingAction || page >= pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}