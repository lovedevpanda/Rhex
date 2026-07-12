"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { formatCompactPointValue, formatDateTime, formatNumber } from "@/lib/formatters"

const INVITE_CODE_PAGE_SIZE = 10
const MAX_PURCHASE_COUNT = 10

type PaginationToken = number | "ellipsis"
type InviteCodeUsageFilter = "all" | "unused" | "used"

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
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [latestBalance, setLatestBalance] = useState<number | null>(null)
  const [latestCodes, setLatestCodes] = useState<string[]>([])
  const [purchaseCount, setPurchaseCount] = useState(1)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [historyData, setHistoryData] = useState<InviteCodeHistoryPageData | null>(null)
  const [historyFilter, setHistoryFilter] = useState<InviteCodeUsageFilter>("all")
  const [exportingUnused, setExportingUnused] = useState(false)

  async function loadPurchasedInviteCodes(page = 1, status: InviteCodeUsageFilter = historyFilter) {
    setHistoryLoading(true)
    setHistoryError("")

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(INVITE_CODE_PAGE_SIZE),
        status,
      })
      const response = await fetch(`/api/invite-codes/mine?${params.toString()}`, {
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
    const count = Math.max(1, Math.min(Math.trunc(purchaseCount), MAX_PURCHASE_COUNT))
    setLoading(true)
    setLatestCodes([])

    try {
      const response = await fetch("/api/invite-codes/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ count }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(typeof result?.message === "string" ? result.message : "邀请码购买失败", "购买失败")
        return
      }

      const code = typeof result?.data?.code === "string" ? result.data.code : ""
      const codes = Array.isArray(result?.data?.codes)
        ? result.data.codes.filter((item: unknown): item is string => typeof item === "string")
        : code
          ? [code]
          : []
      setLatestCodes(codes)
      setLatestBalance(typeof result?.data?.balance === "number" ? result.data.balance : null)
      toast.success(typeof result?.message === "string" ? result.message : "邀请码购买成功", "购买成功")
      router.refresh()

      if (historyOpen) {
        void loadPurchasedInviteCodes(1, historyFilter)
      }
    } catch {
      toast.error("邀请码购买失败，请稍后重试", "购买失败")
    } finally {
      setLoading(false)
    }
  }

  function handlePurchaseCountChange(value: string) {
    const nextCount = Number(value)
    if (!Number.isFinite(nextCount)) {
      setPurchaseCount(1)
      return
    }

    setPurchaseCount(Math.max(1, Math.min(Math.trunc(nextCount), MAX_PURCHASE_COUNT)))
  }

  function handleOpenHistory() {
    setHistoryOpen(true)
    void loadPurchasedInviteCodes(1, historyFilter)
  }

  function handleChangeHistoryFilter(nextFilter: InviteCodeUsageFilter) {
    setHistoryFilter(nextFilter)
    setHistoryData(null)
    void loadPurchasedInviteCodes(1, nextFilter)
  }

  function copyTextWithFallback(value: string) {
    const textArea = document.createElement("textarea")
    textArea.value = value
    textArea.setAttribute("readonly", "readonly")
    textArea.style.position = "fixed"
    textArea.style.left = "-9999px"
    textArea.style.top = "0"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      return document.execCommand("copy")
    } finally {
      textArea.remove()
    }
  }

  async function handleCopyInviteCode(code: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else if (!copyTextWithFallback(code)) {
        throw new Error("fallback copy failed")
      }

      toast.success("邀请码已复制", "复制成功")
    } catch {
      if (copyTextWithFallback(code)) {
        toast.success("邀请码已复制", "复制成功")
        return
      }

      toast.error(`复制失败，请手动复制：${code}`, "复制失败")
    }
  }

  async function handleExportUnusedInviteCodes() {
    setExportingUnused(true)

    try {
      const firstParams = new URLSearchParams({
        page: "1",
        pageSize: "1000",
        status: "unused",
      })
      const firstResponse = await fetch(`/api/invite-codes/mine?${firstParams.toString()}`, {
        cache: "no-store",
      })
      const firstResult = await firstResponse.json().catch(() => null)

      if (!firstResponse.ok) {
        toast.error(typeof firstResult?.message === "string" ? firstResult.message : "导出邀请码失败", "导出失败")
        return
      }

      const firstData = firstResult?.data as InviteCodeHistoryPageData | null
      const totalPages = Math.max(1, Number(firstData?.pagination?.totalPages ?? 1))
      const codes = new Set<string>((firstData?.items ?? []).map((item) => item.code))

      for (let page = 2; page <= totalPages; page += 1) {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "1000",
          status: "unused",
        })
        const response = await fetch(`/api/invite-codes/mine?${params.toString()}`, {
          cache: "no-store",
        })
        const result = await response.json().catch(() => null)

        if (!response.ok) {
          toast.error(typeof result?.message === "string" ? result.message : "导出邀请码失败", "导出失败")
          return
        }

        const data = result?.data as InviteCodeHistoryPageData | null
        for (const item of data?.items ?? []) {
          codes.add(item.code)
        }
      }

      if (codes.size === 0) {
        toast.info("当前没有未使用的邀请码可导出", "无需导出")
        return
      }

      const blob = new Blob([[...codes].join("\n")], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "unused-invite-codes.txt"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(`已导出 ${formatNumber(codes.size)} 个未使用邀请码`, "导出成功")
    } catch {
      toast.error("导出邀请码失败，请稍后重试", "导出失败")
    } finally {
      setExportingUnused(false)
    }
  }

  if (!enabled) {
    return null
  }

  return (
    <>
      <div className="space-y-3 rounded-xl border border-border px-4 py-4">
        <div>
          <p className="font-medium">购买邀请码</p>
          <p className="mt-1 text-sm text-muted-foreground">每个邀请码售价 {formatCompactPointValue(price)} {pointName}，购买后可分享给好友注册使用。</p>
          <p className="mt-1 text-xs text-muted-foreground">一次最多购买10个邀请码，最多持有100个未使用邀请码。</p>
          {priceDescription ? <p className="mt-1 text-xs text-muted-foreground">{priceDescription}</p> : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">购买数量</span>
            <input
              type="number"
              min={1}
              max={MAX_PURCHASE_COUNT}
              value={purchaseCount}
              onChange={(event) => handlePurchaseCountChange(event.target.value)}
              className="h-10 w-28 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-foreground"
              disabled={loading}
            />
          </label>
          <Button type="button" onClick={handlePurchase} disabled={loading} className="rounded-full">
            {loading
              ? "购买中..."
              : `花费 ${formatCompactPointValue(price * purchaseCount)} ${pointName} 购买 ${purchaseCount} 个邀请码`}
          </Button>
          <Button type="button" variant="outline" onClick={handleOpenHistory} disabled={historyLoading} className="rounded-full">
            {historyLoading && !historyOpen ? "加载中..." : "我购买的邀请码"}
          </Button>
        </div>

        {latestCodes.length > 0 ? (
          <div className="space-y-2 text-sm">
            <p>最新邀请码：</p>
            <div className="flex flex-wrap gap-2">
              {latestCodes.map((code) => (
                <span key={code} className="rounded-full bg-secondary px-3 py-1 font-mono font-semibold">
                  {code}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {latestBalance !== null ? (
          <p className="text-sm text-muted-foreground">当前余额已更新为 <span className="font-semibold text-foreground">{formatCompactPointValue(latestBalance)}</span> {pointName}</p>
        ) : null}
      </div>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        size="lg"
        title="我购买的邀请码"
        hideHeaderCloseButtonOnMobile
        description="查看你已购买的邀请码及当前使用情况。"
      >
        <div className="space-y-4">
          {historyData ? (
            <p className="text-xs text-muted-foreground">
              共 {formatNumber(historyData.pagination.total)} 个邀请码，第 {historyData.pagination.page} / {historyData.pagination.totalPages} 页
            </p>
          ) : null}

          <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-secondary/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <InviteCodeFilterButton active={historyFilter === "all"} disabled={historyLoading} onClick={() => handleChangeHistoryFilter("all")}>全部</InviteCodeFilterButton>
              <InviteCodeFilterButton active={historyFilter === "unused"} disabled={historyLoading} onClick={() => handleChangeHistoryFilter("unused")}>未使用</InviteCodeFilterButton>
              <InviteCodeFilterButton active={historyFilter === "used"} disabled={historyLoading} onClick={() => handleChangeHistoryFilter("used")}>已使用</InviteCodeFilterButton>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={handleExportUnusedInviteCodes}
              disabled={exportingUnused}
            >
              {exportingUnused ? "导出中..." : "导出未使用邀请码"}
            </Button>
          </div>

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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-base font-semibold tracking-[0.16em]">{item.code}</p>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 rounded-full px-3 text-xs"
                          onClick={() => void handleCopyInviteCode(item.code)}
                        >
                          复制
                        </Button>
                      </div>
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
            onChange={(page) => { void loadPurchasedInviteCodes(page, historyFilter) }}
          />

          <div className="border-t border-border pt-4 sm:hidden">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setHistoryOpen(false)}
            >
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function InviteCodeFilterButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className="rounded-full"
      disabled={disabled || active}
      onClick={onClick}
    >
      {children}
    </Button>
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
