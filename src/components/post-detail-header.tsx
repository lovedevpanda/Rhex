import Link from "next/link"
import { ChevronDown, ChevronRight, Eye } from "lucide-react"

import { AnonymousUserIndicator } from "@/components/anonymous-user-indicator"
import { FollowToggleButton } from "@/components/follow-toggle-button"
import { LevelIcon } from "@/components/level-icon"
import { TimeTooltip } from "@/components/time-tooltip"
import { UserAvatar } from "@/components/user-avatar"
import { UserDisplayedBadges, type DisplayedBadgeItem } from "@/components/user-displayed-badges"
import { UserStatusBadge } from "@/components/user-status-badge"
import { UserVerificationBadge, type UserVerificationBadgeItem } from "@/components/user-verification-badge"
import { VipNameTooltip } from "@/components/vip-name-tooltip"
import { cn } from "@/lib/utils"
import { getVipNameClass } from "@/lib/vip-status"

interface PostDetailHeaderProps {
  post: {
    id: string
    title: string
    board: string
    boardSlug?: string
    boardIcon?: string
    author: string
    authorUsername?: string
    isAnonymous?: boolean
    authorAvatarPath?: string | null
    authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    authorIsVip?: boolean
    authorVipLevel?: number | null
    authorVerification?: UserVerificationBadgeItem | null
    authorDisplayedBadges?: DisplayedBadgeItem[]
    publishedAt: string
    publishedAtRaw?: string
    type?: string
    typeLabel: string
    isPinned: boolean
    isFeatured: boolean
    stats: {
      views: number
    }
  }
  isFollowingPost: boolean
  isRestrictedAuthor: boolean
  zone?: {
    slug: string
    name: string
  } | null
  zoneBoards?: Array<{
    slug: string
    name: string
    icon?: string
    count?: number
  }>
}

