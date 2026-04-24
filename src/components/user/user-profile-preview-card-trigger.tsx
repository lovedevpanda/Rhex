"use client"

import Link from "next/link"
import { Crown, FileText, FolderOpen, MessageSquareMore, ShieldCheck, Sparkles } from "lucide-react"
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

import { FollowToggleButton } from "@/components/follow-toggle-button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserDisplayedBadges } from "@/components/user/user-displayed-badges"
import { UserProfileRadarPanel } from "@/components/user/user-profile-radar-panel"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { UserVerificationBadge } from "@/components/user/user-verification-badge"
import { VipLevelIcon } from "@/components/vip/vip-level-icon"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { UserPreviewCardData } from "@/lib/user-preview-card"

type PreviewFetchState =
  | { username: string; status: "idle" }
  | { username: string; status: "loaded"; data: UserPreviewCardData }
  | { username: string; status: "error"; message: string }

interface UserProfilePreviewCardTriggerProps {
  username: string
  displayName: string
  avatarPath?: string | null
  isVip?: boolean
  vipLevel?: number | null
  className?: string
  triggerClassName?: string
  children?: ReactNode
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
}

const previewDataCache = new Map<string, UserPreviewCardData>()

export function UserProfilePreviewCardTrigger({
  username,
  displayName,
  avatarPath,
  isVip = false,
  vipLevel,
  className,
  triggerClassName,
  children,
  align = "start",
  side = "bottom",
}: UserProfilePreviewCardTriggerProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PreviewFetchState>(() => {
    const cached = previewDataCache.get(username)
    return cached ? { username, status: "loaded", data: cached } : { username, status: "idle" }
  })
  const inflightUsernameRef = useRef<string | null>(null)
  const cachedPreview = previewDataCache.get(username)
  const resolvedState = state.username === username
    ? state
    : cachedPreview
      ? { username, status: "loaded" as const, data: cachedPreview }
      : { username, status: "idle" as const }

  useEffect(() => {
    if (!open || cachedPreview || inflightUsernameRef.current === username) {
      return
    }

    if (state.username === username && state.status !== "idle") {
      return
    }

    const controller = new AbortController()
    inflightUsernameRef.current = username

    void fetch(`/api/users/${encodeURIComponent(username)}/preview`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json() as { message?: string; data?: UserPreviewCardData }

        if (!response.ok || !result.data) {
          throw new Error(result.message ?? "用户信息加载失败")
        }

        previewDataCache.set(username, result.data)
        setState({ username, status: "loaded", data: result.data })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          username,
          status: "error",
          message: error instanceof Error ? error.message : "用户信息加载失败",
        })
      })
      .finally(() => {
        if (inflightUsernameRef.current === username) {
          inflightUsernameRef.current = null
        }
      })

    return () => {
      controller.abort()
      if (inflightUsernameRef.current === username) {
        inflightUsernameRef.current = null
      }
    }
  }, [cachedPreview, open, state.status, state.username, username])

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && state.username === username && state.status === "error") {
          setState({ username, status: "idle" })
        }
      }}
    >
      <PopoverTrigger
        className={cn(
          "cursor-pointer rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/60",
          triggerClassName,
        )}
        aria-label={`查看 ${displayName} 的资料卡`}
        title={`查看 ${displayName} 的资料卡`}
      >
        {children ?? (
          <UserAvatar
            name={displayName}
            avatarPath={avatarPath}
            size="md"
            isVip={isVip}
            vipLevel={vipLevel}
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className={cn("w-[min(16.64rem,calc(100vw-1rem))] gap-0 overflow-hidden rounded-[14px] p-0", className)}
      >
        {resolvedState.status === "loaded" ? (
          <UserProfilePreviewCardContent data={resolvedState.data} />
        ) : resolvedState.status === "error" ? (
          <div className="p-4 text-sm text-muted-foreground">{resolvedState.message}</div>
        ) : (
          <UserProfilePreviewCardSkeleton displayName={displayName} />
        )}
      </PopoverContent>
    </Popover>
  )
}

