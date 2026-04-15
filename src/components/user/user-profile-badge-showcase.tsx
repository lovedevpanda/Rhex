import Link from "next/link"

import { LevelIcon } from "@/components/level-icon"
import { Tooltip } from "@/components/ui/tooltip"

interface UserProfileBadgeShowcaseItem {
  id: string
  code: string
  name: string
  description?: string | null
  color: string
  iconText?: string | null
}

interface UserProfileBadgeShowcaseProps {
  badges: UserProfileBadgeShowcaseItem[]
}

export function UserProfileBadgeShowcase({ badges }: UserProfileBadgeShowcaseProps) {
  if (badges.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed  px-3 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
        暂无可展示勋章
      </div>
    )
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {badges.map((badge) => (
        <Tooltip
          key={badge.id}
          side="top"
          content={
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center text-[13px]"
                  style={{ color: badge.color }}
                >
                  <LevelIcon
                    icon={badge.iconText}
                    color={badge.color}
                    className="h-3.5 w-3.5 text-[14px]"
                    emojiClassName="text-inherit"
                    svgClassName="[&>svg]:block"
                  />
                </span>
                <span>{badge.name}</span>
              </div>
              <p className="text-[12px] font-medium leading-5">
                {badge.description?.trim() || "该勋章暂未填写介绍。"}
              </p>
            </div>
          }
          contentClassName="max-w-[240px]"
        >
          <Link href={`/badges/${badge.code}`} className="flex min-w-0 items-center gap-1.5 text-left">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center text-lg"
              style={{ color: badge.color }}
            >
              <LevelIcon
                icon={badge.iconText}
                color={badge.color}
                className="h-4 w-4 text-[16px]"
                emojiClassName="text-inherit"
                svgClassName="[&>svg]:block"
              />
            </div>
            <p className="line-clamp-1 min-w-0 text-[12px] font-semibold leading-5 text-foreground">
              {badge.name}
            </p>
          </Link>
        </Tooltip>
      ))}
    </div>
  )
}
