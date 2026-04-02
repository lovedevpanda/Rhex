import Link from "next/link"
import { ImageIcon, MessageCircle } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { PostListLink } from "@/components/post-list-link"
import { getPostPinTone, getPostTitleClassName, PostAccessBadges, PostRedPacketIcon } from "@/components/post-list-shared"
import { Tooltip } from "@/components/ui/tooltip"
import { UserStatusBadge } from "@/components/user-status-badge"
import { VipNameTooltip } from "@/components/vip-name-tooltip"
import { getPostPath } from "@/lib/post-links"
import { cn } from "@/lib/utils"

interface PostGalleryGridProps {
  items: Array<{
    id: string
    slug: string
    title: string
    excerpt: string
    coverImage?: string | null
    typeLabel?: string
    type?: string
    pinScope?: string | null
    pinLabel?: string | null
    hasRedPacket?: boolean
    minViewLevel?: number
    minViewVipLevel?: number
    isFeatured?: boolean
    boardName: string
    boardSlug?: string
    boardIcon?: string
    authorName: string
    authorUsername: string
    authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    authorIsVip?: boolean
    authorVipLevel?: number | null
    authorNameClassName?: string
    metaPrimary: string
    metaSecondary?: string | null
    commentCount: number
    commentAccentColor: string
  }>
  showBoard?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
}

export function PostGalleryGrid({ items, showBoard = true, postLinkDisplayMode = "SLUG" }: PostGalleryGridProps) {
  return (
    <div className="post-gallery-grid px-1.5 py-1.5 sm:px-2">
      {items.map((item) => {
        const postPath = getPostPath({ id: item.id, slug: item.slug }, { mode: postLinkDisplayMode })
        const pinTone = getPostPinTone(item.pinScope, true)
        const isRestrictedAuthor = item.authorStatus === "BANNED" || item.authorStatus === "MUTED"

        return (
          <article key={item.id} className="post-gallery-card overflow-hidden rounded-[17px] border border-border bg-card transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm">
            <PostListLink href={postPath} className="block">
              {item.coverImage ? (
                <div className="overflow-hidden bg-secondary/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.coverImage} alt={item.title} title={item.title} className="block h-auto w-full" loading="lazy" />
                </div>
              ) : (
                <div className="flex min-h-[154px] items-center justify-center bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(15,23,42,0.04))] px-3 py-[2.1rem] text-muted-foreground">
                  <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/85 px-2.5 py-1 text-[13px] shadow-sm">
                    <ImageIcon className="h-3 w-3" />
                    <span>无封面图</span>
                  </div>
                </div>
              )}
            </PostListLink>

            <div className="space-y-2 p-[0.7rem]">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 overflow-hidden">
                    <PostListLink href={postPath} visitedPath={postPath} dimWhenRead className="min-w-0 flex-1" title={item.title}>
                      <h2 className={getPostTitleClassName({ isFeatured: item.isFeatured, pinScope: item.pinScope, singleLine: true, compact: true })}>
                        {item.title}
                      </h2>
                    </PostListLink>
                    {item.hasRedPacket ? (
                      <Tooltip content="红包帖">
                        <span className="shrink-0" aria-label="红包帖">
                          <PostRedPacketIcon className="h-3.5 w-3.5" />
                        </span>
                      </Tooltip>
                    ) : null}
                    <PostAccessBadges minViewLevel={item.minViewLevel} minViewVipLevel={item.minViewVipLevel} compact />
                  </div>

                  <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                    {item.pinLabel && pinTone ? <span className={cn(pinTone.badgeClassName, "shrink-0")}>{item.pinLabel}</span> : null}
                  </div>

                  <div className={cn("mt-2 flex min-w-0 items-center gap-1 overflow-hidden text-[11px] text-muted-foreground", isRestrictedAuthor && "grayscale")}>
                    {showBoard && item.boardSlug ? (
                      <>
                        <Link href={`/boards/${item.boardSlug}`} className="flex min-w-0 max-w-[40%] items-center gap-1 font-medium hover:underline" title={item.boardName}>
                          <LevelIcon icon={item.boardIcon} className="h-3 w-3 shrink-0 text-[11px]" svgClassName="[&>svg]:block" />
                          <span className="truncate">{item.boardName}</span>
                        </Link>
                        <span className="shrink-0">•</span>
                      </>
                    ) : null}
                    <VipNameTooltip isVip={item.authorIsVip} level={item.authorVipLevel}>
                      <Link href={`/users/${item.authorUsername}`} className={cn("min-w-0 shrink truncate", item.authorNameClassName ?? "hover:underline")} title={item.authorName}>
                        {item.authorName}
                      </Link>
                    </VipNameTooltip>
                    {isRestrictedAuthor ? <UserStatusBadge status={item.authorStatus} compact /> : null}
                    <span className="shrink-0">•</span>
                    <span className="truncate" title={item.metaSecondary ? `${item.metaPrimary} · ${item.metaSecondary}` : item.metaPrimary}>
                      {item.metaSecondary ? `${item.metaPrimary} · ${item.metaSecondary}` : item.metaPrimary}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5 self-center">
                  <PostListLink href={`${postPath}#comments`} className="inline-flex items-center gap-1 rounded-full px-2 py-[0.2rem] text-[10px] font-medium" style={{ backgroundColor: `${item.commentAccentColor}14`, color: item.commentAccentColor }}>
                    <MessageCircle className="h-3 w-3" />
                    {item.commentCount}
                  </PostListLink>
                  {item.isFeatured ? <span className="rounded-full bg-emerald-100 px-2 py-[0.2rem] text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">精华</span> : null}
                  {item.type && item.type !== "NORMAL" ? <span className="rounded-full bg-secondary px-2 py-[0.2rem] text-[10px] text-muted-foreground">{item.typeLabel}</span> : null}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
