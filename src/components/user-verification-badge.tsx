import { LevelIcon } from "@/components/level-icon"
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
}

export function UserVerificationBadge({ verification, compact = false, className }: UserVerificationBadgeProps) {
  if (!verification) {
    return null
  }

  return (
    <span
      title={verification.name}
      className={cn(
        "inline-flex items-center justify-center rounded-full border align-middle",
        compact ? "h-5 w-5" : "h-6 w-6",
        className,
      )}
      style={{
        color: verification.color,
        borderColor: `${verification.color}55`,
        backgroundColor: `${verification.color}12`,
      }}
    >
      <LevelIcon
        icon={verification.iconText}
        color={verification.color}
        className={compact ? "h-3 w-3 text-[12px]" : "h-3.5 w-3.5 text-[14px]"}
        emojiClassName="text-inherit"
        svgClassName="[&>svg]:block"
        title={verification.name}
      />
    </span>
  )
}
