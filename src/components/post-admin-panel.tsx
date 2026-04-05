"use client"

import { useMemo, useState, useTransition } from "react"

import { AdminModal } from "@/components/admin-modal"
import { BoardSelectField, type BoardSelectGroup } from "@/components/board-select-field"
import { Button } from "@/components/ui/button"

interface PostAdminPanelProps {
  postId: string
  postSlug: string
  currentBoardSlug: string
  actorRole: "ADMIN" | "MODERATOR"
  allowedPinScopes: Array<"NONE" | "BOARD" | "ZONE" | "GLOBAL">
  postAuthorId: number
  postAuthorUsername: string
  postAuthorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  postStatus?: string
  isPinned: boolean
  pinScope?: string | null
  isFeatured: boolean
  boardOptions: BoardSelectGroup[]
}

interface AdminQuickAction {
  action: string
  targetId: string
  label: string
  tone?: "danger"
  extra?: Record<string, unknown>
}

export function PostAdminPanel({
  postId,
  postSlug,
  currentBoardSlug,
  actorRole,
  allowedPinScopes,
  postAuthorId,
  postAuthorUsername,
  postAuthorStatus,
  postStatus,
  isPinned,
  
  isFeatured,
  boardOptions,
}: PostAdminPanelProps) {
  const [feedback, setFeedback] = useState("")
  const [moveBoardSlug, setMoveBoardSlug] = useState(currentBoardSlug)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [pendingAction, startTransition] = useTransition()

  const currentBoardLabel = useMemo(() => {
    for (const group of boardOptions) {
      const board = group.items.find((item) => item.value === currentBoardSlug)
      if (board) {
        return `${group.zone} / ${board.label}`
      }
    }

    return currentBoardSlug
  }, [boardOptions, currentBoardSlug])

  const selectedMoveBoardLabel = useMemo(() => {
    for (const group of boardOptions) {
      const board = group.items.find((item) => item.value === moveBoardSlug)
      if (board) {
        return `${group.zone} / ${board.label}`
      }
    }

    return moveBoardSlug
  }, [boardOptions, moveBoardSlug])

  async function runAction(action: string, targetId: string, extra?: Record<string, unknown>) {
    setFeedback("")

    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId, postId, ...extra }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "操作成功" : "操作失败"))
      if (response.ok) {
        if (action === "post.moveBoard") {
          const nextPostId = typeof result.data?.id === "string" && result.data.id ? result.data.id : postId
          window.location.href = `/posts/${nextPostId}`
          return
        }
        window.location.reload()
      }
    })
  }

  function openEditPage() {
    window.location.href = `/write?mode=edit&post=${encodeURIComponent(postSlug)}`
  }

  function openMoveDialog() {
    setMoveBoardSlug(currentBoardSlug)
    setFeedback("")
    setMoveDialogOpen(true)
  }

  function confirmMoveBoard() {
    if (!moveBoardSlug) {
      setFeedback("请选择目标节点")
      return
    }

    if (moveBoardSlug === currentBoardSlug) {
      setFeedback("帖子已在当前节点，无需移动")
      setMoveDialogOpen(false)
      return
    }

    setMoveDialogOpen(false)
    void runAction("post.moveBoard", postId, { boardSlug: moveBoardSlug })
  }

  const canEditPostContent = actorRole === "ADMIN"
  const userActions: AdminQuickAction[] = postAuthorStatus === "BANNED"
    ? (actorRole === "ADMIN" ? [{ action: "user.activate", targetId: String(postAuthorId), label: "解除封禁" }] : [])
    : postAuthorStatus === "MUTED"
      ? [
          { action: "user.activate", targetId: String(postAuthorId), label: "解除禁言" },
          ...(actorRole === "ADMIN" ? [{ action: "user.ban", targetId: String(postAuthorId), label: "封禁此用户", tone: "danger" as const }] : []),
        ]
      : [
          { action: "user.mute", targetId: String(postAuthorId), label: "禁言此用户" },
          ...(actorRole === "ADMIN" ? [{ action: "user.ban", targetId: String(postAuthorId), label: "封禁此用户", tone: "danger" as const }] : []),
        ]

  const pinActions: AdminQuickAction[] = isPinned
    ? (allowedPinScopes.includes("NONE")
      ? [{ action: "post.pin", targetId: postId, label: "取消置顶", extra: { scope: "NONE" } }]
      : [])
    : allowedPinScopes
        .filter((scope) => scope !== "NONE")
        .map((scope) => ({
          action: "post.pin",
          targetId: postId,
          label: scope === "GLOBAL" ? "全局置顶" : scope === "ZONE" ? "分区置顶" : "节点置顶",
          extra: { scope },
        }))

  const postVisibilityAction: AdminQuickAction = postStatus === "OFFLINE"
    ? { action: "post.show", targetId: postId, label: "上线帖子" }
    : { action: "post.hide", targetId: postId, label: "下线帖子", tone: "danger" as const }

  const actions: AdminQuickAction[] = [
    ...pinActions,
    { action: "post.feature", targetId: postId, label: isFeatured ? "取消精华" : "设为精华" },
    ...userActions,
    postVisibilityAction,
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
        {canEditPostContent ? (
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={openEditPage} disabled={pendingAction}>
            编辑帖子
          </Button>
        ) : null}
        <Button variant="outline" className="h-8 px-3 text-xs" onClick={openMoveDialog} disabled={pendingAction}>
          移动节点
        </Button>
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

      <AdminModal
        open={moveDialogOpen}
        title="移动帖子节点"
        description="选择目标节点后确认，帖子会整体迁移到新的节点。"
        onClose={() => setMoveDialogOpen(false)}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" className="h-9 px-4 text-sm" onClick={() => setMoveDialogOpen(false)} disabled={pendingAction}>
              取消
            </Button>
            <Button type="button" className="h-9 px-4 text-sm" onClick={confirmMoveBoard} disabled={pendingAction || !moveBoardSlug}>
              确定移动
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-[18px] border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            <p>当前节点：{currentBoardLabel || "未知节点"}</p>
            <p className="mt-1">目标节点：{selectedMoveBoardLabel || "请选择目标节点"}</p>
          </div>
          <BoardSelectField
            value={moveBoardSlug}
            onChange={setMoveBoardSlug}
            boardOptions={boardOptions}
            disabled={pendingAction}
            title="选择目标节点"
            description="支持按分区、节点名或 slug 搜索，确认后帖子将移动到所选节点。"
          />
        </div>
      </AdminModal>
    </div>
  )
}
