"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ImageIcon, ImageOff, MessageCircle, type LucideIcon } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { PostListLink } from "@/components/post/post-list-link"
import { getPostTitleClassName, PostAccessBadges, PostPinBadge, PostRewardPoolIcon, PostStatusBadge, PostTypeBadge } from "@/components/post/post-list-shared"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { VipNameTooltip } from "@/components/vip/vip-name-tooltip"
import { formatCompactNumber, formatNumber } from "@/lib/formatters"
import { buildGalleryThumbnailSrcSet, buildGalleryThumbnailUrl } from "@/lib/gallery-thumbnail"
import { getPostPath } from "@/lib/post-links"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
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
    status?: string
    statusLabel?: string
    reviewNote?: string | null
    pinScope?: string | null
    pinLabel?: string | null
    hasRedPacket?: boolean
    rewardMode?: PostRewardPoolMode
    minViewLevel?: number
    minViewVipLevel?: number
    isFeatured?: boolean
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
    metaPrimary: string
    metaPrimaryRaw?: string
    metaSecondary?: string | null
    commentCount: number
    commentAccentColor: string
  }>
  showBoard?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
  showPinBadge?: boolean
}

function GalleryCoverPlaceholder({ label, icon: Icon = ImageIcon, overlay }: { label: string; icon?: LucideIcon; overlay?: ReactNode }) {
  return (
    <div className="relative flex min-h-[154px] items-center justify-center bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(15,23,42,0.04))] px-3 py-[2.1rem] text-muted-foreground">
      {overlay}
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/85 px-2.5 py-1 text-[13px] shadow-xs">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
    </div>
  )
}

function GalleryCoverImage({ src, title, overlay }: { src: string; title: string; overlay?: ReactNode }) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [hasLoadError, setHasLoadError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [fallbackToOriginal, setFallbackToOriginal] = useState(false)
  const imageSrc = fallbackToOriginal ? src : buildGalleryThumbnailUrl(src)
  const imageSrcSet = fallbackToOriginal ? undefined : buildGalleryThumbnailSrcSet(src)

  useEffect(() => {
    setHasLoadError(false)
    setImageLoaded(false)
    setFallbackToOriginal(false)
  }, [src])

  useEffect(() => {
    const image = imageRef.current
    if (!image) {
      return
    }

    if (!image.complete) {
      return
    }

    if (image.naturalWidth > 0) {
      setImageLoaded(true)
      return
    }

    setHasLoadError(true)
    setImageLoaded(true)
  }, [imageSrc])

  if (hasLoadError) {
    return <GalleryCoverPlaceholder label="封面暂不可用" icon={ImageOff} overlay={overlay} />
  }

  return (
    <div className="relative min-h-[154px] overflow-hidden bg-secondary/40">
      {!imageLoaded ? <Skeleton aria-hidden="true" className="absolute inset-0 rounded-none" /> : null}
      {overlay}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={imageSrc}
        srcSet={imageSrcSet}
        sizes="(max-width: 1023px) 50vw, 16rem"
        alt={title}
        title={title}
        className={cn("block h-auto w-full transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")}
        loading="lazy"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          if (!fallbackToOriginal && imageSrc !== src) {
            setFallbackToOriginal(true)
            setImageLoaded(false)
            return
          }

          setHasLoadError(true)
          setImageLoaded(true)
        }}
      />
    </div>
  )
}

function PostGalleryCover({ coverImage, title, overlay }: { coverImage?: string | null; title: string; overlay?: ReactNode }) {
  const normalizedCoverImage = coverImage?.trim() ?? ""

  if (!normalizedCoverImage) {
    return <GalleryCoverPlaceholder label="无封面图" overlay={overlay} />
  }

  return <GalleryCoverImage key={normalizedCoverImage} src={normalizedCoverImage} title={title} overlay={overlay} />
}

function resolveGalleryColumnCount(width: number, viewportWidth: number) {
  if (width <= 0) {
    return 2
  }

  if (viewportWidth < 768) {
    return 2
  }

  const targetColumnWidth = 232
  const columnGap = 8
  return Math.max(1, Math.floor((width + columnGap) / (targetColumnWidth + columnGap)))
}

function distributeGalleryItems<T>(items: T[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => [] as T[])

  items.forEach((item, index) => {
    columns[index % columnCount]?.push(item)
  })

  return columns
}

