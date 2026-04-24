"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { BarChart3 } from "lucide-react"

import { FollowToggleButton } from "@/components/follow-toggle-button"
import { RssSubscribeButton } from "@/components/rss/rss-subscribe-button"
import { Modal } from "@/components/ui/modal"
import { UserBlockToggleButton } from "@/components/user/user-block-toggle-button"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface UserProfileOverviewCardProps {
  avatar: ReactNode
  avatarActions?: ReactNode
  displayName: ReactNode
  pointsBadge?: ReactNode
  sidePanel?: ReactNode
  mobileSidePanel?: ReactNode
  mobileSidePanelTitle?: string
  mobileSidePanelDescription?: string
  mobileSidePanelButtonLabel?: string
  identityRow?: ReactNode
  metaRow?: ReactNode
  bio: string
  className?: string
  initialFollowerCount: number
  likeCount: number
  rssHref?: string
  rssLabel?: string
  followAction?: {
    targetId: number
    initialFollowed: boolean
    activeLabel?: string
    inactiveLabel?: string
  } | null
  blockAction?: {
    targetId: number
    initialBlocked: boolean
    activeLabel?: string
    inactiveLabel?: string
  } | null
  restrictionNotice?: ReactNode
}

export function UserProfileOverviewCard({
  avatar,
  avatarActions,
  displayName,
  pointsBadge,
  sidePanel,
  mobileSidePanel,
  mobileSidePanelTitle = "论坛画像",
  mobileSidePanelDescription,
  mobileSidePanelButtonLabel = "查看论坛画像",
  identityRow,
  metaRow,
  bio,
  className,
  initialFollowerCount,
  likeCount,
  rssHref,
  rssLabel = "订阅用户 RSS",
  followAction = null,
  blockAction = null,
  restrictionNotice,
}: UserProfileOverviewCardProps) {
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [isFollowing, setIsFollowing] = useState(followAction?.initialFollowed ?? false)
  const [isBlocked, setIsBlocked] = useState(blockAction?.initialBlocked ?? false)
  const [mobileSidePanelOpen, setMobileSidePanelOpen] = useState(false)

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-xs", className)}>
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className={cn("flex flex-col gap-4", sidePanel ? "xl:grid xl:grid-cols-[minmax(0,1fr)_160px] xl:gap-5" : "")}>
          <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 sm:gap-5">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <div className="flex justify-center md:justify-start">
                {avatar}
              </div>
              {avatarActions || rssHref ? (
                <div className="flex w-full flex-wrap items-center justify-center gap-2 md:justify-start">
                  {avatarActions}
                  {rssHref ? (
                    <RssSubscribeButton
                      href={rssHref}
                      label={rssLabel}
                      showLabel={false}
                      className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex flex-col gap-1">
                <div className="flex min-w-0 items-start gap-x-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-hidden">
                      <div className="min-w-0 max-w-full flex-1">
                        {displayName}
                      </div>
                      {pointsBadge ? <div className="hidden shrink-0 sm:block">{pointsBadge}</div> : null}
                    </div>
                    {pointsBadge ? <div className="mt-1 sm:hidden">{pointsBadge}</div> : null}
                  </div>
                  {mobileSidePanel ? (
                    <button
                      type="button"
                      aria-label={mobileSidePanelButtonLabel}
                      title={mobileSidePanelButtonLabel}
                      className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-7 xl:hidden"
                      onClick={() => setMobileSidePanelOpen(true)}
                    >
                      <BarChart3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                  ) : null}
                </div>

                {identityRow ? (
                  <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto text-[13px] leading-5 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-2 sm:overflow-visible">
                    {identityRow}
                  </div>
                ) : null}

                <div className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-x-auto text-[11px] leading-5 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-x-4 sm:overflow-visible sm:text-sm sm:leading-6">
                  <span className="inline-flex shrink-0 items-baseline gap-1">
                    <span className="font-semibold text-foreground">{formatNumber(likeCount)}</span>
                    <span>获赞</span>
                  </span>
                  <span className="inline-flex shrink-0 items-baseline gap-1">
                    <span className="font-semibold text-foreground">{formatNumber(followerCount)}</span>
                    <span>粉丝</span>
                  </span>
                  {followAction && !isBlocked ? (
                    <FollowToggleButton
                      key={`${followAction.targetId}-${isFollowing ? "followed" : "unfollowed"}`}
                      targetType="user"
                      targetId={followAction.targetId}
                      initialFollowed={isFollowing}
                      activeLabel={followAction.activeLabel ?? "取关"}
                      inactiveLabel={followAction.inactiveLabel ?? "关注"}
                      showLabel
                      className="h-6 whitespace-nowrap justify-center rounded-full px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
                      onFollowStateChange={({ followed, changed }) => {
                        setIsFollowing(followed)

                        if (!changed) {
                          return
                        }

                        setFollowerCount((currentCount) => Math.max(0, currentCount + (followed ? 1 : -1)))
                      }}
                    />
                  ) : null}
                  {blockAction ? (
                    <UserBlockToggleButton
                      targetUserId={blockAction.targetId}
                      initialBlocked={isBlocked}
                      activeLabel={blockAction.activeLabel ?? "已拉黑"}
                      inactiveLabel={blockAction.inactiveLabel ?? "拉黑"}
                      showLabel
                      reloadOnChange
                      className="h-6 whitespace-nowrap justify-center rounded-full px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
                      onBlockStateChange={({ blocked, changed }) => {
                        setIsBlocked(blocked)

                        if (!changed) {
                          return
                        }

                        if (blocked && isFollowing) {
                          setIsFollowing(false)
                          setFollowerCount((currentCount) => Math.max(0, currentCount - 1))
                        }
                      }}
                    />
                  ) : null}
                </div>

                {metaRow ? (
                  <div className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-x-auto text-[10px] leading-4.5 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-x-3 sm:overflow-visible sm:text-[13px] sm:leading-5">
                    {metaRow}
                  </div>
                ) : null}

                <p className="break-words whitespace-pre-wrap text-[13px] leading-5 text-muted-foreground">
                  {bio}
                </p>

                {restrictionNotice ? <div className="pt-1">{restrictionNotice}</div> : null}
              </div>
            </div>
          </div>
          {sidePanel ? (
            <aside className="hidden pt-4 xl:flex xl:w-[160px] xl:items-center xl:justify-end xl:justify-self-end xl:self-stretch xl:pl-5 xl:pt-0">
              {sidePanel}
            </aside>
          ) : null}
        </div>
      </div>
      {mobileSidePanel ? (
        <Modal
          open={mobileSidePanelOpen}
          onClose={() => setMobileSidePanelOpen(false)}
          title={mobileSidePanelTitle}
          hideHeaderCloseButtonOnMobile
          description={mobileSidePanelDescription}
          size="md"
        >
          <div className="flex items-center justify-center py-2">
            {mobileSidePanel}
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
