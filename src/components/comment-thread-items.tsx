"use client"

import Link from "next/link"
import { Flag } from "lucide-react"

import { CommentForm } from "@/components/comment-form"
import { CommentLikeButton } from "@/components/comment-like-button"
import { AdminCommentStatusNotice, buildCommentAdminActions, CommentAuthorIdentityBadges, CommentRewardBadge, CommentRewardEffectBadge, CommentUnavailablePlaceholder, copyCommentPermalink, getCommentUnavailableMessage, type CommentAdminAction } from "@/components/comment-thread-shared"
import { MarkdownContent } from "@/components/markdown-content"
import { ReportDialog } from "@/components/report-dialog"
import { TimeTooltip } from "@/components/time-tooltip"
import { UserAvatar } from "@/components/user-avatar"
import { UserDisplayedBadges } from "@/components/user-displayed-badges"
import { UserStatusBadge } from "@/components/user-status-badge"
import { UserVerificationBadge } from "@/components/user-verification-badge"
import { VipNameTooltip } from "@/components/vip-name-tooltip"
import { Button } from "@/components/ui/button"
import type { SiteCommentItem, SiteCommentReplyItem } from "@/lib/comments"
import type { CommentReplyTarget } from "@/lib/comment-reply-box-events"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"
import { getVipNameClass } from "@/lib/vip-status"

const INITIAL_VISIBLE_REPLIES = 10

type ThreadEntry = SiteCommentItem | SiteCommentReplyItem

interface CommentThreadCommentItemProps {
  comment: SiteCommentItem
  index: number
  pointName?: string
  canReply: boolean
  currentUserId?: number
  canAcceptAnswer: boolean
  isAdmin: boolean
  adminRole?: "ADMIN" | "MODERATOR" | null
  canPinComment: boolean
  markdownEmojiMap?: MarkdownEmojiItem[]
  commentEditWindowMinutes: number
  editingCommentId: string | null
  pinningCommentId: string | null
  submittingAnswerId: string | null
  hideFloatingActionButtons: boolean
  isExpanded: boolean
  onToggleReplies: (commentId: string) => void
  onEnableReplyBox: (target: CommentReplyTarget) => void
  onAcceptAnswer: (commentId: string) => Promise<void>
  onRunAdminAction: (action: string, targetId: string, extra?: Record<string, unknown>) => Promise<void>
  onTogglePinnedComment: (commentId: string, nextAction: "pin" | "unpin") => Promise<void>
  onStartEdit: (commentId: string) => void
  onStopEdit: () => void
  canEditComment: (comment: ThreadEntry) => boolean
  getEditButtonLabel: (comment: ThreadEntry) => string
}

