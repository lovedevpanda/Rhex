"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Flag } from "lucide-react"

import { CommentForm } from "@/components/comment-form"
import { CommentLikeButton } from "@/components/comment-like-button"
import { MarkdownContent } from "@/components/markdown-content"
import { ReportDialog } from "@/components/report-dialog"
import { UserAvatar } from "@/components/user-avatar"
import { UserDisplayedBadges } from "@/components/user-displayed-badges"
import { UserStatusBadge } from "@/components/user-status-badge"

import { Button } from "@/components/ui/button"
import { VipBadge } from "@/components/vip-badge"

import type { SiteCommentItem } from "@/lib/comments"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"
import { getVipNameClass } from "@/lib/vip-status"


interface CommentThreadProps {
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
}


const INITIAL_VISIBLE_REPLIES = 10

export function CommentThread({ comments, postId, canReply, currentPage, pageSize, total, currentSort, currentUserId, canAcceptAnswer = false, commentsVisibleToAuthorOnly = false, isAdmin = false, canPinComment = false, markdownEmojiMap }: CommentThreadProps) {

  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null)
  const [pinningCommentId, setPinningCommentId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState("")
  const [replyTarget, setReplyTarget] = useState<{ parentId: string; replyToUserName: string } | null>(null)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const replyBoxRef = useRef<HTMLDivElement | null>(null)

  const replyHint = replyTarget ? `正在回复 @${replyTarget.replyToUserName}` : null

  function scrollToReplyBox(nextTarget?: { parentId: string; replyToUserName: string } | null) {
    setReplyTarget(nextTarget ?? null)
    requestAnimationFrame(() => {
      replyBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>文明发言，理性讨论</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?sort=oldest&page=1`} className={currentSort === "oldest" ? "rounded-full bg-foreground px-3 py-1.5 text-xs text-background" : "rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground"}>最早</Link>
          <Link href={`?sort=newest&page=1`} className={currentSort === "newest" ? "rounded-full bg-foreground px-3 py-1.5 text-xs text-background" : "rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground"}>最新</Link>
        </div>
      </div>

      {comments.map((comment, index) => {
        const isExpanded = expandedReplies[comment.id] ?? false
        const visibleReplies = isExpanded ? comment.replies : comment.replies.slice(0, INITIAL_VISIBLE_REPLIES)
        const canAcceptCurrentComment = canAcceptAnswer && !comment.isAcceptedAnswer && currentUserId !== comment.authorId

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
          <div id={`comment-${comment.id}`} key={comment.id} className={index === 0 ? "group relative py-5" : "group relative border-t border-border/70 py-5"}>
            <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
              <div className="flex min-w-0 items-start gap-3">
                <Link href={`/users/${comment.authorUsername}`} className={cn("shrink-0", isRestrictedCommentAuthor && "grayscale")}>
                  <UserAvatar name={comment.author} avatarPath={comment.authorAvatarPath} size="sm" />
                </Link>
                <div className={cn("min-w-0 space-y-2", isRestrictedCommentAuthor && "grayscale")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/users/${comment.authorUsername}`} className={getVipNameClass(comment.authorIsVip, comment.authorVipLevel, { medium: true })}>{comment.author}</Link>
                    <UserDisplayedBadges badges={comment.authorDisplayedBadges} compact />
                    {comment.authorIsVip ? <VipBadge level={comment.authorVipLevel} compact /> : null}

                    {isRestrictedCommentAuthor ? <UserStatusBadge status={comment.authorStatus} compact /> : null}
                    <span>·</span>
                    <span>{comment.createdAt}</span>
                    {comment.isPinnedByAuthor ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">楼主置顶</span> : null}
                    {comment.isAcceptedAnswer ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">已采纳答案</span> : null}
                  </div>
                  <MarkdownContent content={comment.content} className="text-sm leading-7 text-foreground/90 dark:text-foreground/85" />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
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
                      onClick={() => scrollToReplyBox({ parentId: comment.id, replyToUserName: comment.author })}
                      className="transition-colors hover:text-foreground"
                    >
                      回复
                    </button>
                  ) : null}
                  {canAcceptCurrentComment ? (
                    <Button type="button" variant="outline" onClick={() => acceptAnswer(comment.id)} disabled={Boolean(submittingAnswerId)} className="h-7 px-2.5 text-[11px]">
                      {submittingAnswerId === comment.id ? "提交中..." : "采纳"}
                    </Button>
                  ) : null}
                </div>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground/80">#{comment.floor}</span>
              </div>
            </div>

            {comment.replies.length > 0 ? (
              <div className="mt-4 space-y-3 rounded-[20px] bg-background/70 p-2">
                {visibleReplies.map((reply) => {
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
                    <div id={`comment-${reply.id}`} key={reply.id} className="group relative rounded-[16px] bg-card px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <Link href={`/users/${reply.authorUsername}`} className={cn("shrink-0", isRestrictedReplyAuthor && "grayscale")}>
                            <UserAvatar name={reply.author} avatarPath={reply.authorAvatarPath} size="sm" />
                          </Link>
                          <div className={cn("min-w-0 flex-1", isRestrictedReplyAuthor && "grayscale")}>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Link href={`/users/${reply.authorUsername}`} className={getVipNameClass(reply.authorIsVip, reply.authorVipLevel, { medium: true })}>{reply.author}</Link>
                              <UserDisplayedBadges badges={reply.authorDisplayedBadges} compact />
                              {reply.authorIsVip ? <VipBadge level={reply.authorVipLevel} compact /> : null}

                              {isRestrictedReplyAuthor ? <UserStatusBadge status={reply.authorStatus} compact /> : null}
                              {reply.replyToAuthor ? <span>回复 @{reply.replyToAuthor}</span> : null}
                              <span>·</span>
                              <span>{reply.createdAt}</span>
                            </div>
                            <div className="mt-2">
                              <MarkdownContent content={reply.content} className="text-sm leading-7 text-foreground/90 dark:text-foreground/85" markdownEmojiMap={markdownEmojiMap} />
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <CommentLikeButton commentId={reply.id} initialCount={reply.likes} initialLiked={reply.viewerLiked} />
                            {canReply ? (
                              <button
                                type="button"
                                onClick={() => scrollToReplyBox({ parentId: comment.id, replyToUserName: reply.author })}
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
                      {replyActions.length > 0 ? (
                        <div className="pointer-events-none absolute bottom-3 right-4 z-10 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                          <div className="flex max-w-[320px] flex-wrap justify-end gap-1.5 rounded-2xl border border-border/70 bg-background/95 p-2 shadow-sm backdrop-blur-sm">
                            {replyActions.map((action) => (
                              <Button
                                key={`${reply.id}-${action.key}`}
                                type="button"
                                variant="outline"
                                className={action.tone === "danger" ? "h-7 border-red-200 px-2.5 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700" : "h-7 px-2.5 text-[11px]"}
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
                  <button type="button" title={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`} aria-label={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`} onClick={() => toggleReplies(comment.id)} className="text-xs text-primary transition-opacity hover:opacity-80">

                    {isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {commentActions.length > 0 ? (
              <div className="pointer-events-none absolute bottom-5 right-0 z-10 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="flex max-w-[360px] flex-wrap justify-end gap-1.5 rounded-2xl border border-border/70 bg-background/95 p-2 shadow-sm backdrop-blur-sm">
                  {commentActions.map((action) => (
                    <Button
                      key={`${comment.id}-${action.key}`}
                      type="button"
                      variant="outline"
                      disabled={action.disabled}
                      className={action.tone === "danger" ? "h-7 border-red-200 px-2.5 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60" : "h-7 px-2.5 text-[11px] disabled:opacity-60"}
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
        <div id="post-comment-reply-box" data-comment-reply-box="true" ref={replyBoxRef} className="rounded-[24px] bg-card">
          {replyHint ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-[16px] border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
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
      ) : null}
    </div>
  )
}
