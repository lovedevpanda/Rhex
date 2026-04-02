import Link from "next/link"

import { LevelIcon } from "@/components/level-icon"
import { PostListLink } from "@/components/post-list-link"
import { getPostPinTone, getPostTitleClassName, PostAccessBadges, PostRedPacketIcon } from "@/components/post-list-shared"
import { Tooltip } from "@/components/ui/tooltip"
import { VipNameTooltip } from "@/components/vip-name-tooltip"

import { MessageCircle } from "lucide-react"



import { UserAvatar } from "@/components/user-avatar"
import { UserStatusBadge } from "@/components/user-status-badge"
import { cn } from "@/lib/utils"
import { getPostPath } from "@/lib/post-links"

interface ForumPostListItemProps {
  item: {
    id: string
    slug: string
    title: string
    typeLabel: string
    type?: string
    pinScope?: string | null
    pinLabel?: string | null
    hasRedPacket?: boolean
    minViewLevel?: number
    minViewVipLevel?: number
    isFeatured: boolean


    boardName: string
    boardSlug?: string
    boardIcon?: string
    authorName: string
    authorUsername: string
    authorAvatarPath?: string | null
    authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    authorIsVip?: boolean
    authorVipLevel?: number | null
    authorNameClassName?: string
    authorDisplayedBadges?: Array<{
      id: string
      name: string
      color: string
      iconText?: string | null
    }>
    metaPrimary: string
    metaSecondary?: string | null
    commentCount: number
    commentAccentColor: string
  }
  showBoard?: boolean
  compactFirstItem?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
}

export function ForumPostListItem({ item, showBoard = true, compactFirstItem = false, postLinkDisplayMode = "SLUG" }: ForumPostListItemProps) {

  const isRestrictedAuthor = item.authorStatus === "BANNED" || item.authorStatus === "MUTED"
  const pinTone = getPostPinTone(item.pinScope, true)
  const postPath = getPostPath({ id: item.id, slug: item.slug }, { mode: postLinkDisplayMode })

  return (
    <div className={cn(
      compactFirstItem ? "flex gap-2.5 border-b pb-2.5 last:border-b-0 sm:gap-3" : "flex gap-2.5 border-b py-2.5 last:border-b-0 sm:gap-3",
      "rounded-xl px-1.5 transition-all duration-150 hover:bg-accent hover:shadow-sm sm:px-2.5",
    )}>
      <Link href={`/users/${item.authorUsername}`} className={cn("flex-shrink-0", isRestrictedAuthor && "grayscale")}>
        <UserAvatar name={item.authorName} avatarPath={item.authorAvatarPath} size="md" isVip={item.authorIsVip} vipLevel={item.authorVipLevel} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:gap-1.5">
            <PostListLink href={postPath} visitedPath={postPath} dimWhenRead className="min-w-0">
              <h2 className={getPostTitleClassName({ isFeatured: item.isFeatured, pinScope: item.pinScope, compact: true })}>
                {item.title}
              </h2>
            </PostListLink>
            {item.hasRedPacket ? (
              <Tooltip content="红包帖">
                <span aria-label="红包帖">
                  <PostRedPacketIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
              </Tooltip>
            ) : null}
            <PostAccessBadges minViewLevel={item.minViewLevel} minViewVipLevel={item.minViewVipLevel} compact />
          </div>

          {item.type !== "NORMAL" ? <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground sm:px-2 sm:text-[11px]">{item.typeLabel}</span> : null}
          {item.pinLabel && pinTone ? <span className={pinTone.badgeClassName}>{item.pinLabel}</span> : null}
          {item.isFeatured ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 sm:px-2 sm:text-[11px]">精华</span> : null}
          <PostListLink href={`${postPath}#comments`} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-normal transition-colors hover:opacity-90 sm:px-2 sm:text-[11px]" style={{ backgroundColor: `${item.commentAccentColor}14`, color: item.commentAccentColor }}>



            <MessageCircle className="h-3 w-3" />
            {item.commentCount}
          </PostListLink>
        </div>

        <div className={cn("mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground sm:mt-1.5 sm:gap-1.5 sm:text-[11px]", isRestrictedAuthor && "grayscale")}>
          {showBoard && item.boardSlug ? (
            <>
              <Link href={`/boards/${item.boardSlug}`} className="flex items-center gap-1 font-semibold hover:underline">
                <LevelIcon icon={item.boardIcon} className="h-3 w-3 text-xs sm:h-3.5 sm:w-3.5" svgClassName="[&>svg]:block" />
                <span>{item.boardName}</span>
              </Link>

              <span>•</span>
            </>
          ) : null}
          <VipNameTooltip isVip={item.authorIsVip} level={item.authorVipLevel}>
            <Link href={`/users/${item.authorUsername}`} className={item.authorNameClassName ?? "hover:underline"}>
              {item.authorName}
            </Link>
          </VipNameTooltip>
          {isRestrictedAuthor ? <UserStatusBadge status={item.authorStatus} compact /> : null}
          <span>•</span>
          <span>{item.metaPrimary}</span>
          {item.metaSecondary ? (
            <>
              <span>•</span>
              <span>{item.metaSecondary}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
