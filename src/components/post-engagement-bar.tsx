"use client"

import { Bookmark, Flag, ThumbsUp } from "lucide-react"
import { useState, useTransition } from "react"

import { PostAuthorInlineCard } from "@/components/post-author-inline-card"
import { PostRedPacketPanel } from "@/components/post-red-packet-panel"
import { PostTipPanel } from "@/components/post-tip-panel"
import { ReportDialog } from "@/components/report-dialog"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"



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
    pointName: string
    currentUserPoints: number
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


export function PostEngagementBar({ postId, author, likeCount, favoriteCount = 0, initialLiked = false, initialFavored = false, canReport = false, reportLabel = "当前帖子", redPacket, tipping }: PostEngagementBarProps) {

  const [likes, setLikes] = useState(likeCount)
  const [favorites, setFavorites] = useState(favoriteCount)
  const [liked, setLiked] = useState(initialLiked)
  const [favored, setFavored] = useState(initialFavored)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  function runAction(type: "like" | "favorite") {
    setMessage("")

    startTransition(async () => {
      const response = await fetch(type === "like" ? "/api/posts/like" : "/api/posts/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      })
      const result = await response.json()
      if (!response.ok) {
        setMessage(result.message ?? "操作失败")
        return
      }

      if (type === "like") {
        const nextLiked = Boolean(result.data?.liked)
        setLiked(nextLiked)
        setLikes((current) => current + (nextLiked ? 1 : -1))
      } else {
        const nextFavored = Boolean(result.data?.favored)
        setFavored(nextFavored)
        setFavorites((current) => current + (nextFavored ? 1 : -1))
      }
    })
  }

  return (
    <div className="mt-8 flex flex-col gap-3 text-sm text-muted-foreground">
      <div className="border-t border-border/70 pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 pr-4">
            {author ? <PostAuthorInlineCard author={author} /> : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-4">
            {redPacket?.enabled ? <PostRedPacketPanel pointName={redPacket.pointName} summary={redPacket} /> : null}
            <button

              type="button"
              title={liked ? "取消点赞" : "点赞"}
              aria-label={liked ? "取消点赞" : "点赞"}
              className={liked ? "flex items-center gap-1 text-foreground" : "flex items-center gap-1 hover:text-foreground"}
              onClick={() => runAction("like")}
              disabled={isPending}
            >
              <ThumbsUp className="h-4 w-4" />{likes}
            </button>
            <button
              type="button"
              title={favored ? "取消收藏" : "收藏"}
              aria-label={favored ? "取消收藏" : "收藏"}
              className={favored ? "flex items-center gap-1 text-foreground" : "flex items-center gap-1 hover:text-foreground"}
              onClick={() => runAction("favorite")}
              disabled={isPending}
            >
              <Bookmark className="h-4 w-4" />{favorites > 0 ? favorites : null}
            </button>

            {tipping?.enabled ? (
              <PostTipPanel
                postId={postId}
                enabled={tipping.enabled}
                pointName={tipping.pointName}
                currentUserPoints={tipping.currentUserPoints}
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

      {message ? <span className="text-xs lg:self-end">{message}</span> : null}
    </div>
  )
}
