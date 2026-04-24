"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { CornerDownRight, Flag } from "lucide-react"

import { AddonSurfaceClientRenderer } from "@/addons-host/client/addon-surface-client-renderer"
import { AiAgentIndicator } from "@/components/user/ai-agent-indicator"
import { AnonymousUserIndicator } from "@/components/user/anonymous-user-indicator"
import { CommentForm } from "@/components/comment/comment-form"
import { CommentLikeButton } from "@/components/comment/comment-like-button"
import { AdminCommentStatusNotice, buildCommentAdminActions, CommentAuthorIdentityBadges, CommentJackpotDepositBadge, CommentReviewStatusNotice, CommentRewardBadge, CommentRewardEffectBadge, CommentUnavailablePlaceholder, copyCommentPermalink, getCommentUnavailableMessage, type CommentAdminAction } from "@/components/comment/comment-thread-shared"
import { MarkdownContent } from "@/components/markdown-content"
import { ReportDialog } from "@/components/post/report-dialog"
import { TimeTooltip } from "@/components/time-tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserDisplayedBadges } from "@/components/user/user-displayed-badges"
import { UserProfilePreviewCardTrigger } from "@/components/user/user-profile-preview-card-trigger"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { UserVerificationBadge } from "@/components/user/user-verification-badge"
import { VipDisplayName } from "@/components/vip/vip-display-name"
import { Button } from "@/components/ui/rbutton"
import type { SiteCommentItem, SiteCommentReplyItem } from "@/lib/comments"
import type { CommentReplyTarget } from "@/lib/comment-reply-box-events"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"

type ThreadEntry = SiteCommentItem | SiteCommentReplyItem
export type CommentThreadReplyLayout = "tree" | "flat"
type CommentThreadEntryType = "comment" | "reply"

interface CommentThreadCommentItemProps {
  comment: SiteCommentItem
  index: number
  postPath: string
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
  highlightedCommentId?: string | null
  isExpanded: boolean
  initialVisibleReplies: number
  onToggleReplies: (commentId: string) => void
  onEnableReplyBox: (target: CommentReplyTarget) => void
  onAcceptAnswer: (commentId: string) => Promise<void>
  onRunAdminAction: (action: string, targetId: string, extra?: Record<string, unknown>) => Promise<void>
  onTogglePinnedComment: (commentId: string, nextAction: "pin" | "unpin") => Promise<void>
  onStartEdit: (commentId: string) => void
  onStopEdit: () => void
  canEditComment: (comment: ThreadEntry) => boolean
  getEditButtonLabel: (comment: ThreadEntry) => string
  renderReplies?: boolean
  isHighlighted?: boolean
}

interface CommentThreadReplyItemProps {
  reply: SiteCommentReplyItem
  postPath: string
  parentCommentId: string
  parentCommentFloor?: number
  referenceCommentId?: string
  parentCommentHref?: string
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
  layout?: CommentThreadReplyLayout
  isHighlighted?: boolean
  onJumpToParentComment?: (commentId: string, href?: string) => void
}

interface CommentAuthorSurfaceProps<TEntry extends ThreadEntry = ThreadEntry> {
  entryType: CommentThreadEntryType
  entry: TEntry
  authorHref: string
  authorNameClassName: string
  isRestrictedAuthor: boolean
  shouldDimRestrictedAuthor: boolean
  showVerification: boolean
}

interface CommentAuthorMetaSurfaceProps<TEntry extends ThreadEntry = ThreadEntry>
  extends CommentAuthorSurfaceProps<TEntry> {
  showEditButton: boolean
  editButtonLabel: string
  onToggleEdit: () => void
}

interface CommentAuthorRowSurfaceProps<TEntry extends ThreadEntry = ThreadEntry>
  extends CommentAuthorMetaSurfaceProps<TEntry> {
  bodyContent?: ReactNode
}

