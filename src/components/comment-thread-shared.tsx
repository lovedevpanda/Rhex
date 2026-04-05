"use client"

import type { RefObject } from "react"
import { Keyboard, Minimize2, Sparkles } from "lucide-react"

import { CommentForm } from "@/components/comment-form"
import { LevelIcon } from "@/components/level-icon"
import { PostRewardPoolIcon } from "@/components/post-list-shared"
import { toast } from "@/components/ui/toast"
import { Tooltip } from "@/components/ui/tooltip"
import type { SiteCommentItem, SiteCommentReplyItem } from "@/lib/comments"
import type { CommentReplyTarget } from "@/lib/comment-reply-box-events"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { PostRewardPoolEffectFeedback, PostRewardPoolEffectFeedbackBadge } from "@/lib/post-reward-effect-feedback"
import { cn } from "@/lib/utils"

type ThreadEntry = SiteCommentItem | SiteCommentReplyItem

export type CommentAdminAction = {
  key: string
  label: string
  targetId: string
  tone?: "danger"
  disabled?: boolean
  payload?: Record<string, unknown>
}

export function CommentIdentityBadge({ label, tooltip, tone = "neutral" }: { label: string; tooltip: string; tone?: "neutral" | "brand" }) {
  return (
    <Tooltip content={tooltip}>
      <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.08em]", tone === "brand" ? "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/12 dark:text-sky-200" : "border-border bg-background text-muted-foreground")}>
        {label}
      </span>
    </Tooltip>
  )
}

export function CommentAuthorIdentityBadges({ isPostAuthor, authorRole }: { isPostAuthor: boolean; authorRole: "USER" | "MODERATOR" | "ADMIN" }) {
  const adminBadge = authorRole === "ADMIN"
    ? { label: "Admin", tooltip: "管理员" }
    : authorRole === "MODERATOR"
      ? { label: "Mod", tooltip: "版主" }
      : null
  if (!isPostAuthor && !adminBadge) return null

  return (
    <span className="inline-flex items-center gap-1">
      {isPostAuthor ? <CommentIdentityBadge label="OP" tooltip="本贴作者" tone="brand" /> : null}
      {isPostAuthor && adminBadge ? <span className="text-[10px] text-muted-foreground/70">|</span> : null}
      {adminBadge ? <CommentIdentityBadge label={adminBadge.label} tooltip={adminBadge.tooltip} /> : null}
    </span>
  )
}

export function CommentRewardBadge({ rewardClaim, pointName = "积分" }: { rewardClaim?: SiteCommentItem["rewardClaim"] | SiteCommentReplyItem["rewardClaim"]; pointName?: string }) {
  if (!rewardClaim) return null
  const isJackpot = rewardClaim.rewardMode === "JACKPOT"

  return (
    <Tooltip content={`${isJackpot ? "聚宝盆" : "红包"}奖励 +${rewardClaim.amount} ${pointName}`}>
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none shadow-sm ring-1 ring-white/70 transition-transform duration-200 group-hover:-translate-y-0.5 motion-safe:animate-pulse", isJackpot ? "border-amber-200 bg-amber-50 text-amber-700 shadow-amber-100/80 dark:border-amber-400/20 dark:bg-amber-500/12 dark:text-amber-200" : "border-rose-200 bg-rose-50 text-rose-600 shadow-rose-100/80 dark:border-rose-400/20 dark:bg-rose-500/12 dark:text-rose-200")}>
        <PostRewardPoolIcon mode={rewardClaim.rewardMode} className="h-3.5 w-3.5" />
        <span>+{rewardClaim.amount}</span>
      </span>
    </Tooltip>
  )
}

