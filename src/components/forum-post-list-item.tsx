import Link from "next/link"

import { LevelIcon } from "@/components/level-icon"

import { MessageCircle } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import { UserStatusBadge } from "@/components/user-status-badge"
import { cn } from "@/lib/utils"

interface ForumPostListItemProps {
  item: {
    id: string
    slug: string
    title: string
    typeLabel: string
    type?: string
    pinScope?: string | null
    pinLabel?: string | null
    minViewLevel?: number
    isFeatured: boolean

    boardName: string
    boardSlug?: string
    boardIcon?: string
    authorName: string
    authorUsername: string
    authorAvatarPath?: string | null
    authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
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
}

export function ForumPostListItem({ item, showBoard = true, compactFirstItem = false }: ForumPostListItemProps) {
  const isRestrictedAuthor = item.authorStatus === "BANNED" || item.authorStatus === "MUTED"

  return (
    <div className={cn(
      compactFirstItem ? "flex gap-4 border-b pb-3 last:border-b-0" : "flex gap-4 border-b py-3 last:border-b-0",
      "rounded-xl px-3 transition-all duration-150 hover:bg-accent hover:shadow-sm",
    )}>


      <Link href={`/users/${item.authorUsername}`} className={cn("flex-shrink-0", isRestrictedAuthor && "grayscale")}>
        <UserAvatar name={item.authorName} avatarPath={item.authorAvatarPath} size="lg" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/posts/${item.slug}`} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={item.isFeatured ? "line-clamp-2 text-base font-semibold text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200" : item.pinLabel ? "line-clamp-2 text-base font-semibold text-orange-700 transition-colors hover:text-orange-600 dark:text-orange-300 dark:hover:text-orange-200" : "line-clamp-2 text-base font-medium text-foreground transition-colors hover:text-primary"}>
                {item.title}
              </h2>
              {item.minViewLevel && item.minViewLevel > 0 ? (
                <span title={`访问需要至少 Lv.${item.minViewLevel}`} className="inline-flex shrink-0 rounded-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-white shadow-sm">
                  [权]
                </span>
              ) : null}
            </div>
          </Link>

          {item.type !== "NORMAL" ? <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">{item.typeLabel}</span> : null}
          {item.pinLabel ? <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">{item.pinLabel}</span> : null}
          {item.isFeatured ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">精华</span> : null}
          <Link href={`/posts/${item.slug}#comments`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-normal transition-colors hover:opacity-90" style={{ backgroundColor: `${item.commentAccentColor}14`, color: item.commentAccentColor }}>
            <MessageCircle className="h-3.5 w-3.5" />
            {item.commentCount}
          </Link>
        </div>

        <div className={cn("mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", isRestrictedAuthor && "grayscale")}>
          {showBoard && item.boardSlug ? (
            <>
              <Link href={`/boards/${item.boardSlug}`} className="flex items-center gap-1 font-semibold hover:underline">
                <LevelIcon icon={item.boardIcon} className="h-3.5 w-3.5 text-sm" svgClassName="[&>svg]:block" />
                <span>{item.boardName}</span>
              </Link>

              <span>•</span>
            </>
          ) : null}
          <Link href={`/users/${item.authorUsername}`} className={item.authorNameClassName ?? "hover:underline"}>
            {item.authorName}
          </Link>
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
