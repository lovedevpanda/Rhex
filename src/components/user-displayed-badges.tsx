import { LevelIcon } from "@/components/level-icon"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"


export interface DisplayedBadgeItem {
  id: string
  name: string
  description?: string | null
  color: string
  iconText?: string | null
}

interface UserDisplayedBadgesProps {
  badges?: DisplayedBadgeItem[]
  compact?: boolean
  appearance?: "outlined" | "plain"
  spacing?: "default" | "tight"
}

export function UserDisplayedBadges({ badges = [], compact = false, appearance = "outlined", spacing = "default" }: UserDisplayedBadgesProps) {
  if (badges.length === 0) {
    return null
  }

  return (
    <div className={cn("inline-flex items-center", spacing === "tight" ? "gap-0.5" : "gap-1.5")}>
      {badges.slice(0, 3).map((badge) => (
        <Tooltip key={badge.id} content={badge.description?.trim() || badge.name}>
          <span
            className={cn(
              "inline-flex items-center justify-center text-center",
              appearance === "outlined" ? "rounded-full border" : "rounded-none border-none bg-transparent",
              compact ? "h-5 text-[10px]" : "h-6  text-xs",
            )}
            aria-label={badge.name}
            style={appearance === "outlined"
              ? {
                  color: badge.color,
                  borderColor: `${badge.color}55`,
                  backgroundColor: `${badge.color}12`,
                }
              : {
                  color: badge.color,
                }}
          >
            <LevelIcon icon={badge.iconText} color={badge.color} className={compact ? "h-3 w-3 text-[12px]" : "h-3.5 w-3.5 text-[14px]"} emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
          </span>
        </Tooltip>

      ))}
    </div>
  )
}
