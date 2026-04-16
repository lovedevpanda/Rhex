"use client"

import { Download, FileArchive, Link2, Loader2, Lock, Paperclip } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { toast } from "@/components/ui/toast"

function formatFileSize(fileSize: number | null | undefined) {
  if (!fileSize || fileSize <= 0) {
    return "未知大小"
  }

  if (fileSize >= 1024 * 1024 * 1024) {
    return `${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
  }

  return `${Math.max(1, Math.round(fileSize / 1024))} KB`
}

function getRequirementTextClassName(label: string) {
  if (label === "公开下载") {
    return "text-emerald-600 dark:text-emerald-300"
  }

  if (label.startsWith("VIP")) {
    return "text-fuchsia-600 dark:text-fuchsia-300"
  }

  if (label.startsWith("Lv.")) {
    return "text-sky-600 dark:text-sky-300"
  }

  if (label.includes("积分")) {
    return "text-amber-600 dark:text-amber-300"
  }

  if (label.includes("回复")) {
    return "text-violet-600 dark:text-violet-300"
  }

  return "text-foreground/75"
}

interface PostAttachmentListItem {
  id: string
  sourceType: "UPLOAD" | "EXTERNAL_LINK"
  name: string
  fileExt?: string | null
  fileSize?: number | null
  downloadCount: number
  pointsCost: number
  requirementLabels: string[]
  canDownload: boolean
  canPurchase: boolean
  hasPurchasedAccess: boolean
  replyRequirementSatisfied?: boolean
  blockedReason: string
}

interface RevealedExternalAttachment {
  id: string
  name: string
  externalUrl: string
  externalCode?: string | null
}

function getAttachmentStatusText(attachment: PostAttachmentListItem) {
  if (attachment.pointsCost > 0 && attachment.hasPurchasedAccess) {
    return "已购买"
  }

  if (attachment.replyRequirementSatisfied) {
    return "已回复"
  }

  if (attachment.canDownload) {
    return "可下载"
  }

  return ""
}

export function PostAttachmentList({ attachments, pointName }: { attachments: PostAttachmentListItem[]; pointName: string }) {
  const [items, setItems] = useState(attachments)
  const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null)
  const [revealedAttachment, setRevealedAttachment] = useState<RevealedExternalAttachment | null>(null)

  async function handlePurchase(attachment: PostAttachmentListItem) {
    if (!attachment.canPurchase) {
      return
    }

    setPendingAttachmentId(attachment.id)

    try {
      const response = await fetch("/api/post-attachments/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ attachmentId: attachment.id }),
      })
      const result = await response.json().catch(() => null) as { message?: string; code?: number } | null

      if (!response.ok || result?.code !== 0) {
        throw new Error(result?.message ?? "购买失败")
      }

      setItems((current) => current.map((item) => item.id === attachment.id
        ? {
            ...item,
            canDownload: true,
            canPurchase: false,
            hasPurchasedAccess: true,
            blockedReason: "",
          }
        : item))
      toast.success(result?.message ?? "购买成功", "购买成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "购买失败", "购买失败")
    } finally {
      setPendingAttachmentId(null)
    }
  }

  async function handleRevealExternalAttachment(attachment: PostAttachmentListItem) {
    if (!attachment.canDownload) {
      return
    }

    setPendingAttachmentId(attachment.id)

    try {
      const response = await fetch("/api/post-attachments/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ attachmentId: attachment.id }),
      })
      const result = await response.json().catch(() => null) as {
        code?: number
        message?: string
        data?: {
          attachment?: {
            id: string
            name: string
            externalUrl: string
            externalCode?: string | null
            downloadCount?: number
          }
        }
      } | null

      if (!response.ok || result?.code !== 0 || !result.data?.attachment?.externalUrl) {
        throw new Error(result?.message ?? "获取网盘信息失败")
      }

      setItems((current) => current.map((item) => item.id === attachment.id
        ? {
            ...item,
            downloadCount: typeof result.data?.attachment?.downloadCount === "number" ? result.data.attachment.downloadCount : item.downloadCount,
          }
        : item))
      setRevealedAttachment(result.data.attachment)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取网盘信息失败", "获取失败")
    } finally {
      setPendingAttachmentId(null)
    }
  }

  function handleDirectDownload(attachmentId: string) {
    if (typeof window === "undefined") {
      return
    }

    window.location.assign(`/api/post-attachments/download?attachmentId=${encodeURIComponent(attachmentId)}`)
  }

  async function handleCopy(text: string, successTitle: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(successTitle, "复制成功")
    } catch {
      toast.error("复制失败，请手动复制", "复制失败")
    }
  }

  return (
    <>
      <div className="mt-8 rounded-[24px]  bg-card/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">附件列表</h3>
            </div>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">共 {items.length} 项</span>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((attachment) => {
            const isPending = pendingAttachmentId === attachment.id
            const statusText = getAttachmentStatusText(attachment)
            const displayedRequirementLabels = attachment.replyRequirementSatisfied
              ? attachment.requirementLabels.filter((label) => label !== "回复可下")
              : attachment.requirementLabels

            return (
              <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border bg-background px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex min-w-0 items-center gap-2 sm:min-w-0 sm:flex-1 sm:basis-0">
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                      {attachment.sourceType === "UPLOAD" ? <FileArchive className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                      {attachment.sourceType === "UPLOAD" ? "站内附件" : "网盘附件"}
                    </span>
                    <p title={attachment.name} className="min-w-0 flex-1 truncate text-sm font-medium">{attachment.name}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs text-muted-foreground">
                      {attachment.fileExt ? attachment.fileExt.toUpperCase() : "FILE"}
                      {attachment.fileSize ? ` · ${formatFileSize(attachment.fileSize)}` : ""}
                      {` · 下载 ${attachment.downloadCount}`}
                      {statusText ? ` · ${statusText}` : ""}
                    </span>
                    <span className="text-[11px] font-medium">
                      {displayedRequirementLabels.map((label, index) => (
                        <span key={`${attachment.id}-${label}`} className={getRequirementTextClassName(label)}>
                          {index > 0 ? <span className="mx-1 text-muted-foreground/55">|</span> : null}
                          {label}
                        </span>
                      ))}
                    </span>
                    </div>
                    {!attachment.canDownload && attachment.blockedReason ? (
                      <div className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <Lock className="h-3.5 w-3.5" />
                        <span>{attachment.blockedReason}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {attachment.canDownload ? (
                    attachment.sourceType === "UPLOAD" ? (
                      <Button type="button" className="h-9 px-4 text-xs" onClick={() => handleDirectDownload(attachment.id)}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        下载
                      </Button>
                    ) : (
                      <Button type="button" className="h-9 px-4 text-xs" onClick={() => void handleRevealExternalAttachment(attachment)} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                        查看链接
                      </Button>
                    )
                  ) : attachment.canPurchase ? (
                    <Button type="button" className="h-9 px-4 text-xs" onClick={() => void handlePurchase(attachment)} disabled={isPending}>
                      {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                      支付 {attachment.pointsCost} {pointName}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" className="h-9 px-4 text-xs" disabled>
                      暂不可下载
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={Boolean(revealedAttachment)}
        onClose={() => setRevealedAttachment(null)}
        size="md"
        hideHeaderCloseButtonOnMobile
        title={revealedAttachment?.name ?? "网盘附件"}
        description="当前附件为第三方网盘链接，已在本地完成权限校验。请按下方信息前往下载。"
        footer={(
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setRevealedAttachment(null)}>关闭</Button>
          </div>
        )}
      >
        {revealedAttachment ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">网盘链接</p>
              <div className="rounded-[18px] border border-border bg-card px-4 py-3 text-sm break-all">{revealedAttachment.externalUrl}</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => void handleCopy(revealedAttachment.externalUrl, "网盘链接已复制")}>复制链接</Button>
                <Button type="button" className="h-9 px-3 text-xs" onClick={() => window.open(revealedAttachment.externalUrl, "_blank", "noopener,noreferrer")}>打开链接</Button>
              </div>
            </div>

            {revealedAttachment.externalCode ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">提取码</p>
                <div className="rounded-[18px] border border-border bg-card px-4 py-3 text-sm">{revealedAttachment.externalCode}</div>
                <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => void handleCopy(revealedAttachment.externalCode ?? "", "提取码已复制")}>复制提取码</Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  )
}