function CommentAuthorVerificationContent({
  entry,
  showVerification,
}: CommentAuthorSurfaceProps) {
  if (!showVerification) {
    return null
  }

  return (
    <UserVerificationBadge
      verification={entry.authorVerification ?? null}
      compact
      appearance="plain"
    />
  )
}

function CommentAuthorNameContent({
  entry,
  authorHref,
  authorNameClassName,
}: CommentAuthorSurfaceProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <Link href={authorHref} className={authorNameClassName} title={entry.author}>
        <VipDisplayName
          name={entry.author}
          isVip={entry.authorIsVip}
          vipLevel={entry.authorVipLevel}
          emphasize={Boolean(entry.authorIsVip)}
          interactive={false}
        />
      </Link>
      {entry.authorIsAnonymous ? <AnonymousUserIndicator /> : null}
      {entry.authorIsAiAgent ? <AiAgentIndicator /> : null}
    </span>
  )
}

function CommentAuthorBadgesContent({ entry }: CommentAuthorSurfaceProps) {
  return (
    <UserDisplayedBadges
      badges={entry.authorDisplayedBadges}
      compact
      appearance="plain"
    />
  )
}

function CommentAuthorMetaContent({
  entry,
  authorHref,
  authorNameClassName,
  entryType,
  isRestrictedAuthor,
  shouldDimRestrictedAuthor,
  showVerification,
  showEditButton,
  editButtonLabel,
  onToggleEdit,
}: CommentAuthorMetaSurfaceProps) {
  const sharedProps = {
    entry,
    entryType,
    authorHref,
    authorNameClassName,
    isRestrictedAuthor,
    shouldDimRestrictedAuthor,
    showVerification,
  } satisfies CommentAuthorSurfaceProps

  const replyToAuthor =
    entryType === "reply" && "replyToAuthor" in entry ? entry.replyToAuthor : null
  const showPendingBadge = entry.status === "PENDING"
  const showPinnedBadge =
    entryType === "comment" && "isPinnedByAuthor" in entry && entry.isPinnedByAuthor
  const showAcceptedAnswerBadge =
    entryType === "comment" && "isAcceptedAnswer" in entry && entry.isAcceptedAnswer

  return (
    <AddonSurfaceClientRenderer
      surface="comment.author.meta"
      surfaceProps={{
        ...sharedProps,
        showEditButton,
        editButtonLabel,
        onToggleEdit,
      }}
      fallback={(
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
          <AddonSurfaceClientRenderer
            surface="comment.author.verification"
            surfaceProps={sharedProps}
            fallback={<CommentAuthorVerificationContent {...sharedProps} />}
          />
          <AddonSurfaceClientRenderer
            surface="comment.author.name"
            surfaceProps={sharedProps}
            fallback={<CommentAuthorNameContent {...sharedProps} />}
          />
          <CommentAuthorIdentityBadges
            isPostAuthor={entry.isPostAuthor}
            authorRole={entry.authorRole}
          />
          <AddonSurfaceClientRenderer
            surface="comment.author.badges"
            surfaceProps={sharedProps}
            fallback={<CommentAuthorBadgesContent {...sharedProps} />}
          />
          {isRestrictedAuthor ? (
            <UserStatusBadge status={entry.authorStatus} compact />
          ) : null}
          {replyToAuthor ? (
            <span className="rounded-full bg-background/75 px-1.5 py-0.5 text-[10px] text-muted-foreground/90">
              回复 @{replyToAuthor}
            </span>
          ) : null}
          <span>·</span>
          <TimeTooltip value={entry.createdAtRaw}>
            <span>{entry.createdAt}</span>
          </TimeTooltip>
          {showPendingBadge ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
              待审核
            </span>
          ) : null}
          {showPinnedBadge ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
              楼主置顶
            </span>
          ) : null}
          {showAcceptedAnswerBadge ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
              已采纳答案
            </span>
          ) : null}
          {showEditButton ? (
            <button
              type="button"
              className="text-[11px] transition-colors hover:text-foreground"
              onClick={onToggleEdit}
            >
              {editButtonLabel}
            </button>
          ) : null}
        </div>
      )}
    />
  )
}

