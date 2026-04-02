"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

interface CommentFormProps {
  postId: string
  commentId?: string
  initialContent?: string
  mode?: "create" | "edit"
  editWindowMinutes?: number
  parentId?: string
  replyToUserName?: string
  compact?: boolean
  onCancel?: () => void
  disabledMessage?: string | null
  commentsVisibleToAuthorOnly?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
}

export function CommentForm({ postId, commentId, initialContent = "", mode = "create", editWindowMinutes = 5, parentId, replyToUserName, compact = false, onCancel, disabledMessage, commentsVisibleToAuthorOnly = false, markdownEmojiMap }: CommentFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(mode === "edit" || !compact)

  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  useEffect(() => {
    if (replyToUserName && mode === "create") {
      setExpanded(true)
      setContent((current) => {
        const prefix = `@${replyToUserName} `
        if (current.startsWith(prefix)) {
          return current
        }

        return `${prefix}${current}`.trimStart()
      })
    }
  }, [mode, replyToUserName])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    const response = await fetch(mode === "edit" ? "/api/comments/update" : "/api/comments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mode === "edit" ? { postId, commentId, content } : { postId, content, parentId, replyToUserName }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? (mode === "edit" ? "评论编辑失败" : "评论失败")
      setMessage(errorMessage)
      toast.error(errorMessage, mode === "edit" ? "编辑失败" : parentId ? "回复失败" : "评论失败")
      setLoading(false)
      return
    }

    if (mode !== "edit") {
      setContent("")
    }

    const successMessage = mode === "edit" ? "评论修改成功" : parentId ? "回复提交成功" : "评论提交成功"
    const navigation = result.data?.navigation as { page?: number; sort?: string; anchor?: string } | undefined
    const nextSearchParams = new URLSearchParams(searchParams.toString())

    if (navigation?.page) {
      nextSearchParams.set("page", String(navigation.page))
    }
    if (navigation?.sort) {
      nextSearchParams.set("sort", navigation.sort)
    }

    const nextUrl = navigation
      ? `${pathname}?${nextSearchParams.toString()}${navigation.anchor ? `#${navigation.anchor}` : "#comments"}`
      : null

    setMessage(successMessage)
    toast.success(successMessage, mode === "edit" ? "编辑成功" : parentId ? "回复成功" : "评论成功")
    setExpanded(!compact)
    setLoading(false)

    if (mode === "edit") {
      onCancel?.()
      router.refresh()
      return
    }

    onCancel?.()

    if (nextUrl) {
      router.replace(nextUrl)
      router.refresh()
      return
    }

    router.refresh()
  }

  if (compact && !expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="text-sm text-primary transition-opacity hover:opacity-80" disabled={Boolean(disabledMessage)}>
        回复
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "min-w-0 w-full space-y-3 rounded-[18px] border border-border bg-card p-4" : "min-w-0 w-full space-y-4"}>
      {disabledMessage ? <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{disabledMessage}</div> : null}
      <RefinedRichPostEditor
        value={content}
        onChange={setContent}
        disabled={Boolean(disabledMessage)}
        minHeight={compact ? 120 : 180}
        uploadFolder="comments"
        markdownEmojiMap={markdownEmojiMap}
        placeholder={mode === "edit" ? `修改评论内容…可在 ${editWindowMinutes} 分钟内编辑` : replyToUserName ? `回复 @${replyToUserName}…` : "写下你的回复…支持 @用户名 提及"}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : <span className="text-xs text-muted-foreground">{commentsVisibleToAuthorOnly ? "当前帖子开启了评论仅楼主可见，你的评论仅楼主、管理员和你自己可见。" : "可使用 @用户名 提及他人"}</span>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {(compact || replyToUserName || mode === "edit") ? (
            <Button type="button" variant="ghost" onClick={() => {
              setExpanded(false)
              setContent(initialContent)
              onCancel?.()
            }}>
              取消
            </Button>
          ) : null}
          <Button disabled={loading || Boolean(disabledMessage)}>{loading ? "提交中..." : mode === "edit" ? "保存修改" : parentId ? "提交回复" : "提交评论"}</Button>
        </div>
      </div>
    </form>
  )
}