function CommentThreadReplyItem({
  reply,
  parentCommentId,
  pointName,
  canReply,
  currentUserId,
  isAdmin,
  adminRole,
  markdownEmojiMap,
  commentEditWindowMinutes,
  editingCommentId,
  hideFloatingActionButtons,
  onEnableReplyBox,
  onRunAdminAction,
  onStartEdit,
  onStopEdit,
  canEditComment,
  getEditButtonLabel,
}: {
  reply: SiteCommentReplyItem
  parentCommentId: string
  pointName?: string
  canReply: boolean
  currentUserId?: number
  isAdmin: boolean
  adminRole?: "ADMIN" | "MODERATOR" | null
  markdownEmojiMap?: MarkdownEmojiItem[]
  commentEditWindowMinutes: number
  editingCommentId: string | null
  hideFloatingActionButtons: boolean
  onEnableReplyBox: (target: CommentReplyTarget) => void
  onRunAdminAction: (action: string, targetId: string, extra?: Record<string, unknown>) => Promise<void>
  onStartEdit: (commentId: string) => void
  onStopEdit: () => void
  canEditComment: (comment: ThreadEntry) => boolean
  getEditButtonLabel: (comment: ThreadEntry) => string
}) {
  const canEditCurrentReply = canEditComment(reply)
  const isRestrictedReplyAuthor = reply.authorStatus === "BANNED" || reply.authorStatus === "MUTED"
  const shouldDimRestrictedReplyAuthor = !isAdmin && isRestrictedReplyAuthor
  const isHiddenReplyForViewer = !isAdmin && reply.status === "HIDDEN"
  const replyUnavailableMessage = getCommentUnavailableMessage({
    isAdmin,
    status: reply.status,
    authorStatus: reply.authorStatus,
  })
  const replyActions: CommentAdminAction[] = buildCommentAdminActions({
    entry: reply,
    isAdmin,
    adminRole,
  })

  return (
    <div
      id={`comment-${reply.id}`}
      className="group relative rounded-[18px] bg-secondary/[0.22] px-3 py-2.5 transition-[background-color,transform] duration-150 hover:bg-accent/55 sm:px-3.5"
    >
      <span aria-hidden="true" className="absolute -left-[14px] top-4 h-2 w-2 rounded-full bg-muted-foreground/30 sm:-left-[18px]" />
      <div className={cn(editingCommentId === reply.id ? "flex flex-col gap-2.5" : "flex items-start justify-between gap-2.5")}>
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Link href={`/users/${reply.authorUsername}`} className={cn("shrink-0", shouldDimRestrictedReplyAuthor && "grayscale")}>
            <UserAvatar name={reply.author} avatarPath={reply.authorAvatarPath} size="xs" isVip={reply.authorIsVip} vipLevel={reply.authorVipLevel} />
          </Link>
          <div className={cn("min-w-0 flex-1", shouldDimRestrictedReplyAuthor && "grayscale")}>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <VipNameTooltip isVip={reply.authorIsVip} level={reply.authorVipLevel}>
                <Link href={`/users/${reply.authorUsername}`} className={getVipNameClass(reply.authorIsVip, reply.authorVipLevel, { medium: true })}>{reply.author}</Link>
              </VipNameTooltip>
              <CommentAuthorIdentityBadges isPostAuthor={reply.isPostAuthor} authorRole={reply.authorRole} />
              <UserDisplayedBadges badges={reply.authorDisplayedBadges} compact appearance="plain" />
              {isRestrictedReplyAuthor ? <UserStatusBadge status={reply.authorStatus} compact /> : null}
              {reply.replyToAuthor ? <span className="rounded-full bg-background/75 px-1.5 py-0.5 text-[10px] text-muted-foreground/90">回复 @{reply.replyToAuthor}</span> : null}
              <span>·</span>
              <TimeTooltip value={reply.createdAtRaw}>
                <span>{reply.createdAt}</span>
              </TimeTooltip>
              {canEditCurrentReply && !isHiddenReplyForViewer ? (
                <button type="button" className="text-[11px] transition-colors hover:text-foreground" onClick={() => editingCommentId === reply.id ? onStopEdit() : onStartEdit(reply.id)}>
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
                  onCancel={onStopEdit}
                  markdownEmojiMap={markdownEmojiMap}
                  editWindowMinutes={commentEditWindowMinutes}
                />
              ) : (
                <>
                  {isAdmin ? <AdminCommentStatusNotice status={reply.status} /> : null}
                  {replyUnavailableMessage ? (
                    <CommentUnavailablePlaceholder message={replyUnavailableMessage} />
                  ) : (
                    <MarkdownContent content={reply.content} className="text-[13px] leading-6 text-foreground/90 dark:text-foreground/85 sm:text-sm sm:leading-7" markdownEmojiMap={markdownEmojiMap} />
                  )}
                  {!replyUnavailableMessage && (reply.rewardClaim || reply.rewardEffectFeedback) ? (
                    <div className="mt-2 flex items-center justify-start gap-2">
                      <CommentRewardBadge rewardClaim={reply.rewardClaim} pointName={pointName} />
                      {reply.rewardEffectFeedback ? <CommentRewardEffectBadge feedback={reply.rewardEffectFeedback} /> : null}
                    </div>
                  ) : null}
                </>
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
                onClick={() => onEnableReplyBox({ parentId: parentCommentId, replyToUserName: reply.author })}
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
                onClick={() => {
                  void onRunAdminAction(action.key, action.targetId, action.payload)
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
}

export function CommentThreadCommentItem({
  comment,
  index,
  pointName,
  canReply,
  currentUserId,
  canAcceptAnswer,
  isAdmin,
  adminRole,
  canPinComment,
  markdownEmojiMap,
  commentEditWindowMinutes,
  editingCommentId,
  pinningCommentId,
  submittingAnswerId,
  hideFloatingActionButtons,
  isExpanded,
  onToggleReplies,
  onEnableReplyBox,
  onAcceptAnswer,
  onRunAdminAction,
  onTogglePinnedComment,
  onStartEdit,
  onStopEdit,
  canEditComment,
  getEditButtonLabel,
}: CommentThreadCommentItemProps) {
  const visibleReplies = isExpanded ? comment.replies : comment.replies.slice(0, INITIAL_VISIBLE_REPLIES)
  const canAcceptCurrentComment = canAcceptAnswer && !comment.isAcceptedAnswer && currentUserId !== comment.authorId
  const canEditCurrentComment = canEditComment(comment)
  const isRestrictedCommentAuthor = comment.authorStatus === "BANNED" || comment.authorStatus === "MUTED"
  const shouldDimRestrictedCommentAuthor = !isAdmin && isRestrictedCommentAuthor
  const isHiddenCommentForViewer = !isAdmin && comment.status === "HIDDEN"
  const commentUnavailableMessage = getCommentUnavailableMessage({
    isAdmin,
    status: comment.status,
    authorStatus: comment.authorStatus,
  })
  const commentActions: CommentAdminAction[] = buildCommentAdminActions({
    entry: comment,
    isAdmin,
    adminRole,
    canPinComment,
    pinningCommentId,
  })

  return (
    <div id={`comment-${comment.id}`} className={index === 0 ? "group relative py-4" : "group relative border-t border-border/70 py-4"}>
      <div className={cn("text-sm text-muted-foreground", editingCommentId === comment.id ? "flex flex-col gap-2.5" : "flex items-start justify-between gap-2.5")}>
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Link href={`/users/${comment.authorUsername}`} className={cn("shrink-0", shouldDimRestrictedCommentAuthor && "grayscale")}>
            <UserAvatar name={comment.author} avatarPath={comment.authorAvatarPath} size="xs" isVip={comment.authorIsVip} vipLevel={comment.authorVipLevel} />
          </Link>
          <div className={cn("min-w-0 flex-1 space-y-1.5", shouldDimRestrictedCommentAuthor && "grayscale")}>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
              <UserVerificationBadge verification={comment.authorVerification ?? null} compact appearance="plain" />
              <VipNameTooltip isVip={comment.authorIsVip} level={comment.authorVipLevel}>
                <Link href={`/users/${comment.authorUsername}`} className={getVipNameClass(comment.authorIsVip, comment.authorVipLevel, { medium: true })}>{comment.author}</Link>
              </VipNameTooltip>
              <CommentAuthorIdentityBadges isPostAuthor={comment.isPostAuthor} authorRole={comment.authorRole} />
              <UserDisplayedBadges badges={comment.authorDisplayedBadges} compact appearance="plain" />
              {isRestrictedCommentAuthor ? <UserStatusBadge status={comment.authorStatus} compact /> : null}
              <span>·</span>
              <TimeTooltip value={comment.createdAtRaw}>
                <span>{comment.createdAt}</span>
              </TimeTooltip>
              {comment.isPinnedByAuthor ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">楼主置顶</span> : null}
              {comment.isAcceptedAnswer ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">已采纳答案</span> : null}
              {canEditCurrentComment && !isHiddenCommentForViewer ? (
                <button type="button" className="text-[11px] transition-colors hover:text-foreground" onClick={() => editingCommentId === comment.id ? onStopEdit() : onStartEdit(comment.id)}>
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
                onCancel={onStopEdit}
                markdownEmojiMap={markdownEmojiMap}
                editWindowMinutes={commentEditWindowMinutes}
              />
            ) : (
              <>
                {isAdmin ? <AdminCommentStatusNotice status={comment.status} /> : null}
                {commentUnavailableMessage ? (
                  <CommentUnavailablePlaceholder message={commentUnavailableMessage} />
                ) : (
                  <MarkdownContent content={comment.content} className="text-[13px] leading-6 text-foreground/90 dark:text-foreground/85 sm:text-sm sm:leading-7" markdownEmojiMap={markdownEmojiMap} />
                )}
                {!commentUnavailableMessage && (comment.rewardClaim || comment.rewardEffectFeedback) ? (
                  <div className="mt-2 flex items-center justify-start gap-2">
                    <CommentRewardBadge rewardClaim={comment.rewardClaim} pointName={pointName} />
                    {comment.rewardEffectFeedback ? <CommentRewardEffectBadge feedback={comment.rewardEffectFeedback} /> : null}
                  </div>
                ) : null}
              </>
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
                onClick={() => onEnableReplyBox({ parentId: comment.id, replyToUserName: comment.author })}
                className="transition-colors hover:text-foreground"
              >
                回复
              </button>
            ) : null}
            {canAcceptCurrentComment ? (
              <Button type="button" variant="outline" onClick={() => { void onAcceptAnswer(comment.id) }} disabled={Boolean(submittingAnswerId)} className="h-6 px-2 text-[11px]">
                {submittingAnswerId === comment.id ? "提交中..." : "采纳"}
              </Button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              void copyCommentPermalink(comment.id, comment.floor)
            }}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            title={`复制 #${comment.floor} 楼链接`}
            aria-label={`复制 #${comment.floor} 楼链接`}
          >
            #{comment.floor}
          </button>
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <div className="relative mt-3 space-y-2 pl-3 before:absolute before:bottom-1 before:left-0 before:top-1 before:w-px before:bg-gradient-to-b before:from-border before:via-border/70 before:to-transparent sm:pl-4">
          {visibleReplies.map((reply) => (
            <CommentThreadReplyItem
              key={reply.id}
              reply={reply}
              parentCommentId={comment.id}
              pointName={pointName}
              canReply={canReply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              adminRole={adminRole}
              markdownEmojiMap={markdownEmojiMap}
              commentEditWindowMinutes={commentEditWindowMinutes}
              editingCommentId={editingCommentId}
              hideFloatingActionButtons={hideFloatingActionButtons}
              onEnableReplyBox={onEnableReplyBox}
              onRunAdminAction={onRunAdminAction}
              onStartEdit={onStartEdit}
              onStopEdit={onStopEdit}
              canEditComment={canEditComment}
              getEditButtonLabel={getEditButtonLabel}
            />
          ))}

          {comment.replies.length > INITIAL_VISIBLE_REPLIES ? (
            <button type="button" title={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`} aria-label={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - INITIAL_VISIBLE_REPLIES} 条回复`} onClick={() => onToggleReplies(comment.id)} className="px-1 text-[11px] text-primary transition-opacity hover:opacity-80">
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
                    void onTogglePinnedComment(comment.id, "pin")
                    return
                  }
                  if (action.key === "comment.unpinByAuthor") {
                    void onTogglePinnedComment(comment.id, "unpin")
                    return
                  }
                  void onRunAdminAction(action.key, action.targetId, action.payload)
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
}
