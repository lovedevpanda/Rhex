import type { ReactNode } from "react"

import { Tooltip } from "@/components/ui/tooltip"

interface VipNameTooltipProps {
  isVip?: boolean
  level?: number | null
  children: ReactNode
}

export function VipNameTooltip({ isVip, level, children }: VipNameTooltipProps) {
  if (!isVip || !level || level <= 0) {
    return <>{children}</>
  }

  return <Tooltip content={`VIP${level} 会员`}>{children}</Tooltip>
}
