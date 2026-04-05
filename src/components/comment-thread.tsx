"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

import { CommentThreadCommentItem } from "@/components/comment-thread-items"
import { CommentThreadReplyBox } from "@/components/comment-thread-shared"

import type { SiteCommentItem, SiteCommentReplyItem } from "@/lib/comments"
import { COMMENT_REPLY_TOGGLE_EVENT, emitCommentReplyState, type CommentReplyTarget, type CommentReplyToggleDetail } from "@/lib/comment-reply-box-events"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"

interface CommentThreadProps {
  threadId: string
  comments: SiteCommentItem[]
  postId: string
  pointName?: string
  canReply: boolean
  currentPage: number
  pageSize: number
  total: number
  currentSort: "oldest" | "newest"
  currentUserId?: number
  canAcceptAnswer?: boolean
  commentsVisibleToAuthorOnly?: boolean
  isAdmin?: boolean
  adminRole?: "ADMIN" | "MODERATOR" | null
  canPinComment?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
  commentEditWindowMinutes?: number
}

const REPLY_BOX_FOLLOW_ENTER_OFFSET = 72
const REPLY_BOX_FOLLOW_EXIT_OFFSET = 20

function shouldIgnoreReplyShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  if (target.closest("[contenteditable='true'], [role='dialog'], [data-ignore-reply-shortcut='true']")) {
    return true
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

export function CommentThread({ threadId, comments, postId, pointName, canReply, currentPage, pageSize, total, currentSort, currentUserId, canAcceptAnswer = false, commentsVisibleToAuthorOnly = false, isAdmin = false, adminRole = null, canPinComment = false, markdownEmojiMap, commentEditWindowMinutes = 5 }: CommentThreadProps) {
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null)
  const [pinningCommentId, setPinningCommentId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState("")
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null)
  const [showOnlyAuthorComments, setShowOnlyAuthorComments] = useState(false)
  const [isReplyBoxPinned, setIsReplyBoxPinned] = useState(false)
  const [isReplyBoxFollowing, setIsReplyBoxFollowing] = useState(false)
  const [replyBoxPinnedLayout, setReplyBoxPinnedLayout] = useState({ left: 0, width: 0 })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const replyBoxContainerRef = useRef<HTMLDivElement | null>(null)
  const replyBoxFollowRafRef = useRef<number | null>(null)

  const filteredComments = useMemo(() => {
    if (!showOnlyAuthorComments) {
      return comments
    }

    return comments
      .filter((comment) => comment.isPostAuthor || comment.replies.some((reply) => reply.isPostAuthor))
      .map((comment) => ({
        ...comment,
        replies: comment.replies.filter((reply) => reply.isPostAuthor),
      }))
  }, [comments, showOnlyAuthorComments])

  const replyHint = replyTarget ? `正在回复 @${replyTarget.replyToUserName}` : null

  const updateReplyBoxPinnedLayout = useCallback(() => {
    const element = replyBoxContainerRef.current
    if (!element) {
      return
    }

    const rect = element.getBoundingClientRect()
    setReplyBoxPinnedLayout((current) => {
      if (Math.abs(current.left - rect.left) < 1 && Math.abs(current.width - rect.width) < 1) {
        return current
      }

      return {
        left: rect.left,
        width: rect.width,
      }
    })
  }, [])

  const syncPinnedReplyBoxState = useCallback(() => {
    const element = replyBoxContainerRef.current
    if (!element) {
      return
    }

    const rect = element.getBoundingClientRect()
    setReplyBoxPinnedLayout((current) => {
      if (Math.abs(current.left - rect.left) < 1 && Math.abs(current.width - rect.width) < 1) {
        return current
      }

      return {
        left: rect.left,
        width: rect.width,
      }
    })

    setIsReplyBoxFollowing((current) => {
      if (current) {
        return rect.bottom > window.innerHeight - REPLY_BOX_FOLLOW_EXIT_OFFSET
      }

      return rect.bottom > window.innerHeight + REPLY_BOX_FOLLOW_ENTER_OFFSET
    })
  }, [])

  const enableReplyBox = useCallback((nextTarget?: CommentReplyTarget | null) => {
    if (nextTarget !== undefined) {
      setReplyTarget(nextTarget)
    }

    setIsReplyBoxPinned(true)
    requestAnimationFrame(() => {
      syncPinnedReplyBoxState()
    })
  }, [syncPinnedReplyBoxState])

  const disableReplyBox = useCallback(() => {
    setIsReplyBoxPinned(false)
    setIsReplyBoxFollowing(false)
  }, [])

  const toggleReplyBox = useCallback(() => {
    setIsReplyBoxPinned((current) => {
      const next = !current
      if (next) {
        requestAnimationFrame(() => {
          syncPinnedReplyBoxState()
        })
      } else {
        setIsReplyBoxFollowing(false)
      }

      return next
    })
  }, [syncPinnedReplyBoxState])

  useEffect(() => {
    if (!canReply) {
      return
    }

    updateReplyBoxPinnedLayout()

    const element = replyBoxContainerRef.current
    const handleResize = () => updateReplyBoxPinnedLayout()
    window.addEventListener("resize", handleResize)

    let observer: ResizeObserver | null = null
    if (element && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateReplyBoxPinnedLayout()
      })
      observer.observe(element)
    }

    return () => {
      window.removeEventListener("resize", handleResize)
      observer?.disconnect()
    }
  }, [canReply, updateReplyBoxPinnedLayout])

  useEffect(() => {
    if (!canReply || !isReplyBoxPinned) {
      if (replyBoxFollowRafRef.current !== null) {
        window.cancelAnimationFrame(replyBoxFollowRafRef.current)
        replyBoxFollowRafRef.current = null
      }
      return
    }

    syncPinnedReplyBoxState()

    const scheduleSync = () => {
      if (replyBoxFollowRafRef.current !== null) {
        return
      }

      replyBoxFollowRafRef.current = window.requestAnimationFrame(() => {
        replyBoxFollowRafRef.current = null
        syncPinnedReplyBoxState()
      })
    }

    window.addEventListener("scroll", scheduleSync, { passive: true })
    window.addEventListener("resize", scheduleSync)

    return () => {
      window.removeEventListener("scroll", scheduleSync)
      window.removeEventListener("resize", scheduleSync)
      if (replyBoxFollowRafRef.current !== null) {
        window.cancelAnimationFrame(replyBoxFollowRafRef.current)
        replyBoxFollowRafRef.current = null
      }
    }
  }, [canReply, isReplyBoxPinned, syncPinnedReplyBoxState])

  useEffect(() => {
    if (!canReply) {
      return
    }

    function handleReplyToggle(event: Event) {
      const detail = (event as CustomEvent<CommentReplyToggleDetail>).detail
      if (!detail || detail.threadId !== threadId) {
        return
      }

      if (detail.nextTarget !== undefined) {
        enableReplyBox(detail.nextTarget)
        return
      }

      toggleReplyBox()
    }

    window.addEventListener(COMMENT_REPLY_TOGGLE_EVENT, handleReplyToggle as EventListener)

    return () => {
      window.removeEventListener(COMMENT_REPLY_TOGGLE_EVENT, handleReplyToggle as EventListener)
    }
  }, [canReply, enableReplyBox, threadId, toggleReplyBox])

  useEffect(() => {
    if (!canReply) {
      return
    }

    emitCommentReplyState({
      threadId,
      active: isReplyBoxPinned,
      target: replyTarget,
    })
  }, [canReply, isReplyBoxPinned, replyTarget, threadId])

  useEffect(() => {
    if (!canReply) {
      return
    }

    function handleReplyShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (shouldIgnoreReplyShortcut(event.target)) {
        return
      }

      if (event.key === "Escape" && isReplyBoxPinned) {
        event.preventDefault()
        disableReplyBox()
        return
      }

      if (event.key.toLowerCase() !== "r") {
        return
      }

      event.preventDefault()
      toggleReplyBox()
    }

    window.addEventListener("keydown", handleReplyShortcut)

    return () => {
      window.removeEventListener("keydown", handleReplyShortcut)
    }
  }, [canReply, disableReplyBox, isReplyBoxPinned, toggleReplyBox])

  function toggleReplies(commentId: string) {
    setExpandedReplies((current) => ({
      ...current,
      [commentId]: !current[commentId],
    }))
  }

  async function acceptAnswer(commentId: string) {
    setSubmittingAnswerId(commentId)
    setActionMessage("")

    const response = await fetch("/api/posts/accept-answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postId, commentId }),
    })

    const result = await response.json()
    setSubmittingAnswerId(null)
    setActionMessage(result.message ?? (response.ok ? "操作成功" : "操作失败"))

    if (response.ok) {
      window.location.reload()
    }
  }

  async function runAdminAction(action: string, targetId: string, extra?: Record<string, unknown>) {
    setActionMessage("")

    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, targetId, postId, ...extra }),
    })

    const result = await response.json()
    setActionMessage(result.message ?? (response.ok ? "操作成功" : "操作失败"))

    if (response.ok) {
      window.location.reload()
    }
  }

  async function togglePinnedComment(commentId: string, nextAction: "pin" | "unpin") {
    setPinningCommentId(commentId)
    setActionMessage("")

    const response = await fetch("/api/posts/pin-comment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postId, commentId, action: nextAction }),
    })

    const result = await response.json()
    setPinningCommentId(null)
    setActionMessage(result.message ?? (response.ok ? "操作成功" : "操作失败"))

    if (response.ok) {
      window.location.reload()
    }
  }

  function startEdit(commentId: string) {
    setEditingCommentId(commentId)
    setActionMessage("")
  }

  function stopEdit() {
    setEditingCommentId(null)
  }

  function canEditComment(comment: SiteCommentItem | SiteCommentReplyItem) {
    return Boolean(currentUserId && currentUserId === comment.authorId)
  }

  function getEditButtonLabel(comment: SiteCommentItem | SiteCommentReplyItem) {
    return editingCommentId === comment.id ? "取消编辑" : "编辑"
  }

  const hideFloatingActionButtons = editingCommentId !== null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>文明发言，理性讨论</span>
          <button
            type="button"
            onClick={() => setShowOnlyAuthorComments((current) => !current)}
            className={showOnlyAuthorComments ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"}
          >
            {showOnlyAuthorComments ? "查看全部评论" : "只看楼主"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?sort=oldest&page=1`} className={currentSort === "oldest" ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"}>最早</Link>
          <Link href={`?sort=newest&page=1`} className={currentSort === "newest" ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"}>最新</Link>
        </div>
      </div>

      {showOnlyAuthorComments && filteredComments.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          当前页暂无楼主评论
        </div>
      ) : null}

      {filteredComments.map((comment, index) => (
        <CommentThreadCommentItem
          key={comment.id}
          comment={comment}
          index={index}
          pointName={pointName}
          canReply={canReply}
          currentUserId={currentUserId}
          canAcceptAnswer={canAcceptAnswer}
          isAdmin={isAdmin}
          adminRole={adminRole}
          canPinComment={canPinComment}
          markdownEmojiMap={markdownEmojiMap}
          commentEditWindowMinutes={commentEditWindowMinutes}
          editingCommentId={editingCommentId}
          pinningCommentId={pinningCommentId}
          submittingAnswerId={submittingAnswerId}
          hideFloatingActionButtons={hideFloatingActionButtons}
          isExpanded={expandedReplies[comment.id] ?? false}
          onToggleReplies={toggleReplies}
          onEnableReplyBox={(target) => enableReplyBox(target)}
          onAcceptAnswer={acceptAnswer}
          onRunAdminAction={runAdminAction}
          onTogglePinnedComment={togglePinnedComment}
          onStartEdit={startEdit}
          onStopEdit={stopEdit}
          canEditComment={canEditComment}
          getEditButtonLabel={getEditButtonLabel}
        />
      ))}

      {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <Link href={`?sort=${currentSort}&page=${Math.max(1, currentPage - 1)}`} className={currentPage <= 1 ? "pointer-events-none rounded-full border border-border bg-card px-4 py-2 text-sm opacity-50" : "rounded-full border border-border bg-card px-4 py-2 text-sm"}>
            上一页
          </Link>
          <span className="text-sm text-muted-foreground">第 {currentPage} / {totalPages} 页</span>
          <Link href={`?sort=${currentSort}&page=${Math.min(totalPages, currentPage + 1)}`} className={currentPage >= totalPages ? "pointer-events-none rounded-full border border-border bg-card px-4 py-2 text-sm opacity-50" : "rounded-full border border-border bg-card px-4 py-2 text-sm"}>
            下一页
          </Link>
        </div>
      ) : null}

      {canReply ? (
        <CommentThreadReplyBox
          postId={postId}
          commentsVisibleToAuthorOnly={commentsVisibleToAuthorOnly}
          markdownEmojiMap={markdownEmojiMap}
          replyTarget={replyTarget}
          replyHint={replyHint}
          isReplyBoxPinned={isReplyBoxPinned}
          isReplyBoxFollowing={isReplyBoxFollowing}
          replyBoxPinnedLayout={replyBoxPinnedLayout}
          replyBoxContainerRef={replyBoxContainerRef}
          onDisableReplyBox={disableReplyBox}
          onClearReplyTarget={() => setReplyTarget(null)}
        />
      ) : null}
    </div>
  )
}