function GalleryCoverBadges({ item, showPinBadge }: { item: PostGalleryGridProps["items"][number]; showPinBadge: boolean }) {
  const hasBadges = Boolean(
    (showPinBadge && item.pinScope) ||
    item.isFeatured ||
    (item.status && item.status !== "NORMAL") ||
    (item.type && item.type !== "NORMAL" && item.typeLabel) ||
    item.hasRedPacket,
  )

  if (!hasBadges) {
    return null
  }

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1">
      {showPinBadge ? <PostPinBadge scope={item.pinScope} label={item.pinLabel} compact className="pointer-events-auto shrink-0 bg-background/90 shadow-sm backdrop-blur" /> : null}
      {item.isFeatured ? <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-emerald-100/95 px-2 text-[10px] leading-none text-emerald-700 shadow-sm backdrop-blur dark:bg-emerald-500/80 dark:text-emerald-50">精华</span> : null}
      <PostStatusBadge status={item.status} label={item.statusLabel} reviewNote={item.reviewNote} compact className="pointer-events-auto shrink-0 bg-background/90 shadow-sm backdrop-blur" />
      <PostTypeBadge type={item.type} label={item.typeLabel} compact mobileIconOnly className="shrink-0 shadow-sm backdrop-blur" />
      {item.hasRedPacket ? (
        <Tooltip content={item.rewardMode === "JACKPOT" ? "聚宝盆帖" : "红包帖"}>
          <span className="pointer-events-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur" aria-label={item.rewardMode === "JACKPOT" ? "聚宝盆帖" : "红包帖"}>
            <PostRewardPoolIcon mode={item.rewardMode} className="h-3.5 w-3.5" />
          </span>
        </Tooltip>
      ) : null}
    </div>
  )
}

export function PostGalleryGrid({ items, showBoard = true, postLinkDisplayMode = "SLUG", showPinBadge = true }: PostGalleryGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [columnCount, setColumnCount] = useState(2)
  const columns = distributeGalleryItems(items, columnCount)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) {
      return
    }

    const updateColumnCount = () => {
      setColumnCount((current) => {
        const nextColumnCount = resolveGalleryColumnCount(grid.clientWidth, window.innerWidth)
        return current === nextColumnCount ? current : nextColumnCount
      })
    }

    updateColumnCount()

    const observer = new ResizeObserver(updateColumnCount)
    observer.observe(grid)
    window.addEventListener("resize", updateColumnCount)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateColumnCount)
    }
  }, [])

  return (
    <div ref={gridRef} className="post-gallery-grid px-1.5 py-1.5 sm:px-2">
      {columns.map((columnItems, columnIndex) => (
        <div key={columnIndex} className="post-gallery-column">
          {columnItems.map((item) => {
        const postPath = getPostPath({ id: item.id, slug: item.slug }, { mode: postLinkDisplayMode })
        const isRestrictedAuthor = item.authorStatus === "BANNED" || item.authorStatus === "MUTED"

        return (
          <article key={item.id} className="post-gallery-card overflow-hidden rounded-[17px] border border-border bg-card transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-xs">
            <PostListLink href={postPath} className="block">
              <PostGalleryCover coverImage={item.coverImage} title={item.title} overlay={<GalleryCoverBadges item={item} showPinBadge={showPinBadge} />} />
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
                    <PostAccessBadges minViewLevel={item.minViewLevel} minViewVipLevel={item.minViewVipLevel} compact />
                  </div>

                  <div className={cn("mt-2 flex min-w-0 items-center justify-between gap-1.5 overflow-hidden text-xs text-muted-foreground", isRestrictedAuthor && "grayscale")}>
                    <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                      {showBoard && item.boardSlug ? (
                        <>
                          <Link href={`/boards/${item.boardSlug}`} className="flex min-w-0 max-w-[40%] items-center gap-1 font-medium hover:underline" title={item.boardName}>
                            <LevelIcon icon={item.boardIcon} className="h-3 w-3 shrink-0 text-[11px]" svgClassName="[&>svg]:block" />
                            <span className="truncate">{item.boardName}</span>
                          </Link>
                          <span className="shrink-0">•</span>
                        </>
                      ) : null}
                      <Link href={`/users/${item.authorUsername}`} className="shrink-0" title={item.authorName}>
                        <UserAvatar name={item.authorName} avatarPath={item.authorAvatarPath} size="xs" isVip={item.authorIsVip} vipLevel={item.authorVipLevel} />
                      </Link>
                      <VipNameTooltip isVip={item.authorIsVip} level={item.authorVipLevel}>
                        <Link href={`/users/${item.authorUsername}`} className={cn("min-w-0 shrink truncate font-medium", item.authorNameClassName ?? "hover:underline")} title={item.authorName}>
                          {item.authorName}
                        </Link>
                      </VipNameTooltip>
                      {isRestrictedAuthor ? <UserStatusBadge status={item.authorStatus} compact /> : null}
                    </div>
                    <PostListLink href={`${postPath}#comments`} title={`${formatNumber(item.commentCount)} 回复`} className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-normal tabular-nums transition-colors hover:opacity-90 sm:px-2 sm:text-[11px]" style={{ backgroundColor: `${item.commentAccentColor}14`, color: item.commentAccentColor }}>
                      <MessageCircle className="h-3 w-3" />
                      {formatCompactNumber(item.commentCount)}
                    </PostListLink>
                  </div>
                </div>
              </div>
            </div>
          </article>
        )
          })}
        </div>
      ))}
    </div>
  )
}
