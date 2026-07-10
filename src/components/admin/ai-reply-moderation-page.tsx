"use client"

import { useCallback, useEffect, useState, useTransition } from "react"

import { AdminClientPaginationBar } from "@/components/admin/admin-pagination-bar"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { formatOptionalPreciseDateTime } from "@/lib/formatters"

interface SuggestedTagLite {
  id: string
  name: string
  slug: string
}

interface SuggestedBoardLite {
  id: string
  name: string
  slug: string
}

interface PostLite {
  id: string
  title: string
  boardId: string | null
  status: string
  authorId: number | null
  createdAt: string
  author: { id: number; username: string | null; nickname: string | null } | null
  board: SuggestedBoardLite | null
}

export interface AiModerationSuggestionItem {
  id: string
  postId: string
  suggestedBoardId: string | null
  suggestedTagIds: string[]
  reasoning: string | null
  modelKey: string | null
  status: string
  createdAt: string
  post: PostLite | null
  suggestedBoard: SuggestedBoardLite | null
  suggestedTags: SuggestedTagLite[]
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface ListResponse {
  code: number
  message?: string
  data?: {
    items: AiModerationSuggestionItem[]
    pagination: Pagination
  }
}

interface DecideResponse {
  code: number
  message?: string
  data?: { id: string; status: string }
}

export function AiReplyModerationPage() {
  const [items, setItems] = useState<AiModerationSuggestionItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [pendingAction, startTransition] = useTransition()
  const [page, setPage] = useState(1)

  const loadPage = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/apps/ai-reply/moderation/list?page=${targetPage}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as ListResponse
      if (json.code !== 0 || !json.data) {
        toast.error(json.message ?? "读取审核建议失败")
        return
      }
      setItems(json.data.items)
      setPagination(json.data.pagination)
    } catch (error) {
      console.error(error)
      toast.error("读取审核建议失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => loadPage(page))
  }, [page, loadPage])

  const decide = useCallback((id: string, action: "approve" | "reject") => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/apps/ai-reply/moderation/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        })
        const json = (await res.json()) as DecideResponse
        if (json.code !== 0) {
          toast.error(json.message ?? "操作失败")
          return
        }
        toast.success(action === "approve" ? "已采纳该建议" : "已驳回该建议")
        void loadPage(page)
      } catch (error) {
        console.error(error)
        toast.error("操作失败")
      }
    })
  }, [loadPage, page])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>AI 审核建议队列</CardTitle>
        <div className="text-sm text-muted-foreground">
          共 {pagination.total} 条待处理，第 {pagination.page} / {pagination.totalPages} 页
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pagination.totalPages > 1 ? (
          <AdminClientPaginationBar
            pagination={pagination}
            itemLabel="条待处理"
            loading={loading || pendingAction}
            onPageChange={setPage}
          />
        ) : null}
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">加载中…</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">暂无待审核的 AI 建议</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {item.post?.title ?? `帖子 ${item.postId}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      作者 {item.post?.author?.nickname ?? item.post?.author?.username ?? "-"} ·
                      {" "}创建于 {formatOptionalPreciseDateTime(item.post?.createdAt ?? null)}
                      {item.modelKey ? <> · 模型 <code className="rounded bg-muted px-1">{item.modelKey}</code></> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingAction}
                      onClick={() => decide(item.id, "reject")}
                    >
                      驳回
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={pendingAction}
                      onClick={() => decide(item.id, "approve")}
                    >
                      采纳
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">当前板块</div>
                    <div>{item.post?.board?.name ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">建议板块</div>
                    <div>
                      {item.suggestedBoard
                        ? <span className="font-medium text-emerald-600 dark:text-emerald-400">{item.suggestedBoard.name}</span>
                        : <span className="text-muted-foreground">（保持不变）</span>}
                    </div>
                  </div>
                </div>

                {item.suggestedTags.length > 0 ? (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">建议标签</div>
                    <div className="flex flex-wrap gap-1">
                      {item.suggestedTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.reasoning ? (
                  <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                    <div className="mb-1 font-medium text-foreground/80">理由</div>
                    <div className="whitespace-pre-wrap">{item.reasoning}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <AdminClientPaginationBar
            pagination={pagination}
            itemLabel="条待处理"
            loading={loading || pendingAction}
            className="border-t border-border pt-4"
            onPageChange={setPage}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