function UserProfilePreviewCardSkeleton({ displayName }: { displayName: string }) {
  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-2">
        <div className="flex w-[76px] flex-col items-start gap-1.5">
          <Skeleton className="size-16 rounded-xl" />
          <div className="flex w-full flex-wrap items-center justify-start gap-1">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="size-5 rounded-full" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">{displayName}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/70 pt-2.5">
        <div className="grid gap-2 md:grid-cols-[68px_minmax(0,1fr)]">
          <div className="grid grid-cols-4 gap-1 md:flex md:h-full md:flex-col md:justify-center md:gap-1.5">
            <Skeleton className="h-10 rounded-xl md:h-8" />
            <Skeleton className="h-10 rounded-xl md:h-8" />
            <Skeleton className="h-10 rounded-xl md:h-8" />
            <Skeleton className="h-10 rounded-xl md:h-8" />
          </div>
          <div className="flex items-center justify-center">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function getVipIconStyle(level: number) {
  const colorVariableName = level >= 3
    ? "--vip-name-color-vip3"
    : level === 2
      ? "--vip-name-color-vip2"
      : "--vip-name-color-vip1"

  return {
    color: `var(${colorVariableName})`,
  }
}

function PreviewIdentityIcon({
  label,
  className,
  style,
  children,
}: {
  label: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <Tooltip content={label}>
      <span
        aria-label={label}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center",
          className,
        )}
        style={style}
      >
        {children}
      </span>
    </Tooltip>
  )
}

function PreviewDisplayName({
  href,
  name,
  role,
  vipActive,
  vipLevel,
}: {
  href: string
  name: string
  role: NonNullable<UserPreviewCardData["user"]>["role"]
  vipActive: boolean
  vipLevel: number | null
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Link href={href} className="block min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground hover:underline" title={name}>
        {name}
      </Link>
      <div className="inline-flex shrink-0 items-center gap-1">
        {vipActive && vipLevel ? (
          <PreviewIdentityIcon label={`VIP${vipLevel}`} style={getVipIconStyle(vipLevel)}>
            <VipLevelIcon
              level={vipLevel}
              className="h-4 w-4 text-[14px]"
              iconClassName="[&>svg]:h-full [&>svg]:w-full"
            />
          </PreviewIdentityIcon>
        ) : null}
        {role === "ADMIN" ? (
          <PreviewIdentityIcon label="站长" className="text-red-600 dark:text-red-300">
            <Crown className="h-3.5 w-3.5" />
          </PreviewIdentityIcon>
        ) : null}
        {role === "MODERATOR" ? (
          <PreviewIdentityIcon label="版主" className="text-sky-600 dark:text-sky-300">
            <ShieldCheck className="h-3.5 w-3.5" />
          </PreviewIdentityIcon>
        ) : null}
      </div>
    </div>
  )
}

