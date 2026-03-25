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
      <span aria-hidden>{icon}</span>
      <span>{name}</span>
      <span>Lv.{level}</span>
    </span>
  )
}
