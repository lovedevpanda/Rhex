interface VipBadgeProps {
  level?: number | null
  compact?: boolean
}

function getVipBadgeClasses(level: number, compact: boolean) {
  const sizeClasses = compact
    ? "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
    : "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"

  if (level >= 3) {
    return `${sizeClasses} bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-100`
  }

  if (level === 2) {
    return `${sizeClasses} bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-100`
  }

  return `${sizeClasses} bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-100`
}

export function VipBadge({ level = 1, compact = false }: VipBadgeProps) {
  const normalizedLevel = Math.max(1, level ?? 1)

  return (
    <span className={getVipBadgeClasses(normalizedLevel, compact)}>
      VIP{normalizedLevel}
    </span>
  )
}