export function CommentRewardEffectBadge({ feedback }: { feedback: PostRewardPoolEffectFeedback }) {
  const primaryEvent = feedback.events[0]
  if (!primaryEvent) return null
  const badges = feedback.badges && feedback.badges.length > 0
    ? feedback.badges
    : [{ name: feedback.badgeName, iconText: feedback.badgeIconText, color: feedback.badgeColor }]
      .filter((badge) => badge.name || badge.iconText) as PostRewardPoolEffectFeedbackBadge[]
  const badgeMap = new Map(badges.map((badge) => [badge.name, badge] as const))
  const visibleBadges = badges.slice(0, 2)
  const headline = badges.length > 0
    ? badges.map((badge) => badge.name || "勋章特效").join(" + ")
    : "勋章特效"

  return (
    <Tooltip
      content={(
        <div className="space-y-2.5">
          <div className="space-y-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold leading-4 text-foreground">{headline}</p>
              <p className="text-[10px] leading-4 text-muted-foreground">这次回复触发了勋章效果</p>
            </div>
           
          </div>
          <div className="space-y-2">
            {feedback.events.map((event, index) => (
              <div key={`${event.kind}-${event.tone}-${index}`} className={cn("rounded-xl border px-3 py-2", event.tone === "positive" ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-rose-200/80 bg-rose-50/80 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200")}>
                <p className="text-[11px] font-semibold leading-4">{event.title}</p>
                <p className="mt-1 text-[11px] leading-5 opacity-90">
                  {event.badgeNames && event.badgeNames.length > 0 ? (
                    <span className="mr-1.5 inline-flex items-center align-middle">
                      <span className="relative mr-1 inline-flex h-4 w-6 items-center">
                        {event.badgeNames
                          .map((name) => badgeMap.get(name) ?? null)
                          .filter((badge): badge is PostRewardPoolEffectFeedbackBadge => Boolean(badge))
                          .slice(0, 2)
                          .map((badge, badgeIndex) => (
                            <span
                              key={`${badge.name ?? "badge"}-${badge.iconText ?? "icon"}-${badgeIndex}`}
                              className={cn(
                                "absolute inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/80 bg-white text-[12px] shadow-sm dark:border-slate-950 dark:bg-slate-900",
                                badgeIndex === 0 ? "left-0 z-[2]" : "left-2 z-[1]",
                              )}
                              style={badge.color ? { color: badge.color } : undefined}
                            >
                              <LevelIcon icon={badge.iconText} color={badge.color ?? undefined} className="h-3 w-3 text-[10px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                            </span>
                          ))}
                      </span>
                      <span>{event.badgeNames.join(" + ")}:</span>
                    </span>
                  ) : null}
                  {event.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      contentClassName="max-w-[320px]"
    >
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold leading-none text-sky-700 shadow-sm dark:border-sky-900/80 dark:bg-sky-950/45 dark:text-sky-300 dark:shadow-none">
        <span className="relative inline-flex h-4 w-6 items-center">
          {visibleBadges.map((badge, index) => (
            <span
              key={`${badge.name ?? "badge"}-${badge.iconText ?? "icon"}-${index}`}
              className={cn(
                "absolute inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/80 bg-white text-[12px] shadow-sm dark:border-slate-950 dark:bg-slate-900",
                index === 0 ? "left-0 z-[2]" : "left-2 z-[1]",
              )}
              style={badge.color ? { color: badge.color } : undefined}
            >
              <LevelIcon icon={badge.iconText} color={badge.color ?? undefined} className="h-3.5 w-3.5 text-[12px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
            </span>
          ))}
        </span>
        <Sparkles className="h-3 w-3" />
        <span>{primaryEvent.title}</span>
      </span>
    </Tooltip>
  )
}

export function getCommentUnavailableMessage(params: { isAdmin: boolean; status: SiteCommentItem["status"] | SiteCommentReplyItem["status"]; authorStatus: SiteCommentItem["authorStatus"] | SiteCommentReplyItem["authorStatus"] }) {
  if (params.isAdmin) return null
  if (params.status === "HIDDEN") return "该评论可能因违反社区规定被下线😞"
  if (params.authorStatus === "MUTED" || params.authorStatus === "BANNED") return "该用户因违反社区规定已被禁言/封禁😞"
  return null
}

export function CommentUnavailablePlaceholder({ message }: { message: string }) {
  return <div className="flex min-h-24 items-center justify-center rounded-2xl bg-secondary/35 px-4 py-5 text-center text-[13px] leading-6 text-muted-foreground sm:min-h-28 sm:text-sm">{message}</div>
}

export function AdminCommentStatusNotice({ status }: { status: SiteCommentItem["status"] | SiteCommentReplyItem["status"] }) {
  if (status !== "HIDDEN") return null
  return <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] leading-5 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">该评论已下线，仅管理员可见</div>
}

export function buildCommentAdminActions({ entry, isAdmin, adminRole, canPinComment = false, pinningCommentId = null }: { entry: ThreadEntry; isAdmin: boolean; adminRole?: "ADMIN" | "MODERATOR" | null; canPinComment?: boolean; pinningCommentId?: string | null }) {
  const actions: CommentAdminAction[] = []
  const canModerateEntryAuthor = adminRole === "ADMIN" || entry.authorRole === "USER"
  if (canPinComment && "isPinnedByAuthor" in entry) {
    actions.push({ key: entry.isPinnedByAuthor ? "comment.unpinByAuthor" : "comment.pinByAuthor", label: pinningCommentId === entry.id ? "处理中..." : entry.isPinnedByAuthor ? "取消置顶" : "置顶评论", targetId: entry.id, disabled: pinningCommentId === entry.id })
  }
  if (!isAdmin) return actions
  if (entry.status === "HIDDEN") {
    actions.push({ key: "comment.show", label: "上线评论", targetId: entry.id })
    if (entry.authorStatus === "BANNED" && adminRole === "ADMIN") actions.push({ key: "user.activate", label: "解除封禁", targetId: String(entry.authorId), payload: { commentId: entry.id } })
    if (entry.authorStatus === "MUTED" && canModerateEntryAuthor) actions.push({ key: "user.activate", label: "解除禁言", targetId: String(entry.authorId), payload: { commentId: entry.id } })
    return actions
  }
  actions.push({ key: "comment.hide", label: "下线评论", tone: "danger", targetId: entry.id })
  if (entry.authorStatus === "BANNED") {
    if (adminRole === "ADMIN") actions.push({ key: "user.activate", label: "解除封禁", targetId: String(entry.authorId), payload: { commentId: entry.id } })
    return actions
  }
  if (entry.authorStatus === "MUTED") {
    if (canModerateEntryAuthor) actions.push({ key: "user.activate", label: "解除禁言", targetId: String(entry.authorId), payload: { commentId: entry.id } })
    if (adminRole === "ADMIN") actions.push({ key: "user.ban", label: "封禁用户", tone: "danger", targetId: String(entry.authorId), payload: { commentId: entry.id } })
    return actions
  }
  if (canModerateEntryAuthor) actions.push({ key: "user.mute", label: "禁言用户", targetId: String(entry.authorId), payload: { commentId: entry.id } })
  if (adminRole === "ADMIN") actions.push({ key: "user.ban", label: "封禁用户", tone: "danger", targetId: String(entry.authorId), payload: { commentId: entry.id } })
  return actions
}

export async function copyCommentPermalink(commentId: string, floor: number) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.hash = `comment-${commentId}`

  try {
    await navigator.clipboard.writeText(url.toString())
    toast.success(`已复制 #${floor} 楼链接`, "复制成功")
  } catch {
    toast.error("复制失败，请手动复制", "复制失败")
  }
}

export function CommentThreadReplyBox({ postId, commentsVisibleToAuthorOnly, markdownEmojiMap, replyTarget, replyHint, isReplyBoxPinned, isReplyBoxFollowing, replyBoxPinnedLayout, replyBoxContainerRef, onDisableReplyBox, onClearReplyTarget }: { postId: string; commentsVisibleToAuthorOnly: boolean; markdownEmojiMap?: MarkdownEmojiItem[]; replyTarget: CommentReplyTarget | null; replyHint: string | null; isReplyBoxPinned: boolean; isReplyBoxFollowing: boolean; replyBoxPinnedLayout: { left: number; width: number }; replyBoxContainerRef: RefObject<HTMLDivElement | null>; onDisableReplyBox: () => void; onClearReplyTarget: () => void }) {
  return (
    <div id="post-comment-reply-box" data-comment-reply-box="true" data-ignore-reply-shortcut="true" ref={replyBoxContainerRef} className="relative">
      {isReplyBoxPinned && isReplyBoxFollowing ? <div aria-hidden="true" className="h-[22rem] sm:h-[24rem]" /> : null}
      <div className={cn("rounded-[24px] bg-card", isReplyBoxPinned && isReplyBoxFollowing && "fixed bottom-3 z-50 bg-transparent shadow-[0_-12px_36px_rgba(15,23,42,0.12)]")} style={isReplyBoxPinned && isReplyBoxFollowing ? { left: replyBoxPinnedLayout.left || undefined, width: replyBoxPinnedLayout.width || undefined } : undefined}>
        {isReplyBoxPinned ? (
          <div className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs text-muted-foreground", isReplyBoxFollowing ? "bg-card" : "bg-transparent")}>
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" />
              按 <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">R</kbd> 或 <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">Esc</kbd> 退出固定
            </span>
            <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-foreground transition-colors hover:bg-accent" onClick={onDisableReplyBox}>
              <Minimize2 className="h-3.5 w-3.5" />
              收起固定
            </button>
          </div>
        ) : null}
        {replyHint ? (
          <div className={cn("flex items-center justify-between gap-3 rounded-[16px] border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground", isReplyBoxPinned && "border-transparent bg-background/94 backdrop-blur-md")}>
            <span>{replyHint}</span>
            <button type="button" className="text-primary transition-opacity hover:opacity-80" onClick={onClearReplyTarget}>改为普通回复</button>
          </div>
        ) : null}
        <CommentForm postId={postId} parentId={replyTarget?.parentId} replyToUserName={replyTarget?.replyToUserName} onCancel={onClearReplyTarget} commentsVisibleToAuthorOnly={commentsVisibleToAuthorOnly} markdownEmojiMap={markdownEmojiMap} />
      </div>
    </div>
  )
}
