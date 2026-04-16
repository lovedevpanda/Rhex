"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { AddonEditor } from "@/components/addon-editor"
import { Kbd } from "@/components/ui/kbd"
import { Button } from "@/components/ui/rbutton"
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
  replyToCommentId?: string
  compact?: boolean
  onCancel?: () => void
  disabledMessage?: string | null
  commentsVisibleToAuthorOnly?: boolean
  anonymousIdentityEnabled?: boolean
  anonymousIdentityDefaultChecked?: boolean
  anonymousIdentitySwitchVisible?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
}

export function CommentForm({ postId, commentId, initialContent = "", mode = "create", editWindowMinutes = 5, parentId, replyToUserName, replyToCommentId, compact = false, onCancel, disabledMessage, commentsVisibleToAuthorOnly = false, anonymousIdentityEnabled = false, anonymousIdentityDefaultChecked = false, anonymousIdentitySwitchVisible = false, markdownEmojiMap }: CommentFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [content, setContent] = useState(initialContent)
  const [useAnonymousIdentity, setUseAnonymousIdentity] = useState(anonymousIdentityDefaultChecked)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(mode === "edit" || !compact)

  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  useEffect(() => {
    setUseAnonymousIdentity(anonymousIdentityDefaultChecked)
  }, [anonymousIdentityDefaultChecked])

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

  const helperMessage = commentsVisibleToAuthorOnly
    ? "当前帖子开启了评论仅楼主可见，你的评论仅楼主、管理员和你自己可见。"
    : "可使用 @用户名 提及他人，"

  function handleSubmitShortcut(event: React.KeyboardEvent<HTMLFormElement>) {
    if (loading || disabledMessage) {
      return
    }

    if (event.nativeEvent.isComposing) {
      return
    }

    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
      return
    }

    if (event.key !== "Enter") {
      return
    }

    if (!(event.target instanceof HTMLTextAreaElement) || event.target.disabled) {
      return
    }

    event.preventDefault()
    event.currentTarget.requestSubmit()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    const response = await fetch(mode === "edit" ? "/api/comments/update" : "/api/comments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mode === "edit" ? { postId, commentId, content } : {
        postId,
        content,
        parentId,
        replyToUserName,
        replyToCommentId,
        useAnonymousIdentity,
        commentView: searchParams.get("view") === "flat" ? "flat" : "tree",
      }),
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
    const navigation = result.data?.navigation as { page?: number; sort?: string; view?: string; anchor?: string } | undefined
    const nextSearchParams = new URLSearchParams(searchParams.toString())

    if (navigation?.page) {
      nextSearchParams.set("page", String(navigation.page))
    }
    if (navigation?.sort) {
      nextSearchParams.set("sort", navigation.sort)
    }
    if (navigation?.view) {
      nextSearchParams.set("view", navigation.view)
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
    <form onSubmit={handleSubmit} onKeyDown={handleSubmitShortcut} className={compact ? "min-w-0 w-full space-y-3 rounded-[18px] border border-border bg-card p-4" : "min-w-0 w-full space-y-4"}>
      {disabledMessage ? <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{disabledMessage}</div> : null}
      <AddonEditor
        context="comment"
        value={content}
        onChange={setContent}
        disabled={Boolean(disabledMessage)}
        minHeight={compact ? 120 : 180}
        uploadFolder="comments"
        markdownEmojiMap={markdownEmojiMap}
        placeholder={mode === "edit" ? `修改评论内容…可在 ${editWindowMinutes} 分钟内编辑` : replyToUserName ? `回复 @${replyToUserName}…` : "写下你的回复…支持 @用户名 提及"}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{helperMessage}</span>
            <Kbd className="min-w-fit px-1.5 font-mono text-[10px]">Ctrl</Kbd>
            <span>+</span>
            <Kbd className="min-w-fit px-1.5 font-mono text-[10px]">Enter</Kbd>
            <span>/</span>
            <Kbd className="min-w-fit px-1.5 font-mono text-[10px]">Cmd</Kbd>
            <span>+</span>
            <Kbd className="min-w-fit px-1.5 font-mono text-[10px]">Enter</Kbd>
            <span>快速提交</span>
          </span>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {mode === "create" && anonymousIdentityEnabled && anonymousIdentitySwitchVisible ? (
            <label className="mr-auto inline-flex items-center gap-2 text-xs text-muted-foreground sm:mr-0">
              <input type="checkbox" checked={useAnonymousIdentity} onChange={(event) => setUseAnonymousIdentity(event.target.checked)} className="h-4 w-4" />
              继续使用匿名身份回复
            </label>
          ) : null}
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
