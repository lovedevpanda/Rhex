"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { AdminModal } from "@/components/admin-modal"
import { BoardSelectField, type BoardSelectGroup } from "@/components/board-select-field"
import { Button } from "@/components/ui/button"

interface AdminPostMoveBoardButtonProps {
  postId: string
  postTitle: string
  currentBoardSlug: string
  boardOptions: BoardSelectGroup[]
  className?: string
}

export function AdminPostMoveBoardButton({
  postId,
  postTitle,
  currentBoardSlug,
  boardOptions,
  className,
}: AdminPostMoveBoardButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedBoardSlug, setSelectedBoardSlug] = useState(currentBoardSlug)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const currentBoardLabel = useMemo(() => {
    for (const group of boardOptions) {
      const board = group.items.find((item) => item.value === currentBoardSlug)
      if (board) {
        return `${group.zone} / ${board.label}`
      }
    }

    return currentBoardSlug
  }, [boardOptions, currentBoardSlug])

  const targetBoardLabel = useMemo(() => {
    for (const group of boardOptions) {
      const board = group.items.find((item) => item.value === selectedBoardSlug)
      if (board) {
        return `${group.zone} / ${board.label}`
      }
    }

    return selectedBoardSlug
  }, [boardOptions, selectedBoardSlug])

  function openDialog() {
    setSelectedBoardSlug(currentBoardSlug)
    setFeedback("")
    setOpen(true)
  }

  function submitMove() {
    if (!selectedBoardSlug) {
      setFeedback("请选择目标节点")
      return
    }

    if (selectedBoardSlug === currentBoardSlug) {
      setFeedback("帖子已在当前节点，无需移动")
      return
    }

    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "post.moveBoard",
          targetId: postId,
          boardSlug: selectedBoardSlug,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        setFeedback(result.message ?? "移动帖子失败")
        return
      }

      setOpen(false)
      setFeedback("")
      router.refresh()
    })
  }

  return (
    <>
      <Button type="button" variant="outline" className={className ?? "h-7 rounded-full px-2.5 text-xs"} onClick={openDialog} disabled={isPending}>
        {isPending ? "移动中..." : "移动节点"}
      </Button>

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="移动帖子到指定节点"
        description={`帖子：${postTitle}`}
        footer={(
          <div className="flex items-center gap-2">
            <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={submitMove}>
              {isPending ? "移动中..." : "确认移动"}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-[18px] border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            <p>当前节点：{currentBoardLabel || "未知节点"}</p>
            <p className="mt-1">目标节点：{targetBoardLabel || "请选择目标节点"}</p>
          </div>
          <BoardSelectField
            value={selectedBoardSlug}
            onChange={setSelectedBoardSlug}
            boardOptions={boardOptions}
            disabled={isPending}
            title="选择目标节点"
            description="支持按分区、节点名或 slug 搜索，确认后帖子会迁移到新的节点。"
          />
          {feedback ? <p className="text-xs text-red-500">{feedback}</p> : null}
        </div>
      </AdminModal>
    </>
  )
}
