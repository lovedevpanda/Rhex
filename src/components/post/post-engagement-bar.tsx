"use client"

import { Bookmark, Flag, ThumbsUp } from "lucide-react"
import { useState, useTransition } from "react"

import { PostAuthorInlineCard } from "@/components/post/post-author-inline-card"
import { FavoriteCollectionDialog } from "@/components/collection/favorite-collection-dialog"
import { PostRewardPoolIntroAnimation } from "@/components/post/post-reward-pool-intro-animation"
import { PostRedPacketPanel } from "@/components/post/post-red-packet-panel"
import { PostTipPanel } from "@/components/post/post-tip-panel"
import { ReportDialog } from "@/components/post/report-dialog"
import { toast } from "@/components/ui/toast"
import { Toggle } from "@/components/ui/toggle"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"
import type { PostGiftRecentEventItem, PostGiftStatItem } from "@/db/post-gift-queries"
import type { SiteTippingGiftItem } from "@/lib/site-settings"



interface PostEngagementBarProps {
  postId: string
  author?: {
    bio?: string | null
  }
  likeCount: number
  favoriteCount?: number
  initialLiked?: boolean
  initialFavored?: boolean
  canReport?: boolean
  reportLabel?: string
  redPacket?: PostRedPacketSummary


  tipping?: {
    enabled: boolean
    isLoggedIn: boolean
    pointName: string
    currentUserPoints: number
    gifts: SiteTippingGiftItem[]
    giftStats: PostGiftStatItem[]
    recentGiftEvents: PostGiftRecentEventItem[]
    allowedAmounts: number[]
    dailyLimit: number
    perPostLimit: number
    usedDailyCount: number
    usedPostCount: number
    totalCount: number
    totalPoints: number
    topSupporters: Array<{
      userId: number
      username: string
      nickname?: string | null
      avatarPath?: string | null
      totalAmount: number
    }>
  }
}

const engagementToggleClassName = "h-auto min-w-0 rounded-full p-0 text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-transparent aria-pressed:text-foreground data-[state=on]:bg-transparent data-[state=on]:text-foreground"


export function PostEngagementBar({ postId, author, likeCount, favoriteCount = 0, initialLiked = false, initialFavored = false, canReport = false, reportLabel = "当前帖子", redPacket, tipping }: PostEngagementBarProps) {

  const [likes, setLikes] = useState(likeCount)
  const [favorites, setFavorites] = useState(favoriteCount)
  const [liked, setLiked] = useState(initialLiked)
  const [favored, setFavored] = useState(initialFavored)
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false)
  const [favoriteDialogMode, setFavoriteDialogMode] = useState<"newly-favored" | "manage">("manage")
  const [isPending, startTransition] = useTransition()

  function runAction(type: "like" | "favorite") {
    startTransition(async () => {
      try {
        const response = await fetch(type === "like" ? "/api/posts/like" : "/api/posts/favorite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        })
        const result = await response.json()

        if (!response.ok) {
          toast.error(
            result.message ?? (type === "like" ? "点赞失败" : "收藏失败"),
            type === "like" ? "帖子点赞失败" : "收藏失败",
          )
          return
        }

        if (type === "like") {
          const nextLiked = Boolean(result.data?.liked)
          setLiked(nextLiked)
          setLikes((current) => current + (nextLiked ? 1 : -1))
          toast.success(
            result.message ?? (nextLiked ? "点赞成功" : "已取消点赞"),
            nextLiked ? "点赞成功" : "取消点赞成功",
          )
          return
        }

        const nextFavored = Boolean(result.data?.favored)
        setFavored(nextFavored)
        setFavorites((current) => current + (nextFavored ? 1 : -1))
        toast.success(
          result.message ?? (nextFavored ? "收藏成功" : "已取消收藏"),
          nextFavored ? "收藏成功" : "取消收藏成功",
        )

        if (nextFavored) {
          setFavoriteDialogMode("newly-favored")
          setFavoriteDialogOpen(true)
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : (type === "like" ? "点赞失败，请稍后重试" : "收藏失败，请稍后重试"),
          type === "like" ? "帖子点赞失败" : "收藏失败",
        )
      }
    })
  }

  function handleFavoriteButtonClick() {
    if (favored) {
      setFavoriteDialogMode("manage")
      setFavoriteDialogOpen(true)
      return
    }

    runAction("favorite")
  }

  function handleFavoriteStateChanged(nextFavored: boolean) {
    setFavored(nextFavored)
    setFavorites((current) => {
      if (nextFavored === favored) {
        return current
      }

      return current + (nextFavored ? 1 : -1)
    })
  }

  return (
    <div className="mt-8 flex flex-col gap-3 text-sm text-muted-foreground">
      {redPacket?.enabled ? <PostRewardPoolIntroAnimation postId={postId} summary={redPacket} /> : null}
      <div className="border-t border-border/70 pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 pr-4">
            {author ? <PostAuthorInlineCard author={author} /> : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-4">
            {redPacket?.enabled ? <PostRedPacketPanel postId={postId} pointName={redPacket.pointName} summary={redPacket} /> : null}
            <Toggle
              type="button"
              pressed={liked}
              title={liked ? "取消点赞" : "点赞"}
              aria-label={liked ? "取消点赞" : "点赞"}
              className={engagementToggleClassName}
              onPressedChange={() => runAction("like")}
              disabled={isPending}
            >
              <ThumbsUp className="h-4 w-4" />
              {likes > 0 ? likes : null}
            </Toggle>
            <Toggle
              type="button"
              pressed={favored}
              title={favored ? "管理收藏合集" : "收藏"}
              aria-label={favored ? "管理收藏合集" : "收藏"}
              className={engagementToggleClassName}
              onPressedChange={handleFavoriteButtonClick}
              disabled={isPending}
            >
              <Bookmark className="h-4 w-4" />{favorites > 0 ? favorites : null}
            </Toggle>

            {tipping?.enabled ? (
              <PostTipPanel
                postId={postId}
                enabled={tipping.enabled}
                isLoggedIn={tipping.isLoggedIn}
                pointName={tipping.pointName}
                currentUserPoints={tipping.currentUserPoints}
                gifts={tipping.gifts}
                giftStats={tipping.giftStats}
                recentGiftEvents={tipping.recentGiftEvents}
                allowedAmounts={tipping.allowedAmounts}
                dailyLimit={tipping.dailyLimit}
                perPostLimit={tipping.perPostLimit}
                usedDailyCount={tipping.usedDailyCount}
                usedPostCount={tipping.usedPostCount}
                totalCount={tipping.totalCount}
                totalPoints={tipping.totalPoints}
                topSupporters={tipping.topSupporters}
              />
            ) : null}
            {canReport ? (
              <ReportDialog
                targetType="POST"
                targetId={postId}
                targetLabel={reportLabel}
                buttonText="举报帖子"
                icon={<Flag className="h-4 w-4" />}
                buttonClassName="h-auto p-0 text-muted-foreground hover:text-foreground"
              />
            ) : null}
          </div>
        </div>
      </div>
      <FavoriteCollectionDialog
        open={favoriteDialogOpen}
        postId={postId}
        favored={favored}
        openMode={favoriteDialogMode}
        onClose={() => {
          setFavoriteDialogOpen(false)
          setFavoriteDialogMode("manage")
        }}
        onFavoriteChanged={handleFavoriteStateChanged}
      />
    </div>
  )
}
