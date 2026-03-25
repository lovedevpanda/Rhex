"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

interface PostAdminPanelProps {
  postId: string
  postAuthorId: number
  postAuthorUsername: string
  postAuthorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  isPinned: boolean
  pinScope?: string | null
  isFeatured: boolean
}

interface AdminQuickAction {
  action: string
  targetId: string
  label: string
  tone?: "danger"
  extra?: Record<string, unknown>
}

export function PostAdminPanel({ postId, postAuthorId, postAuthorUsername, postAuthorStatus, isPinned, pinScope, isFeatured }: PostAdminPanelProps) {
  const [feedback, setFeedback] = useState("")
  const [pendingAction, startTransition] = useTransition()

  async function runAction(action: string, targetId: string, extra?: Record<string, unknown>) {
    setFeedback("")

    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId, ...extra }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "操作成功" : "操作失败"))
      if (response.ok) {
        window.location.reload()
      }
    })
  }

  const userActions: AdminQuickAction[] = postAuthorStatus === "BANNED"
    ? [{ action: "user.activate", targetId: String(postAuthorId), label: "解除封禁" }]
    : postAuthorStatus === "MUTED"
      ? [
          { action: "user.activate", targetId: String(postAuthorId), label: "解除禁言" },
          { action: "user.ban", targetId: String(postAuthorId), label: "封禁此用户", tone: "danger" as const },
        ]
      : [
          { action: "user.mute", targetId: String(postAuthorId), label: "禁言此用户" },
          { action: "user.ban", targetId: String(postAuthorId), label: "封禁此用户", tone: "danger" as const },
        ]

  const actions: AdminQuickAction[] = [
    { action: "post.pin", targetId: postId, label: pinScope === "GLOBAL" ? "已设全局置顶" : "全局置顶", extra: { scope: "GLOBAL" } },
    { action: "post.pin", targetId: postId, label: pinScope === "ZONE" ? "已设分区置顶" : "分区置顶", extra: { scope: "ZONE" } },
    { action: "post.pin", targetId: postId, label: pinScope === "BOARD" ? "已设节点置顶" : "节点置顶", extra: { scope: "BOARD" } },
    { action: "post.pin", targetId: postId, label: isPinned ? "取消置顶" : "取消置顶", extra: { scope: "NONE" } },
    { action: "post.feature", targetId: postId, label: isFeatured ? "取消精华" : "设为精华" },
    ...userActions,
    { action: "post.hide", targetId: postId, label: "下线帖子", tone: "danger" as const },
  ]

  return (
    <div className="rounded-[24px] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">管理员快捷操作</h3>
          <p className="mt-1 text-xs text-muted-foreground">目标用户 @{postAuthorUsername}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((item) => (
          <Button
            key={`${item.action}-${item.label}`}
            variant="outline"
            className={item.tone === "danger" ? "h-8 border-red-200 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" : "h-8 px-3 text-xs"}
            onClick={() => runAction(item.action, item.targetId, item.extra)}
            disabled={pendingAction}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {feedback ? <p className="mt-2 text-xs text-muted-foreground">{feedback}</p> : null}
    </div>
  )
}