function PostStateBadges({ type, typeLabel, isPinned, isFeatured }: { type?: string; typeLabel: string; isPinned: boolean; isFeatured: boolean }) {
  if (type === "NORMAL" && !isPinned && !isFeatured) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {type !== "NORMAL" ? <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:px-2 sm:text-[11px]">{typeLabel}</span> : null}
      {isPinned ? <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 dark:bg-orange-500/15 dark:text-orange-200 sm:px-2 sm:text-[11px]">置顶</span> : null}
      {isFeatured ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 sm:px-2 sm:text-[11px]">精华</span> : null}
    </div>
  )
}

function getTitleClassName(post: PostDetailHeaderProps["post"]) {
  if (post.isFeatured) {
    return "text-[17px] font-semibold leading-7 text-emerald-700 sm:text-[21px] sm:leading-8 dark:text-emerald-300"
  }

  if (post.isPinned) {
    return "text-[17px] font-semibold leading-7 text-orange-700 sm:text-[21px] sm:leading-8 dark:text-orange-300"
  }

  return "text-[17px] font-semibold leading-7 text-foreground sm:text-[21px] sm:leading-8"
}

function ZoneBoardsDropdown({ zone, boards, activeBoardSlug }: { zone: NonNullable<PostDetailHeaderProps["zone"]>; boards: NonNullable<PostDetailHeaderProps["zoneBoards"]>; activeBoardSlug?: string }) {
  return (
    <div className="group/zone relative inline-flex items-center">
      <Link href={`/zones/${zone.slug}`} className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>{zone.name}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform group-hover/zone:rotate-180 group-focus-within/zone:rotate-180" />
      </Link>
      <div className="pointer-events-none invisible absolute left-0 top-full z-20 w-72 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover/zone:pointer-events-auto group-hover/zone:visible group-hover/zone:translate-y-0 group-hover/zone:opacity-100 group-focus-within/zone:pointer-events-auto group-focus-within/zone:visible group-focus-within/zone:translate-y-0 group-focus-within/zone:opacity-100">
        <div className="rounded-2xl border border-border/70 bg-background/95 p-2 shadow-xl backdrop-blur-md">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {zone.name} 节点
          </div>
          <div className="mt-1 space-y-1">
            {boards.map((board) => (
              <Link
                key={board.slug}
                href={`/boards/${board.slug}`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  board.slug === activeBoardSlug && "bg-accent/80 text-foreground",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <LevelIcon icon={board.icon} className="h-4 w-4 shrink-0 text-sm" svgClassName="[&>svg]:block" />
                  <span className="truncate">{board.name}</span>
                </span>
                {typeof board.count === "number" ? <span className="shrink-0 text-[11px] text-muted-foreground">帖 {board.count}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PostDetailHeader({ post, isFollowingPost, isRestrictedAuthor, zone, zoneBoards = [] }: PostDetailHeaderProps) {
  const authorHref = `/users/${post.authorUsername ?? post.author}`
  const boardHref = `/boards/${post.boardSlug}`

  return (
    <header>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-muted-foreground sm:text-[12px]">
          <Link href="/" className="rounded-md px-1 py-0.5 transition-colors hover:bg-accent/60 hover:text-foreground">
            首页
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          {zone ? (
            <>
              <ZoneBoardsDropdown zone={zone} boards={zoneBoards} activeBoardSlug={post.boardSlug} />
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </>
          ) : null}
          <Link href={boardHref} className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-accent/60 hover:text-foreground">
            <LevelIcon icon={post.boardIcon} className="h-3.5 w-3.5 text-sm" svgClassName="[&>svg]:block" />
            <span>{post.board}</span>
          </Link>
          <PostStateBadges type={post.type} typeLabel={post.typeLabel} isPinned={post.isPinned} isFeatured={post.isFeatured} />
        </div>

        <div className="relative">
          <div className="absolute right-0 top-0 flex shrink-0 flex-col items-end gap-1">
            <FollowToggleButton
              targetType="post"
              targetId={post.id}
              initialFollowed={isFollowingPost}
              activeLabel="已关注帖子"
              inactiveLabel="关注帖子"
              showLabel
              className="h-7 rounded-full px-2.5 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
            />
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary/70 px-2.5 text-[11px] text-muted-foreground sm:h-8 sm:px-3 sm:text-xs">
              <Eye className="h-3.5 w-3.5" />
              {post.stats.views}
            </span>
          </div>
          <div className="min-w-0 pr-[104px] sm:pr-[112px]">
            <h1 className={getTitleClassName(post)}>{post.title}</h1>
          </div>
        </div>

        <div className={cn("flex items-center gap-1.5", isRestrictedAuthor && "grayscale")}>
          <Link href={authorHref} className="shrink-0">
            <UserAvatar name={post.author} avatarPath={post.authorAvatarPath} size="xs" isVip={post.authorIsVip} vipLevel={post.authorVipLevel} />
          </Link>
          <div className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-muted-foreground sm:text-[12px]">
            <UserVerificationBadge verification={post.authorVerification ?? null} compact appearance="plain" />
            <VipNameTooltip isVip={post.authorIsVip} level={post.authorVipLevel}>
              <span className="inline-flex min-w-0 items-center gap-1">
                <Link href={authorHref} className={cn("truncate", getVipNameClass(post.authorIsVip, post.authorVipLevel, { emphasize: true }))}>
                  {post.author}
                </Link>
                {post.isAnonymous ? <AnonymousUserIndicator /> : null}
              </span>
            </VipNameTooltip>
            <UserDisplayedBadges badges={post.authorDisplayedBadges} compact appearance="plain" spacing="tight" />
            {isRestrictedAuthor ? <UserStatusBadge status={post.authorStatus} compact /> : null}
            <span>·</span>
            <TimeTooltip value={post.publishedAtRaw}>
              <span>{post.publishedAt}</span>
            </TimeTooltip>
          </div>
        </div>
      </div>
    </header>
  )
}
