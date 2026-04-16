import Link from "next/link"
import { ChevronDown, ChevronRight, Eye } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { FollowToggleButton } from "@/components/follow-toggle-button"
import { LevelIcon } from "@/components/level-icon"
import { TimeTooltip } from "@/components/time-tooltip"
import { AiAgentIndicator } from "@/components/user/ai-agent-indicator"
import { AnonymousUserIndicator } from "@/components/user/anonymous-user-indicator"
import { UserAvatar } from "@/components/user/user-avatar"
import {
  UserDisplayedBadges,
  type DisplayedBadgeItem,
} from "@/components/user/user-displayed-badges"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import {
  UserVerificationBadge,
  type UserVerificationBadgeItem,
} from "@/components/user/user-verification-badge"
import { VipNameTooltip } from "@/components/vip/vip-name-tooltip"
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
    authorIsAiAgent?: boolean
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
  pathname?: string
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

type PostDetailHeaderZone = NonNullable<PostDetailHeaderProps["zone"]>
type PostDetailHeaderZoneBoards = NonNullable<PostDetailHeaderProps["zoneBoards"]>

interface PostDetailHeaderExtensionProps {
  post: PostDetailHeaderProps["post"]
  authorHref: string
  authorNameClassName: string
  boardHref: string
  isFollowingPost: boolean
  isRestrictedAuthor: boolean
  zone?: PostDetailHeaderProps["zone"]
  zoneBoards: PostDetailHeaderZoneBoards
}

interface PostDetailHeaderVerificationSurfaceProps
  extends PostDetailHeaderExtensionProps {
  verification: UserVerificationBadgeItem | null
}

interface PostDetailHeaderBadgesSurfaceProps
  extends PostDetailHeaderExtensionProps {
  badges: DisplayedBadgeItem[]
}

