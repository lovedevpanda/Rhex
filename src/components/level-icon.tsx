"use client"

import { cn } from "@/lib/utils"
import { isImageSource, isSvgMarkup, sanitizeInlineSvgMarkup } from "@/lib/icon-source"

interface LevelIconProps {
  icon?: string | null
  color?: string
  className?: string
  svgClassName?: string
  emojiClassName?: string
  title?: string
}

export function normalizeLevelIcon(icon?: string | null) {
  const value = icon?.trim()

  if (!value) {
    return "⭐"
  }

  return value
}

export function isLevelSvgIcon(icon?: string | null) {
  return isSvgMarkup(normalizeLevelIcon(icon))
}

export function isLevelImageIcon(icon?: string | null) {
  return isImageSource(normalizeLevelIcon(icon))
}

function buildSvgMarkup(svg: string, color?: string) {
  let markup = sanitizeInlineSvgMarkup(svg)

  if (!markup) {
    return ""
  }

  if (color) {
    const hasExplicitPaint = /\s(fill|stroke)=(['"])(?!none\2)(?!currentColor\2)[^'"]+\2/i.test(markup)

    // Preserve embedded SVG colors. Only fall back to currentColor when the SVG
    // does not declare its own paint attributes and is intended to inherit text color.
    if (!hasExplicitPaint && !/\s(fill|stroke)=/i.test(markup)) {
      markup = markup.replace(/<svg\b/i, '<svg fill="currentColor"')
    }
  }

  return markup
}

export function LevelIcon({ icon, color, className, svgClassName, emojiClassName, title }: LevelIconProps) {
  const normalizedIcon = normalizeLevelIcon(icon)
  const svgMarkup = isLevelSvgIcon(normalizedIcon) ? buildSvgMarkup(normalizedIcon, color) : ""

  if (svgMarkup) {
    return (
      <span
        title={title}
        aria-label={title}
        className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
        style={color ? { color } : undefined}
      >
        <span
          aria-hidden={title ? undefined : true}
          className={cn("inline-flex h-full w-auto max-w-full flex-none items-center justify-center [&>svg]:block [&>svg]:h-full [&>svg]:w-auto [&>svg]:max-w-full", svgClassName)}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </span>
    )
  }

  if (isLevelImageIcon(normalizedIcon)) {
    return (
      <span
        title={title}
        aria-label={title}
        className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
      >
        {/* Dynamic icon sources may be blob/data URLs or arbitrary remote paths, so next/image is not a good fit here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizedIcon}
          alt={title ?? ""}
          aria-hidden={title ? undefined : true}
          className={cn("h-full w-auto max-w-full flex-none object-contain", svgClassName)}
        />
      </span>
    )
  }

  if (isLevelSvgIcon(normalizedIcon) || normalizedIcon.startsWith("<") || normalizedIcon.includes("<svg")) {
    return (
      <span
        title={title}
        aria-label={title}
        className={cn("inline-flex shrink-0 items-center justify-center leading-none", className, emojiClassName)}
        style={color ? { color } : undefined}
      >
        ⭐
      </span>
    )
  }

  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-flex shrink-0 items-center justify-center leading-none", className, emojiClassName)}
      style={color ? { color } : undefined}
    >
      {normalizedIcon}
    </span>
  )
}