function CommentAuthorRowContent({
  entry,
  authorHref,
  authorNameClassName,
  entryType,
  isRestrictedAuthor,
  shouldDimRestrictedAuthor,
  showVerification,
  showEditButton,
  editButtonLabel,
  onToggleEdit,
  bodyContent,
}: CommentAuthorRowSurfaceProps) {
  return (
    <AddonSurfaceClientRenderer
      surface="comment.author.row"
      surfaceProps={{
        entry,
        entryType,
        authorHref,
        authorNameClassName,
        isRestrictedAuthor,
        shouldDimRestrictedAuthor,
        showVerification,
        showEditButton,
        editButtonLabel,
        onToggleEdit,
        bodyContent,
      }}
      fallback={(
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <UserProfilePreviewCardTrigger
            username={entry.authorUsername}
            displayName={entry.author}
            avatarPath={entry.authorAvatarPath}
            isVip={entry.authorIsVip}
            vipLevel={entry.authorVipLevel}
            triggerClassName={cn("shrink-0", shouldDimRestrictedAuthor && "grayscale")}
            align="start"
          >
            <UserAvatar
              name={entry.author}
              avatarPath={entry.authorAvatarPath}
              size="xs"
              isVip={entry.authorIsVip}
              vipLevel={entry.authorVipLevel}
            />
          </UserProfilePreviewCardTrigger>
          <div
            className={cn(
              "min-w-0 flex-1",
              bodyContent && (entryType === "comment" ? "space-y-1.5" : "space-y-2.5"),
              shouldDimRestrictedAuthor && "grayscale",
            )}
          >
            <CommentAuthorMetaContent
              entry={entry}
              entryType={entryType}
              authorHref={authorHref}
              authorNameClassName={authorNameClassName}
              isRestrictedAuthor={isRestrictedAuthor}
              shouldDimRestrictedAuthor={shouldDimRestrictedAuthor}
              showVerification={showVerification}
              showEditButton={showEditButton}
              editButtonLabel={editButtonLabel}
              onToggleEdit={onToggleEdit}
            />
            {bodyContent}
          </div>
        </div>
      )}
    />
  )
}