function PreviewInlineStat({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const formattedValue = formatNumber(value)

  return (
    <span
      title={`${formattedValue} ${label}`}
      className="inline-flex min-w-0 items-baseline gap-1 overflow-hidden whitespace-nowrap"
    >
      <span className="truncate font-semibold tabular-nums text-foreground">{formattedValue}</span>
      <span className="shrink-0">{label}</span>
    </span>
  )
}

function UserProfilePreviewCardContent({ data }: { data: UserPreviewCardData }) {
  const user = data.user
  const [followerCount, setFollowerCount] = useState(user?.followerCount ?? 0)

  if (!user) {
    return <div className="p-2.5 text-sm text-muted-foreground">用户不存在</div>
  }

  const hasVerificationOrStatus = Boolean(user.verification || user.status === "BANNED" || user.status === "MUTED")
  const hasDisplayedBadges = user.displayedBadges.length > 0

  if (!data.allowed) {
    return (
      <div className="flex flex-col gap-2.5 p-2.5">
        <div className="flex items-start gap-2.5">
          <UserAvatar
            name={user.displayName}
            avatarPath={user.avatarPath}
            size="md"
            isVip={user.vipActive}
            vipLevel={user.vipLevel}
          />
          <div className="min-w-0 flex-1">
            <PreviewDisplayName
              href={data.profileHref ?? `/users/${user.username}`}
              name={user.displayName}
              role={user.role}
              vipActive={user.vipActive}
              vipLevel={user.vipLevel}
            />
            <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-secondary/35 px-3 py-2.5 text-[13px] leading-6 text-muted-foreground">
          {data.reason ?? "当前无法查看该用户资料。"}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-2">
        <div className="flex w-[76px] flex-col items-start gap-1.5">
          <UserAvatar
            name={user.displayName}
            avatarPath={user.avatarPath}
            size="lg"
            isVip={user.vipActive}
            vipLevel={user.vipLevel}
          />
          {(hasVerificationOrStatus || hasDisplayedBadges) ? (
            <div className="flex w-full flex-nowrap items-center justify-start gap-0.5 overflow-visible">
              {hasVerificationOrStatus ? (
                <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
                  {user.verification ? (
                    <UserVerificationBadge
                      verification={user.verification}
                      compact
                      appearance="plain"
                      className="h-7 min-w-7"
                      iconClassName="h-4 min-w-4 text-[16px]"
                    />
                  ) : null}
                  {user.status === "BANNED" || user.status === "MUTED" ? <UserStatusBadge status={user.status} compact className="h-7 min-w-7 px-1.5 text-[11px]" /> : null}
                </div>
              ) : null}
              {hasVerificationOrStatus && hasDisplayedBadges ? (
                <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 rounded-full bg-foreground/30" />
              ) : null}
              <div className="shrink-0">
                <UserDisplayedBadges
                  badges={user.displayedBadges}
                  compact
                  appearance="plain"
                  spacing="tight"
                  itemClassName="h-7"
                  iconClassName="h-4 min-w-4 text-[16px]"
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <PreviewDisplayName
                href={data.profileHref ?? `/users/${user.username}`}
                name={user.displayName}
                role={user.role}
                vipActive={user.vipActive}
                vipLevel={user.vipLevel}
              />
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
                  <PreviewInlineStat value={user.likeReceivedCount} label="获赞" />
                  <PreviewInlineStat value={followerCount} label="粉丝" />
                </div>
                {data.follow?.canFollow ? (
                  <FollowToggleButton
                    targetType="user"
                    targetId={user.id}
                    initialFollowed={data.follow.initialFollowed}
                    activeLabel="取关"
                    inactiveLabel="关注"
                    showLabel
                    className="h-6 shrink-0 whitespace-nowrap gap-1 rounded-full px-2 text-[10px]"
                    onFollowStateChange={({ followed, changed }) => {
                      if (!changed) {
                        return
                      }

                      setFollowerCount((currentCount) => Math.max(0, currentCount + (followed ? 1 : -1)))
                    }}
                  />
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>Lv.{user.level}</span>
                {user.levelName ? <span>{user.levelName}</span> : null}
                <span>#{formatNumber(user.id)}</span>
                <span>{user.joinedDateText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/70 pt-2.5">
        <div className="grid gap-2 md:grid-cols-[68px_minmax(0,1fr)]">
          <div className="grid grid-cols-4 gap-1 md:flex md:h-full md:flex-col md:justify-center md:gap-1.5">
            <PreviewNavLink
              href={data.profileHref ?? `/users/${user.username}`}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="介绍"
            />
            <PreviewNavLink
              href={data.postsHref ?? `/users/${user.username}?tab=posts`}
              icon={<FileText className="h-3.5 w-3.5" />}
              label="帖子"
            />
            <PreviewNavLink
              href={data.collectionsHref ?? `/users/${user.username}?tab=collections`}
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              label="合集"
            />
            <PreviewNavLink
              href={data.repliesHref ?? `/users/${user.username}?tab=replies`}
              icon={<MessageSquareMore className="h-3.5 w-3.5" />}
              label="评论"
            />
          </div>
          {data.radarData ? (
            <div className="flex items-center justify-center rounded-xl bg-secondary/25 p-1">
              <UserProfileRadarPanel data={data.radarData} className="w-full" variant="preview-card" />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-secondary/15 px-2.5 py-4 text-[11px] text-muted-foreground">
              最近动态未公开
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PreviewNavLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary/55 px-1 py-1.5 text-[10px] font-medium leading-tight text-foreground transition-colors hover:bg-accent hover:text-foreground md:flex-row md:justify-start md:gap-1.5 md:px-2.5 md:text-xs md:leading-normal"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
