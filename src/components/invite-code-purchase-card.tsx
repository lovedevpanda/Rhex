"use client"

import { useState } from "react"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { formatDateTime, formatNumber } from "@/lib/formatters"

const INVITE_CODE_PAGE_SIZE = 10

type PaginationToken = number | "ellipsis"

interface InviteCodePurchaseCardProps {
  enabled: boolean
  price: number
  priceDescription?: string
  pointName: string
}

interface InviteCodeHistoryPageData {
  items: Array<{
    id: string
    code: string
    createdAt: string
    usedAt: string | null
    usedByUsername: string | null
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

function buildPageTokens(page: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)

  const result: PaginationToken[] = []

  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? (result.at(-1) as number) : null

    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }

    result.push(current)
  }

  return result
}

export function InviteCodePurchaseCard({ enabled, price, priceDescription, pointName }: InviteCodePurchaseCardProps) {
  const [loading, setLoading] = useState(false)
  const [latestCode, setLatestCode] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [historyData, setHistoryData] = useState<InviteCodeHistoryPageData | null>(null)

  async function loadPurchasedInviteCodes(page = 1) {
    setHistoryLoading(true)
    setHistoryError("")

    try {
      const response = await fetch(`/api/invite-codes/mine?page=${page}&pageSize=${INVITE_CODE_PAGE_SIZE}`, {
        cache: "no-store",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setHistoryError(typeof result?.message === "string" ? result.message : "加载已购买邀请码失败")
        return
      }

      setHistoryData(result?.data ?? null)
    } catch {
      setHistoryError("加载已购买邀请码失败，请稍后重试")
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handlePurchase() {
    setLoading(true)
    setLatestCode("")

    try {
      const response = await fetch("/api/invite-codes/purchase", {
        method: "POST",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(typeof result?.message === "string" ? result.message : "邀请码购买失败", "购买失败")
        return
      }

      const code = typeof result?.data?.code === "string" ? result.data.code : ""
      setLatestCode(code)
      toast.success(typeof result?.message === "string" ? result.message : "邀请码购买成功", "购买成功")

      if (historyOpen) {
        void loadPurchasedInviteCodes(1)
      }
    } catch {
      toast.error("邀请码购买失败，请稍后重试", "购买失败")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenHistory() {
    setHistoryOpen(true)
    void loadPurchasedInviteCodes(1)
  }

  if (!enabled) {
    return null
  }

  return (
    <>
      <div className="space-y-3 rounded-[24px] border border-border px-4 py-4">
        <div>
          <p className="font-medium">购买邀请码</p>
          <p className="mt-1 text-sm text-muted-foreground">每个邀请码售价 {formatNumber(price)} {pointName}，购买后可分享给好友注册使用。</p>
          {priceDescription ? <p className="mt-1 text-xs text-muted-foreground">{priceDescription}</p> : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={handlePurchase} disabled={loading} className="rounded-full">
            {loading ? "购买中..." : `花费 ${formatNumber(price)} ${pointName} 购买邀请码`}
          </Button>
          <Button type="button" variant="outline" onClick={handleOpenHistory} disabled={historyLoading} className="rounded-full">
            {historyLoading && !historyOpen ? "加载中..." : "我购买的邀请码"}
          </Button>
        </div>

        {latestCode ? (
          <p className="text-sm">
            最新邀请码：<span className="font-mono font-semibold">{latestCode}</span>
          </p>
        ) : null}
      </div>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        size="lg"
        title="我购买的邀请码"
        description="分页查看你已购买的邀请码及当前使用情况。"
      >
        <div className="space-y-4">
          {historyData ? (
            <p className="text-xs text-muted-foreground">
              共 {formatNumber(historyData.pagination.total)} 个邀请码，第 {historyData.pagination.page} / {historyData.pagination.totalPages} 页
            </p>
          ) : null}

          {historyError ? (
            <div className="rounded-[18px] border border-dashed border-border px-4 py-5 text-sm">
              <p className="text-foreground">{historyError}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 rounded-full"
                onClick={() => void loadPurchasedInviteCodes(historyData?.pagination.page ?? 1)}
                disabled={historyLoading}
              >
                重新加载
              </Button>
            </div>
          ) : null}

          {!historyError && historyLoading && !historyData ? (
            <p className="rounded-[18px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">加载中...</p>
          ) : null}

          {!historyError && historyData && historyData.items.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">你还没有购买过邀请码。</p>
          ) : null}

          {!historyError && historyData && historyData.items.length > 0 ? (
            <div className="space-y-3">
              {historyData.items.map((item) => (
                <div key={item.id} className="rounded-[18px] border border-border bg-card px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-semibold tracking-[0.16em]">{item.code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">购买于 {formatDateTime(item.createdAt)}</p>
                    </div>
                    <span className={item.usedByUsername ? "rounded-full bg-secondary px-3 py-1 text-xs text-foreground" : "rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground"}>
                      {item.usedByUsername ? "已使用" : "未使用"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>使用用户：{item.usedByUsername ? `@${item.usedByUsername}` : "暂无"}</p>
                    <p>使用时间：{item.usedAt ? formatDateTime(item.usedAt) : "未使用"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <InviteCodeHistoryPagination
            pagination={historyData?.pagination ?? null}
            loading={historyLoading}
            onChange={(page) => { void loadPurchasedInviteCodes(page) }}
          />
        </div>
      </Modal>
    </>
  )
}

function InviteCodeHistoryPagination({
  pagination,
  loading,
  onChange,
}: {
  pagination: InviteCodeHistoryPageData["pagination"] | null
  loading: boolean
  onChange: (page: number) => void
}) {
  if (!pagination || pagination.totalPages <= 1) {
    return null
  }

  const tokens = buildPageTokens(pagination.page, pagination.totalPages)

  return (
    <div className="flex flex-col items-center gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={!pagination.hasPrevPage || loading}
          onClick={() => onChange(pagination.page - 1)}
        >
          上一页
        </Button>
        {tokens.map((token, index) => token === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">...</span>
        ) : (
          <Button
            key={token}
            type="button"
            variant={token === pagination.page ? "default" : "outline"}
            className="min-w-10 rounded-full px-3"
            disabled={loading}
            onClick={() => onChange(token)}
          >
            {token}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={!pagination.hasNextPage || loading}
          onClick={() => onChange(pagination.page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  )
}
