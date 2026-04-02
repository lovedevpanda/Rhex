"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

import { Flag, Keyboard, Minimize2 } from "lucide-react"

import { CommentForm } from "@/components/comment-form"
import { CommentLikeButton } from "@/components/comment-like-button"
import { MarkdownContent } from "@/components/markdown-content"
import { ReportDialog } from "@/components/report-dialog"
import { UserAvatar } from "@/components/user-avatar"
import { UserDisplayedBadges } from "@/components/user-displayed-badges"
import { UserStatusBadge } from "@/components/user-status-badge"
import { UserVerificationBadge } from "@/components/user-verification-badge"
import { VipNameTooltip } from "@/components/vip-name-tooltip"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"

import type { SiteCommentItem, SiteCommentReplyItem } from "@/lib/comments"
import { COMMENT_REPLY_TOGGLE_EVENT, emitCommentReplyState, type CommentReplyTarget, type CommentReplyToggleDetail } from "@/lib/comment-reply-box-events"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"
import { getVipNameClass } from "@/lib/vip-status"

interface CommentThreadProps {
  threadId: string
  comments: SiteCommentItem[]
  postId: string
  canReply: boolean
  currentPage: number
  pageSize: number
  total: number
  currentSort: "oldest" | "newest"
  currentUserId?: number
  canAcceptAnswer?: boolean
  commentsVisibleToAuthorOnly?: boolean
  isAdmin?: boolean
  canPinComment?: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
  commentEditWindowMinutes?: number
}

const INITIAL_VISIBLE_REPLIES = 10
const REPLY_BOX_FOLLOW_ENTER_OFFSET = 72
const REPLY_BOX_FOLLOW_EXIT_OFFSET = 20

function CommentIdentityBadge({ label, tooltip, tone = "neutral" }: { label: string; tooltip: string; tone?: "neutral" | "brand" }) {
  return (
    <Tooltip content={tooltip}>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.08em]",
          tone === "brand"
            ? "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/12 dark:text-sky-200"
            : "border-border bg-background text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Tooltip>
  )
}

function CommentAuthorIdentityBadges({ isPostAuthor, authorRole }: { isPostAuthor: boolean; authorRole: "USER" | "MODERATOR" | "ADMIN" }) {
  const isAdminAuthor = authorRole === "ADMIN" || authorRole === "MODERATOR"

  if (!isPostAuthor && !isAdminAuthor) {
    return null
  }

  return (
    <span className="inline-flex items-center gap-1">
      {isPostAuthor ? <CommentIdentityBadge label="OP" tooltip="本贴作者" tone="brand" /> : null}
      {isPostAuthor && isAdminAuthor ? <span className="text-[10px] text-muted-foreground/70">|</span> : null}
      {isAdminAuthor ? <CommentIdentityBadge label="Admin" tooltip="管理员" /> : null}
    </span>
  )
}

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