function CommentAdminActionMenu({
  actions,
  disabled,
  onSelect,
}: {
  actions: CommentAdminAction[]
  disabled?: boolean
  onSelect: (action: CommentAdminAction) => void
}) {
  const [open, setOpen] = useState(false)

  if (actions.length === 0) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        管理
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-auto max-w-[min(22rem,calc(100vw-1.5rem))] flex-row flex-wrap justify-end gap-1.5 rounded-2xl p-1.5"
      >
        {actions.map((action) => (
          <Button
            key={action.key}
            type="button"
            variant="outline"
            disabled={action.disabled}
            className={action.tone === "danger" ? "h-6 border-red-200 px-2 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60" : "h-6 px-2 text-[11px] disabled:opacity-60"}
            onClick={() => {
              if (action.disabled) {
                return
              }

              setOpen(false)
              onSelect(action)
            }}
          >
            {action.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function CommentThreadReplyItem({
  reply,
  postPath,
  parentCommentId,
  referenceCommentId,
  parentCommentHref,
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
  layout = "tree",
  isHighlighted = false,
  onJumpToParentComment,
}: CommentThreadReplyItemProps) {
  const canEditCurrentReply = canEditComment(reply)
  const isRestrictedReplyAuthor = reply.authorStatus === "BANNED" || reply.authorStatus === "MUTED"
  const shouldDimRestrictedReplyAuthor = !isAdmin && isRestrictedReplyAuthor
  const isHiddenReplyForViewer = !isAdmin && reply.status === "HIDDEN"
  const isFlatLayout = layout === "flat"
  const replyAuthorNameClassName = "truncate hover:underline"
  const replyAuthorHref = `/users/${reply.authorUsername}`
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
  const replyRewardBadges = !replyUnavailableMessage && (reply.rewardClaim || reply.rewardEffectFeedback) ? (
    <>
      <CommentRewardBadge rewardClaim={reply.rewardClaim} pointName={pointName} />
      {reply.rewardEffectFeedback ? <CommentRewardEffectBadge feedback={reply.rewardEffectFeedback} /> : null}
      <CommentJackpotDepositBadge feedback={reply.rewardEffectFeedback} pointName={pointName} />
    </>
  ) : null

  return (
    <div
      id={`comment-${reply.id}`}
      className={cn(
        "group relative scroll-mt-20 sm:scroll-mt-24",
        isHighlighted && "rounded-[18px] bg-amber-50/70 ring-2 ring-amber-300/70 ring-offset-2 ring-offset-background dark:bg-amber-500/10 dark:ring-amber-400/40",
        isFlatLayout
          ? "border-t border-dashed border-border/70 py-3"
          : "rounded-[18px] bg-secondary/22 px-3 py-2.5 transition-[background-color,transform] duration-150 hover:bg-accent/55 sm:px-3.5",
      )}
    >
      {!isFlatLayout ? <span aria-hidden="true" className="absolute -left-[14px] top-4 h-2 w-2 rounded-full bg-muted-foreground/30 sm:-left-[18px]" /> : null}
      <div>
        <CommentAuthorRowContent
          entry={reply}
          entryType="reply"
          authorHref={replyAuthorHref}
          authorNameClassName={replyAuthorNameClassName}
          isRestrictedAuthor={isRestrictedReplyAuthor}
          shouldDimRestrictedAuthor={shouldDimRestrictedReplyAuthor}
          showVerification
          showEditButton={canEditCurrentReply && !isHiddenReplyForViewer}
          editButtonLabel={getEditButtonLabel(reply)}
          onToggleEdit={() => editingCommentId === reply.id ? onStopEdit() : onStartEdit(reply.id)}
          bodyContent={(
            <>
              <div className="min-w-0">
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
                    <CommentReviewStatusNotice status={reply.status} reviewNote={reply.reviewNote} isAdmin={isAdmin} isOwner={canEditCurrentReply} />
                    {isFlatLayout && (reply.replyToCommentExcerpt ?? reply.parentCommentExcerpt) ? (
                      <div className="mb-2.5 flex items-center gap-2">
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                        <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-secondary/30 px-3 py-2.5 text-[12px] leading-5 text-muted-foreground">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-foreground/80">{reply.replyToCommentAuthor ?? reply.parentCommentAuthor ? `回复 @${reply.replyToCommentAuthor ?? reply.parentCommentAuthor}` : "回复原评论"}</span>
                            {referenceCommentId ?? parentCommentId ? (
                              <button
                                type="button"
                                onClick={() => onJumpToParentComment?.(referenceCommentId ?? parentCommentId, parentCommentHref)}
                                className="rounded-full border border-transparent bg-transparent px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground focus-visible:border-border focus-visible:bg-background focus-visible:text-foreground"
                              >
                                查看原文
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1.5 line-clamp-2">{reply.replyToCommentExcerpt ?? reply.parentCommentExcerpt}</p>
                        </div>
                      </div>
                    ) : null}
                    {replyUnavailableMessage ? (
                      <CommentUnavailablePlaceholder message={replyUnavailableMessage} />
                    ) : (
                      <MarkdownContent content={reply.content} className="text-[13px] leading-6 text-foreground/90 dark:text-foreground/85 sm:text-sm sm:leading-7" markdownEmojiMap={markdownEmojiMap} />
                    )}
                  </>
                )}
              </div>

              <div className={cn("flex w-full items-center gap-2 text-[11px] text-muted-foreground", editingCommentId === reply.id && "border-t border-border/50 pt-2")}>
                <CommentLikeButton commentId={reply.id} initialCount={reply.likes} initialLiked={reply.viewerLiked} />
                {replyRewardBadges ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{replyRewardBadges}</div> : <div className="min-w-0 flex-1" />}

                
                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                  {!hideFloatingActionButtons && replyActions.length > 0 ? (
                    <CommentAdminActionMenu
                      actions={replyActions}
                      disabled={editingCommentId === reply.id}
                      onSelect={(action) => {
                        void onRunAdminAction(action.key, action.targetId, action.payload)
                      }}
                    />
                  ) : null}
                  {canReply ? (
                    <button
                      type="button"
                      onClick={() => onEnableReplyBox({ parentId: parentCommentId, replyToUserName: reply.author, replyToCommentId: reply.id })}
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
                  {isFlatLayout && reply.flatFloor ? (
                    <button
                      type="button"
                      onClick={() => {
                        void copyCommentPermalink(reply.id, reply.flatFloor!, postPath)
                      }}
                      className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                      title={`复制 #${reply.flatFloor} 楼链接`}
                      aria-label={`复制 #${reply.flatFloor} 楼链接`}
                    >
                      #{reply.flatFloor}
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          )}
        />
      </div>
    </div>
  )
}

export function CommentThreadCommentItem({
  comment,
  index,
  postPath,
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
  highlightedCommentId = null,
  isExpanded,
  initialVisibleReplies,
  onToggleReplies,
  onEnableReplyBox,
  onAcceptAnswer,
  onRunAdminAction,
  onTogglePinnedComment,
  onStartEdit,
  onStopEdit,
  canEditComment,
  getEditButtonLabel,
  renderReplies = true,
  isHighlighted = false,
}: CommentThreadCommentItemProps) {
  const visibleReplies = isExpanded ? comment.replies : comment.replies.slice(0, initialVisibleReplies)
  const canAcceptCurrentComment = canAcceptAnswer && !comment.isAcceptedAnswer && currentUserId !== comment.authorId
  const canEditCurrentComment = canEditComment(comment)
  const isRestrictedCommentAuthor = comment.authorStatus === "BANNED" || comment.authorStatus === "MUTED"
  const shouldDimRestrictedCommentAuthor = !isAdmin && isRestrictedCommentAuthor
  const isHiddenCommentForViewer = !isAdmin && comment.status === "HIDDEN"
  const commentAuthorNameClassName = "truncate hover:underline"
  const commentAuthorHref = `/users/${comment.authorUsername}`
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
  const commentRewardBadges = !commentUnavailableMessage && (comment.rewardClaim || comment.rewardEffectFeedback) ? (
    <>
      <CommentRewardBadge rewardClaim={comment.rewardClaim} pointName={pointName} />
      {comment.rewardEffectFeedback ? <CommentRewardEffectBadge feedback={comment.rewardEffectFeedback} /> : null}
      <CommentJackpotDepositBadge feedback={comment.rewardEffectFeedback} pointName={pointName} />
    </>
  ) : null

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        index === 0 ? "group relative scroll-mt-20 py-4 sm:scroll-mt-24" : "group relative scroll-mt-20 border-t border-border/70 py-4 sm:scroll-mt-24",
        isHighlighted && "rounded-xl bg-amber-50/70 ring-2 ring-amber-300/70 ring-offset-2 ring-offset-background dark:bg-amber-500/10 dark:ring-amber-400/40",
      )}
    >
      <div className="text-sm text-muted-foreground">
        <CommentAuthorRowContent
          entry={comment}
          entryType="comment"
          authorHref={commentAuthorHref}
          authorNameClassName={commentAuthorNameClassName}
          isRestrictedAuthor={isRestrictedCommentAuthor}
          shouldDimRestrictedAuthor={shouldDimRestrictedCommentAuthor}
          showVerification
          showEditButton={canEditCurrentComment && !isHiddenCommentForViewer}
          editButtonLabel={getEditButtonLabel(comment)}
          onToggleEdit={() => editingCommentId === comment.id ? onStopEdit() : onStartEdit(comment.id)}
          bodyContent={(
            <>
              <div className="min-w-0">
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
                    <CommentReviewStatusNotice status={comment.status} reviewNote={comment.reviewNote} isAdmin={isAdmin} isOwner={canEditCurrentComment} />
                    {commentUnavailableMessage ? (
                      <CommentUnavailablePlaceholder message={commentUnavailableMessage} />
                    ) : (
                      <MarkdownContent content={comment.content} className="text-[13px] leading-6 text-foreground/90 dark:text-foreground/85 sm:text-sm sm:leading-7" markdownEmojiMap={markdownEmojiMap} />
                    )}
                  </>
                )}
              </div>

              <div className={cn("flex w-full items-center gap-2 text-[11px] text-muted-foreground sm:text-xs", editingCommentId === comment.id && "border-t border-border/60 pt-2")}>
                <CommentLikeButton commentId={comment.id} initialCount={comment.likes} initialLiked={comment.viewerLiked} />
                {commentRewardBadges ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{commentRewardBadges}</div> : <div className="min-w-0 flex-1" />}
                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                  {!hideFloatingActionButtons && commentActions.length > 0 ? (
                    <CommentAdminActionMenu
                      actions={commentActions}
                      disabled={editingCommentId === comment.id}
                      onSelect={(action) => {
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
                    />
                  ) : null}
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
                      onClick={() => onEnableReplyBox({ parentId: comment.id, replyToUserName: comment.author, replyToCommentId: comment.id })}
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
                  <button
                    type="button"
                    onClick={() => {
                      void copyCommentPermalink(comment.id, comment.floor, postPath)
                    }}
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                    title={`复制 #${comment.floor} 楼链接`}
                    aria-label={`复制 #${comment.floor} 楼链接`}
                  >
                    #{comment.floor}
                  </button>
                </div>
              </div>

              {renderReplies && comment.replies.length > 0 ? (
                <div className="relative space-y-2 pl-3 before:absolute before:bottom-1 before:left-0 before:top-1 before:w-px before:bg-linear-to-b before:from-border before:via-border/70 before:to-transparent sm:pl-4">
                  {visibleReplies.map((reply) => (
                    <CommentThreadReplyItem
                      key={reply.id}
                      reply={reply}
                      postPath={postPath}
                      parentCommentId={comment.id}
                      parentCommentFloor={comment.floor}
                      parentCommentHref={`?sort=oldest&page=1&view=tree#comment-${comment.id}`}
                      pointName={pointName}
                      canReply={canReply}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      adminRole={adminRole}
                      markdownEmojiMap={markdownEmojiMap}
                      commentEditWindowMinutes={commentEditWindowMinutes}
                      editingCommentId={editingCommentId}
                      hideFloatingActionButtons={hideFloatingActionButtons}
                      isHighlighted={highlightedCommentId === reply.id}
                      onEnableReplyBox={onEnableReplyBox}
                      onRunAdminAction={onRunAdminAction}
                      onStartEdit={onStartEdit}
                      onStopEdit={onStopEdit}
                      canEditComment={canEditComment}
                      getEditButtonLabel={getEditButtonLabel}
                    />
                  ))}

                  {comment.replies.length > initialVisibleReplies ? (
                    <button type="button" title={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - initialVisibleReplies} 条回复`} aria-label={isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - initialVisibleReplies} 条回复`} onClick={() => onToggleReplies(comment.id)} className="px-1 text-[11px] text-primary transition-opacity hover:opacity-80">
                      {isExpanded ? "折叠回复" : `展开其余 ${comment.replies.length - initialVisibleReplies} 条回复`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        />
      </div>
    </div>
  )
}
