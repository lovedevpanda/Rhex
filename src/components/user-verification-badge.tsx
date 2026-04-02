import { LevelIcon } from "@/components/level-icon"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface UserVerificationBadgeItem {
  id: string
  name: string
  color: string
  iconText?: string | null
}

interface UserVerificationBadgeProps {
  verification?: UserVerificationBadgeItem | null
  compact?: boolean
  className?: string
  appearance?: "outlined" | "plain"
}

export function UserVerificationBadge({ verification, compact = false, className, appearance = "outlined" }: UserVerificationBadgeProps) {
  if (!verification) {
    return null
  }

  return (
    <Tooltip content={verification.name}>
      <span
        className={cn(
          "inline-flex items-center justify-center align-middle",
          appearance === "outlined" ? "rounded-full border" : "rounded-none border-none bg-transparent",
          compact ? "h-5 w-5" : "h-6 w-6",
          className,
        )}
        aria-label={verification.name}
        style={appearance === "outlined"
          ? {
              color: verification.color,
              borderColor: `${verification.color}55`,
              backgroundColor: `${verification.color}12`,
            }
          : {
              color: verification.color,
            }}
      >
        <LevelIcon
          icon={verification.iconText}
          color={verification.color}
          className={compact ? "h-3 w-3 text-[12px]" : "h-3.5 w-3.5 text-[14px]"}
          emojiClassName="text-inherit"
          svgClassName="[&>svg]:block"
        />
      </span>
    </Tooltip>
  )
}
