import { Sparkles } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { Tooltip } from "@/components/ui/tooltip"

interface UserProfileBadgeShowcaseItem {
  id: string
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
      <div className="mt-3 rounded-xl border border-dashed border-[#e8e8e8] px-3 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
        暂无可展示勋章
      </div>
    )
  }

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {badges.map((badge) => (
        <Tooltip
          key={badge.id}
          side="top"
          content={
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg border text-[13px]"
                  style={{
                    color: badge.color,
                    borderColor: `${badge.color}45`,
                    backgroundColor: `${badge.color}16`,
                  }}
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
              <p className="text-[12px] font-medium leading-5 text-slate-600 dark:text-slate-200">
                {badge.description?.trim() || "该勋章暂未填写介绍。"}
              </p>
            </div>
          }
          contentClassName="max-w-[240px]"
        >
          <div className="group cursor-default rounded-2xl border border-transparent bg-transparent p-2 text-center transition-all duration-200 hover:-translate-y-1 hover:border-slate-200/80  hover:shadow-[0_14px_28px_rgba(15,23,42,0.10)] dark:hover:border-white/10 dark:hover:bg-white/[0.03] dark:hover:shadow-[0_14px_28px_rgba(2,6,23,0.45)]">
            <div
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border text-lg transition-transform duration-200 group-hover:scale-[1.08]"
              style={{
                background: `linear-gradient(180deg, ${badge.color}20, ${badge.color}12)`,
                color: badge.color,
                borderColor: `${badge.color}30`,
                boxShadow: `0 10px 22px ${badge.color}22`,
              }}
            >
              <LevelIcon
                icon={badge.iconText}
                color={badge.color}
                className="h-5 w-5 text-[18px]"
                emojiClassName="text-inherit"
                svgClassName="[&>svg]:block"
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-1">
              <p className="line-clamp-1 text-[11px] font-semibold text-foreground transition-colors group-hover:text-slate-950 dark:group-hover:text-slate-50">
                {badge.name}
              </p>
              <Sparkles className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </div>
          </div>
        </Tooltip>
      ))}
    </div>
  )
}
