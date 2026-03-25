"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"

interface PostEditPanelProps {
  postId: string
  postSlug: string
  editableUntil?: string | null
  lastAppendedAt?: string | null
  appendixCount?: number
}

const APPEND_INTERVAL_MINUTES = 60

export function PostEditPanel({ postId, postSlug, editableUntil, lastAppendedAt, appendixCount = 0 }: PostEditPanelProps) {
  const [appendText, setAppendText] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const canEditOriginal = useMemo(() => (editableUntil ? new Date(editableUntil).getTime() > Date.now() : false), [editableUntil])
  const nextAppendAt = useMemo(() => {
    if (!lastAppendedAt) {
      return null
    }

    return new Date(new Date(lastAppendedAt).getTime() + APPEND_INTERVAL_MINUTES * 60 * 1000)
  }, [lastAppendedAt])
  const appendCooldownMinutes = useMemo(() => {
    if (!nextAppendAt) {
      return 0
    }

    return Math.max(0, Math.ceil((nextAppendAt.getTime() - Date.now()) / (60 * 1000)))
  }, [nextAppendAt])
  const canAppendNow = appendCooldownMinutes === 0

  async function handleAppend() {
    if (!appendText.trim()) {
      setMessage("正文不能为空")
      return
    }

    setLoading(true)
    setMessage("")

    const response = await fetch("/api/posts/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postId,
        appendedContent: appendText,
      }),
    })

    const result = await response.json()
    setLoading(false)
    setMessage(result.message ?? (response.ok ? "追加成功" : "追加失败"))

    if (response.ok) {
      setAppendText("")
      setModalOpen(false)
      window.location.reload()
    }
  }

  return (
    <>
      <div className="rounded-[24px] border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">作者操作</h3>
            <p className="text-sm text-muted-foreground">
              {canEditOriginal ? "发帖后 10 分钟内可跳转到编辑页修改标题和正文。" : "10 分钟后正文锁定，可通过弹窗追加附言。"}
            </p>
            <p className="text-xs text-muted-foreground">
              已追加 {appendixCount} 条附言{!canEditOriginal ? `，每次追加需间隔 ${APPEND_INTERVAL_MINUTES} 分钟` : ""}。
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!canEditOriginal ? (
              <Button type="button" variant="outline" onClick={() => setModalOpen(true)}>
                追加附言
              </Button>
            ) : null}
            {canEditOriginal ? (
              <Link href={`/write?mode=edit&post=${postSlug}`}>
                <Button type="button" variant="outline">编辑帖子</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[28px] border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <h4 className="text-lg font-semibold">追加附言</h4>
                <p className="mt-1 text-sm text-muted-foreground">只需填写正文内容，发布后会显示为新的附言。</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                关闭
              </Button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {!canAppendNow ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  距离下一次追加还需等待 {appendCooldownMinutes} 分钟。
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-sm font-medium">正文</p>
                <textarea
                  value={appendText}
                  onChange={(event) => setAppendText(event.target.value)}
                  placeholder="写下新的进展、修正、结论或补充说明…"
                  className="min-h-[220px] w-full rounded-[20px] border border-border bg-card px-4 py-3 text-sm outline-none"
                  disabled={!canAppendNow || loading}
                />
              </div>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={loading}>取消</Button>
              <Button type="button" onClick={handleAppend} disabled={loading || !canAppendNow}>
                {loading ? "提交中..." : `发布第 ${appendixCount + 1} 条附言`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