export function CommentThread({ threadId, comments, postId, canReply, currentPage, pageSize, total, currentSort, currentUserId, canAcceptAnswer = false, commentsVisibleToAuthorOnly = false, isAdmin = false, canPinComment = false, markdownEmojiMap, commentEditWindowMinutes = 5 }: CommentThreadProps) {
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

  async function runAdminAction(action: string, targetId: string) {
    setActionMessage("")

    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, targetId }),
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

      {filteredComments.map((comment, index) => {
        const isExpanded = expandedReplies[comment.id] ?? false
        const visibleReplies = isExpanded ? comment.replies : comment.replies.slice(0, INITIAL_VISIBLE_REPLIES)
        const canAcceptCurrentComment = canAcceptAnswer && !comment.isAcceptedAnswer && currentUserId !== comment.authorId
        const canEditCurrentComment = canEditComment(comment)
        const isRestrictedCommentAuthor = comment.authorStatus === "BANNED" || comment.authorStatus === "MUTED"
        const commentActions = [
          ...(canPinComment
            ? [
                {
                  key: comment.isPinnedByAuthor ? "comment.unpinByAuthor" : "comment.pinByAuthor",
                  label: pinningCommentId === comment.id ? "处理中..." : comment.isPinnedByAuthor ? "取消置顶" : "置顶评论",
                  targetId: comment.id,
                  disabled: pinningCommentId === comment.id,
                },
              ]
            : []),
          ...(isAdmin
            ? comment.authorStatus === "BANNED"
              ? [
                  { key: "comment.hide", label: "下线评论", tone: "danger" as const, targetId: comment.id },
                  { key: "user.activate", label: "解除封禁", targetId: String(comment.authorId) },
                ]
              : comment.authorStatus === "MUTED"
                ? [
                    { key: "comment.hide", label: "下线评论", tone: "danger" as const, targetId: comment.id },
                    { key: "user.activate", label: "解除禁言", targetId: String(comment.authorId) },
                    { key: "user.ban", label: "封禁用户", tone: "danger" as const, targetId: String(comment.authorId) },
                  ]
                : [
                    { key: "comment.hide", label: "下线评论", tone: "danger" as const, targetId: comment.id },
                    { key: "user.mute", label: "禁言用户", targetId: String(comment.authorId) },
                    { key: "user.ban", label: "封禁用户", tone: "danger" as const, targetId: String(comment.authorId) },
                  ]
            : []),
        ]

        return (
          <div id={`comment-${comment.id}`} key={comment.id} className={index === 0 ? "group relative py-4" : "group relative border-t border-border/70 py-4"}>
            <div className={cn("text-sm text-muted-foreground", editingCommentId === comment.id ? "flex flex-col gap-2.5" : "flex items-start justify-between gap-2.5")}>
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Link href={`/users/${comment.authorUsername}`} className={cn("shrink-0", isRestrictedCommentAuthor && "grayscale")}>
                  <UserAvatar name={comment.author} avatarPath={comment.authorAvatarPath} size="xs" isVip={comment.authorIsVip} vipLevel={comment.authorVipLevel} />
                </Link>
                <div className={cn("min-w-0 flex-1 space-y-1.5", isRestrictedCommentAuthor && "grayscale")}>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
                    <UserVerificationBadge verification={comment.authorVerification ?? null} compact appearance="plain" />
                    <VipNameTooltip isVip={comment.authorIsVip} level={comment.authorVipLevel}>
                      <Link href={`/users/${comment.authorUsername}`} className={getVipNameClass(comment.authorIsVip, comment.authorVipLevel, { medium: true })}>{comment.author}</Link>
                    </VipNameTooltip>
                    <CommentAuthorIdentityBadges isPostAuthor={comment.isPostAuthor} authorRole={comment.authorRole} />
                    <UserDisplayedBadges badges={comment.authorDisplayedBadges} compact appearance="plain" />
                    {isRestrictedCommentAuthor ? <UserStatusBadge status={comment.authorStatus} compact /> : null}
                    <span>·</span>
                    <span>{comment.createdAt}</span>
                    {comment.isPinnedByAuthor ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">楼主置顶</span> : null}
                    {comment.isAcceptedAnswer ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">已采纳答案</span> : null}
                    {canEditCurrentComment ? (
                      <button type="button" className="text-[11px] transition-colors hover:text-foreground" onClick={() => editingCommentId === comment.id ? stopEdit() : startEdit(comment.id)}>
                        {getEditButtonLabel(comment)}
                      </button>
                    ) : null}
                  </div>
                  {editingCommentId === comment.id ? (
                    <CommentForm
                      postId={comment.postId}
                      commentId={comment.id}
                      initialContent={comment.content}
                      mode="edit"
                      onCancel={stopEdit}
                      markdownEmojiMap={markdownEmojiMap}
                      editWindowMinutes={commentEditWindowMinutes}
                    />
                  ) : (
                    <MarkdownContent content={comment.content} className="text-[13px] leading-6 text-foreground/90 dark:text-foreground/85 sm:text-sm sm:leading-7" />
                  )}
                </div>
              </div>

              <div className={cn("flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:text-xs", editingCommentId === comment.id && "justify-end border-t border-border/60 pt-2")}>
                <div className="flex items-center gap-1.5">
                  <CommentLikeButton commentId={comment.id} initialCount={comment.likes} initialLiked={comment.viewerLiked} />
                  {currentUserId && currentUserId !== comment.authorId ? (
                    <ReportDialog
                      targetType="COMMENT"
                      targetId={comment.id}
                      targetLabel={`评论 #${comment.floor} · ${comment.author}`}
                      buttonText="举报"
                      icon={<Flag className="h-4 w-4" />}
                      buttonClassName="h-auto p-0 text-muted-foreground hover:text-foreground"
                    />
                  ) : null}
                  {canReply ? (
                    <button
                      type="button"
                      onClick={() => enableReplyBox({ parentId: comment.id, replyToUserName: comment.author })}
                      className="transition-colors hover:text-foreground"
                    >
                      回复
                    </button>
                  ) : null}
                  {canAcceptCurrentComment ? (
                    <Button type="button" variant="outline" onClick={() => acceptAnswer(comment.id)} disabled={Boolean(submittingAnswerId)} className="h-6 px-2 text-[11px]">
                      {submittingAnswerId === comment.id ? "提交中..." : "采纳"}
                    </Button>
                  ) : null}
                </div>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground/80">#{comment.floor}</span>
              </div>
            </div>

            {comment.replies.length > 0 ? (
              <div className="relative mt-3 space-y-2 pl-3 before:absolute before:bottom-1 before:left-0 before:top-1 before:w-px before:bg-gradient-to-b before:from-border before:via-border/70 before:to-transparent sm:pl-4">
                {visibleReplies.map((reply) => {
                  const canEditCurrentReply = canEditComment(reply)
                  const isRestrictedReplyAuthor = reply.authorStatus === "BANNED" || reply.authorStatus === "MUTED"
                  const replyActions = isAdmin
                    ? reply.authorStatus === "BANNED"
                      ? [
                          { key: "comment.hide", label: "下线评论", tone: "danger" as const, targetId: reply.id },
                          { key: "user.activate", label: "解除封禁", targetId: String(reply.authorId) },
                        ]
                      : reply.authorStatus === "MUTED"
                        ? [
                            { key: "comment.hide", label: "下线评论", tone: "danger" as const, targetId: reply.id },
                            { key: "user.activate", label: "解除禁言", targetId: String(reply.authorId) },
                            { key: "user.ban", label: "封禁用户", tone: "danger" as const, targetId: String(reply.authorId) },
                          ]
                        : [
                            { key: "comment.hide", label: "下线评论", tone: "danger" as const, targetId: reply.id },
                            { key: "user.mute", label: "禁言用户", targetId: String(reply.authorId) },
                            { key: "user.ban", label: "封禁用户", tone: "danger" as const, targetId: String(reply.authorId) },
                          ]
                    : []

                  return (
                    <div
                      id={`comment-${reply.id}`}
                      key={reply.id}
                      className="group relative rounded-[18px] bg-secondary/[0.22] px-3 py-2.5 transition-[background-color,transform] duration-150 hover:bg-accent/55 sm:px-3.5"
                    >
                      <span aria-hidden="true" className="absolute -left-[14px] top-4 h-2 w-2 rounded-full bg-muted-foreground/30 sm:-left-[18px]" />
                      <div className={cn(editingCommentId === reply.id ? "flex flex-col gap-2.5" : "flex items-start justify-between gap-2.5")}>
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <Link href={`/users/${reply.authorUsername}`} className={cn("shrink-0", isRestrictedReplyAuthor && "grayscale")}>
                            <UserAvatar name={reply.author} avatarPath={reply.authorAvatarPath} size="xs" isVip={reply.authorIsVip} vipLevel={reply.authorVipLevel} />
                          </Link>
                          <div className={cn("min-w-0 flex-1", isRestrictedReplyAuthor && "grayscale")}>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <VipNameTooltip isVip={reply.authorIsVip} level={reply.authorVipLevel}>
                                <Link href={`/users/${reply.authorUsername}`} className={getVipNameClass(reply.authorIsVip, reply.authorVipLevel, { medium: true })}>{reply.author}</Link>
                              </VipNameTooltip>
                              <CommentAuthorIdentityBadges isPostAuthor={reply.isPostAuthor} authorRole={reply.authorRole} />
                              <UserDisplayedBadges badges={reply.authorDisplayedBadges} compact appearance="plain" />
                              {isRestrictedReplyAuthor ? <UserStatusBadge status={reply.authorStatus} compact /> : null}
                              {reply.replyToAuthor ? <span className="rounded-full bg-background/75 px-1.5 py-0.5 text-[10px] text-muted-foreground/90">回复 @{reply.replyToAuthor}</span> : null}
                              <span>·</span>
                              <span>{reply.createdAt}</span>
                              {canEditCurrentReply ? (
                                <button type="button" className="text-[11px] transition-colors hover:text-foreground" onClick={() => editingCommentId === reply.id ? stopEdit() : startEdit(reply.id)}>
                                  {getEditButtonLabel(reply)}
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-2">
                              {editingCommentId === reply.id ? (
                                <CommentForm
                                  postId={reply.postId}
                                  commentId={reply.id}
                                  initialContent={reply.content}
                                  mode="edit"
                                  compact
                                  onCancel={stopEdit}
                                  markdownEmojiMap={markdownEmojiMap}
                                  editWindowMinutes={commentEditWindowMinutes}
                                />
                              ) : (
                                <MarkdownContent content={reply.content} className="text-[13px] leading-6 text-foreground/90 dark:text-foreground/85 sm:text-sm sm:leading-7" markdownEmojiMap={markdownEmojiMap} />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={cn("flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground", editingCommentId === reply.id && "justify-end border-t border-border/50 pt-2")}>
                          <div className="flex items-center gap-1.5">
                            <CommentLikeButton commentId={reply.id} initialCount={reply.likes} initialLiked={reply.viewerLiked} />
                            {canReply ? (
                              <button
                                type="button"
                                onClick={() => enableReplyBox({ parentId: comment.id, replyToUserName: reply.author })}
                                className="transition-colors hover:text-foreground"
                              >
                                回复
                              </button>
                            ) : null}
                            {currentUserId && currentUserId !== reply.authorId ? (
                              <ReportDialog
                                targetType="COMMENT"
                                targetId={reply.id}
                                targetLabel={`回复 · ${reply.author}`}
                                buttonText="举报"
                                icon={<Flag className="h-4 w-4" />}
                                buttonClassName="h-auto p-0 text-muted-foreground hover:text-foreground"
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {!hideFloatingActionButtons && replyActions.length > 0 ? (
                        <div className="pointer-events-none absolute bottom-2.5 right-3 z-10 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                          <div className="flex max-w-[320px] flex-wrap justify-end gap-1.5 rounded-2xl bg-background/95 p-1.5 shadow-sm backdrop-blur-sm">
                            {replyActions.map((action) => (
                              <Button
                                key={`${reply.id}-${action.key}`}
                                type="button"
                                variant="outline"
                                className={action.tone === "danger" ? "h-6 border-transparent bg-red-50/80 px-2 text-[11px] text-red-600 hover:bg-red-100 hover:text-red-700" : "h-6 border-transparent bg-secondary/70 px-2 text-[11px] hover:bg-accent"}
                                onClick={() => runAdminAction(action.key, action.targetId)}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                {comment.replies.length > INITIAL_VISIBLE_REPLIES ? (
                  <button type="button" title={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`} aria-label={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`} onClick={() => toggleReplies(comment.id)} className="px-1 text-[11px] text-primary transition-opacity hover:opacity-80">
                    {isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {!hideFloatingActionButtons && commentActions.length > 0 ? (
              <div className="pointer-events-none absolute bottom-4 right-0 z-10 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="flex max-w-[360px] flex-wrap justify-end gap-1.5 rounded-2xl p-1.5">
                  {commentActions.map((action) => (
                    <Button
                      key={`${comment.id}-${action.key}`}
                      type="button"
                      variant="outline"
                      disabled={action.disabled}
                      className={action.tone === "danger" ? "h-6 border-red-200 px-2 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60" : "h-6 px-2 text-[11px] disabled:opacity-60"}
                      onClick={() => {
                        if (action.key === "comment.pinByAuthor") {
                          void togglePinnedComment(comment.id, "pin")
                          return
                        }
                        if (action.key === "comment.unpinByAuthor") {
                          void togglePinnedComment(comment.id, "unpin")
                          return
                        }
                        void runAdminAction(action.key, action.targetId)
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}

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
        <div
          id="post-comment-reply-box"
          data-comment-reply-box="true"
          data-ignore-reply-shortcut="true"
          ref={replyBoxContainerRef}
          className="relative"
        >
          {isReplyBoxPinned && isReplyBoxFollowing ? <div aria-hidden="true" className="h-[22rem] sm:h-[24rem]" /> : null}
          <div
            className={cn(
              "rounded-[24px] bg-card",
              isReplyBoxPinned && isReplyBoxFollowing && "fixed bottom-3 z-50 bg-transparent shadow-[0_-12px_36px_rgba(15,23,42,0.12)]",
            )}
            style={isReplyBoxPinned && isReplyBoxFollowing
              ? {
                  left: replyBoxPinnedLayout.left || undefined,
                  width: replyBoxPinnedLayout.width || undefined,
                }
              : undefined}
          >
            {isReplyBoxPinned ? (
              <div className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs text-muted-foreground", isReplyBoxFollowing ? "bg-card" : "bg-transparent")}>
                <span className="inline-flex items-center gap-1.5">
                  <Keyboard className="h-3.5 w-3.5" />
                  按 <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">R</kbd> 或 <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">Esc</kbd> 退出固定
                </span>
                <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-foreground transition-colors hover:bg-accent" onClick={disableReplyBox}>
                  <Minimize2 className="h-3.5 w-3.5" />
                  收起固定
                </button>
              </div>
            ) : null}
            {replyHint ? (
              <div className={cn("flex items-center justify-between gap-3 rounded-[16px] border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground", isReplyBoxPinned && "border-transparent bg-background/94 backdrop-blur-md")}>
                <span>{replyHint}</span>
                <button type="button" className="text-primary transition-opacity hover:opacity-80" onClick={() => setReplyTarget(null)}>
                  改为普通回复
                </button>
              </div>
            ) : null}
            <CommentForm
              postId={postId}
              parentId={replyTarget?.parentId}
              replyToUserName={replyTarget?.replyToUserName}
              onCancel={() => setReplyTarget(null)}
              commentsVisibleToAuthorOnly={commentsVisibleToAuthorOnly}
              markdownEmojiMap={markdownEmojiMap}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
