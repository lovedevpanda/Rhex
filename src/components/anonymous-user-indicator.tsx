"use client"

import Image from "next/image"

import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AnonymousUserIndicatorProps {
  className?: string
  iconClassName?: string
  label?: string
}

export function AnonymousUserIndicator({
  className,
  iconClassName,
  label = "匿名者,社区专用匿名账户",
}: AnonymousUserIndicatorProps) {
  return (
    <Tooltip content={label}>
      <span className={cn("inline-flex shrink-0 items-center", className)} aria-label={label}>
        <Image
          src="/apps/icon/anonymous.svg"
          alt={label}
          width={16}
          height={16}
          className={cn("h-4 w-4", iconClassName)}
        />
      </span>
    </Tooltip>
  )
}