function PostStateBadges({
  type,
  typeLabel,
  isPinned,
  isFeatured,
}: {
  type?: string
  typeLabel: string
  isPinned: boolean
  isFeatured: boolean
}) {
  if (type === "NORMAL" && !isPinned && !isFeatured) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {type !== "NORMAL" ? (
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:px-2 sm:text-[11px]">
          {typeLabel}
        </span>
      ) : null}
      {isPinned ? (
        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 dark:bg-orange-500/15 dark:text-orange-200 sm:px-2 sm:text-[11px]">
          置顶
        </span>
      ) : null}
      {isFeatured ? (
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 sm:px-2 sm:text-[11px]">
          精华
        </span>
      ) : null}
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

function ZoneBoardsDropdown({
  zone,
  boards,
  activeBoardSlug,
}: {
  zone: PostDetailHeaderZone
  boards: PostDetailHeaderZoneBoards
  activeBoardSlug?: string
}) {
  return (
    <div className="group/zone relative inline-flex items-center">
      <Link
        href={`/zones/${zone.slug}`}
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
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
                  <LevelIcon
                    icon={board.icon}
                    className="h-4 w-4 shrink-0 text-sm"
                    svgClassName="[&>svg]:block"
                  />
                  <span className="truncate">{board.name}</span>
                </span>
                {typeof board.count === "number" ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    帖 {board.count}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PostAuthorVerificationContent({
  verification,
}: PostDetailHeaderVerificationSurfaceProps) {
  return (
    <UserVerificationBadge
      verification={verification}
      compact
      appearance="plain"
    />
  )
}

function PostAuthorNameContent({
  post,
  authorHref,
  authorNameClassName,
}: PostDetailHeaderExtensionProps) {
  return (
    <VipNameTooltip isVip={post.authorIsVip} level={post.authorVipLevel}>
      <span className="inline-flex min-w-0 items-center gap-1">
        <Link href={authorHref} className={cn("truncate", authorNameClassName)}>
          {post.author}
        </Link>
        {post.isAnonymous ? <AnonymousUserIndicator /> : null}
        {post.authorIsAiAgent ? <AiAgentIndicator /> : null}
      </span>
    </VipNameTooltip>
  )
}

function PostAuthorBadgesContent({
  badges,
}: PostDetailHeaderBadgesSurfaceProps) {
  return (
    <UserDisplayedBadges
      badges={badges}
      compact
      appearance="plain"
      spacing="tight"
    />
  )
}

function PostAuthorMetaContent({
  pathname,
  ...props
}: PostDetailHeaderExtensionProps & { pathname?: string }) {
  const verificationProps = {
    ...props,
    verification: props.post.authorVerification ?? null,
  } satisfies PostDetailHeaderVerificationSurfaceProps
  const badgesProps = {
    ...props,
    badges: props.post.authorDisplayedBadges ?? [],
  } satisfies PostDetailHeaderBadgesSurfaceProps

  return (
    <>
      <AddonSlotRenderer
        slot="post.author.meta.before"
        props={props}
        pathname={pathname}
      />
      <AddonSurfaceRenderer
        surface="post.author.meta"
        props={props}
        pathname={pathname}
      >
        <div className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-muted-foreground sm:text-[12px]">
          <AddonSlotRenderer
            slot="post.author.verification.before"
            props={verificationProps}
            pathname={pathname}
          />
          <AddonSurfaceRenderer
            surface="post.author.verification"
            props={verificationProps}
            pathname={pathname}
          >
            <PostAuthorVerificationContent {...verificationProps} />
          </AddonSurfaceRenderer>
          <AddonSlotRenderer
            slot="post.author.verification.after"
            props={verificationProps}
            pathname={pathname}
          />

          <AddonSlotRenderer
            slot="post.author.name.before"
            props={props}
            pathname={pathname}
          />
          <AddonSurfaceRenderer
            surface="post.author.name"
            props={props}
            pathname={pathname}
          >
            <PostAuthorNameContent {...props} />
          </AddonSurfaceRenderer>
          <AddonSlotRenderer
            slot="post.author.name.after"
            props={props}
            pathname={pathname}
          />

          <AddonSlotRenderer
            slot="post.author.badges.before"
            props={badgesProps}
            pathname={pathname}
          />
          <AddonSurfaceRenderer
            surface="post.author.badges"
            props={badgesProps}
            pathname={pathname}
          >
            <PostAuthorBadgesContent {...badgesProps} />
          </AddonSurfaceRenderer>
          <AddonSlotRenderer
            slot="post.author.badges.after"
            props={badgesProps}
            pathname={pathname}
          />

          {props.isRestrictedAuthor ? (
            <UserStatusBadge status={props.post.authorStatus} compact />
          ) : null}
          <span>·</span>
          <TimeTooltip value={props.post.publishedAtRaw}>
            <span>{props.post.publishedAt}</span>
          </TimeTooltip>
        </div>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer
        slot="post.author.meta.after"
        props={props}
        pathname={pathname}
      />
    </>
  )
}

function PostAuthorRowContent({
  pathname,
  ...props
}: PostDetailHeaderExtensionProps & { pathname?: string }) {
  return (
    <>
      <AddonSlotRenderer
        slot="post.author.row.before"
        props={props}
        pathname={pathname}
      />
      <AddonSurfaceRenderer
        surface="post.author.row"
        props={props}
        pathname={pathname}
      >
        <div
          className={cn(
            "flex items-center gap-1.5",
            props.isRestrictedAuthor && "grayscale",
          )}
        >
          <Link href={props.authorHref} className="shrink-0">
            <UserAvatar
              name={props.post.author}
              avatarPath={props.post.authorAvatarPath}
              size="xs"
              isVip={props.post.authorIsVip}
              vipLevel={props.post.authorVipLevel}
            />
          </Link>
          <PostAuthorMetaContent {...props} pathname={pathname} />
        </div>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer
        slot="post.author.row.after"
        props={props}
        pathname={pathname}
      />
    </>
  )
}

export function PostDetailHeader({
  post,
  isFollowingPost,
  isRestrictedAuthor,
  pathname,
  zone,
  zoneBoards = [],
}: PostDetailHeaderProps) {
  const authorHref = `/users/${post.authorUsername ?? post.author}`
  const boardHref = `/boards/${post.boardSlug}`
  const authorNameClassName = post.authorIsVip
    ? getVipNameClass(post.authorIsVip, post.authorVipLevel, {
        emphasize: true,
      })
    : getVipNameClass(post.authorIsVip, post.authorVipLevel, {
        emphasize: true,
      })
        .replace(/\bfont-semibold\b/g, "")
        .replace(/\s+/g, " ")
        .trim()

  const extensionProps = {
    post,
    authorHref,
    authorNameClassName,
    boardHref,
    isFollowingPost,
    isRestrictedAuthor,
    zone,
    zoneBoards,
  } satisfies PostDetailHeaderExtensionProps

  return (
    <>
      <AddonSlotRenderer
        slot="post.header.before"
        props={extensionProps}
        pathname={pathname}
      />
      <AddonSurfaceRenderer
        surface="post.header"
        props={extensionProps}
        pathname={pathname}
      >
        <header>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-muted-foreground sm:text-[12px]">
              <Link
                href="/"
                className="rounded-md px-1 py-0.5 transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                首页
              </Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              {zone ? (
                <>
                  <ZoneBoardsDropdown
                    zone={zone}
                    boards={zoneBoards}
                    activeBoardSlug={post.boardSlug}
                  />
                  <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                </>
              ) : null}
              <Link
                href={boardHref}
                className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <LevelIcon
                  icon={post.boardIcon}
                  className="h-3.5 w-3.5 text-sm"
                  svgClassName="[&>svg]:block"
                />
                <span>{post.board}</span>
              </Link>
              <PostStateBadges
                type={post.type}
                typeLabel={post.typeLabel}
                isPinned={post.isPinned}
                isFeatured={post.isFeatured}
              />
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

            <PostAuthorRowContent {...extensionProps} pathname={pathname} />
          </div>
        </header>
      </AddonSurfaceRenderer>
      <AddonSlotRenderer
        slot="post.header.after"
        props={extensionProps}
        pathname={pathname}
      />
    </>
  )
}
