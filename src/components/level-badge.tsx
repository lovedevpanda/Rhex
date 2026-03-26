import { LevelIcon } from "@/components/level-icon"

interface LevelBadgeProps {
  level: number
  name: string
  color: string
  icon: string
  compact?: boolean
}

export function LevelBadge({ level, name, color, icon, compact = false }: LevelBadgeProps) {
  return (
    <span
      className={compact ? "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"}
      style={{
        color,
        backgroundColor: `${color}1A`,
        border: `1px solid ${color}33`,
      }}
    >
      <LevelIcon icon={icon} color={color} className={compact ? "h-3 w-3 text-[12px]" : "h-3.5 w-3.5 text-[14px]"} emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
      <span>{name}</span>
      <span>Lv.{level}</span>
    </span>
  )
}

