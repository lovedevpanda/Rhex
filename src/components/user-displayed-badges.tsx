import { LevelIcon } from "@/components/level-icon"
import { cn } from "@/lib/utils"


export interface DisplayedBadgeItem {
  id: string
  name: string
  color: string
  iconText?: string | null
}

interface UserDisplayedBadgesProps {
  badges?: DisplayedBadgeItem[]
  compact?: boolean
}

export function UserDisplayedBadges({ badges = [], compact = false }: UserDisplayedBadgesProps) {
  if (badges.length === 0) {
    return null
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {badges.slice(0, 3).map((badge) => (
        <span
          key={badge.id}
          title={badge.name}
          className={cn(
            "inline-flex items-center justify-center rounded-full border text-center",
            compact ? "h-5 min-w-5 px-1.5 text-[10px]" : "h-6 min-w-6 px-2 text-xs",
          )}
          style={{
            color: badge.color,
            borderColor: `${badge.color}55`,
            backgroundColor: `${badge.color}12`,
          }}
        >
          <LevelIcon icon={badge.iconText} color={badge.color} className={compact ? "h-3 w-3 text-[12px]" : "h-3.5 w-3.5 text-[14px]"} emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
        </span>

      ))}
    </div>
  )
}
