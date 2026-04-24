import { LevelIcon } from "@/components/level-icon"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface UserVerificationBadgeItem {
  id: string
  name: string
  color: string
  iconText?: string | null
  customIconText?: string | null
  description?: string | null
  customDescription?: string | null
}

interface UserVerificationBadgeProps {
  verification?: UserVerificationBadgeItem | null
  compact?: boolean
  className?: string
  iconClassName?: string
  appearance?: "outlined" | "plain"
}

export function UserVerificationBadge({ verification, compact = false, className, iconClassName, appearance = "outlined" }: UserVerificationBadgeProps) {
  if (!verification) {
    return null
  }

  const effectiveIcon = verification.customIconText?.trim() || verification.iconText
  const tooltipContent = verification.customDescription?.trim()
    ? `${verification.customDescription.trim()}`
    : verification.description?.trim() || verification.name

  return (
    <Tooltip content={tooltipContent}>
      <span
        className={cn(
          "inline-flex items-center justify-center align-middle",
          appearance === "outlined" ? "rounded-full border" : "rounded-none border-none bg-transparent",
          compact ? "h-5 min-w-5" : "h-6 min-w-6",
          className,
        )}
        aria-label={tooltipContent}
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
          icon={effectiveIcon}
          color={verification.color}
          className={cn(compact ? "h-3 min-w-3 text-[12px]" : "h-3.5 min-w-3.5 text-[14px]", iconClassName)}
          emojiClassName="text-inherit"
          svgClassName="[&>svg]:block"
        />
      </span>
    </Tooltip>
  )
}
