"use client"

import { cn } from "@/lib/utils"

interface LevelIconProps {
  icon?: string | null
  color?: string
  className?: string
  svgClassName?: string
  emojiClassName?: string
  title?: string
}

const SVG_WRAPPER_PATTERN = /^<svg[\s\S]*<\/svg>$/i
const REMOTE_URL_PATTERN = /^(https?:)?\/\//i
const DATA_IMAGE_PATTERN = /^data:image\//i
const BLOB_URL_PATTERN = /^blob:/i
const LOCAL_ASSET_PATTERN = /^(\/|\.\/|\.\.\/)/

function isSvgMarkup(value: string) {
  return SVG_WRAPPER_PATTERN.test(value.trim())
}

function isImageSource(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue || isSvgMarkup(normalizedValue)) {
    return false
  }

  return (
    REMOTE_URL_PATTERN.test(normalizedValue) ||
    DATA_IMAGE_PATTERN.test(normalizedValue) ||
    BLOB_URL_PATTERN.test(normalizedValue) ||
    LOCAL_ASSET_PATTERN.test(normalizedValue)
  )
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
  let markup = svg.trim()

  if (!markup) {
    return ""
  }

  if (color) {
    const hasExplicitPaint = /\s(fill|stroke)=(['"])(?!none\2)(?!currentColor\2)[^'"]+\2/i.test(markup)

    // Preserve embedded SVG colors. Only fall back to currentColor when the SVG
    // does not declare its own paint attributes and is intended to inherit text color.
    if (!hasExplicitPaint && !/\s(fill|stroke)=/i.test(markup)) {
      markup = markup.replace(/^<svg\b/i, '<svg fill="currentColor"')
    }
  }

  return markup
}

export function LevelIcon({ icon, color, className, svgClassName, emojiClassName, title }: LevelIconProps) {
  const normalizedIcon = normalizeLevelIcon(icon)

  if (isLevelSvgIcon(normalizedIcon)) {
    return (
      <span
        title={title}
        aria-label={title}
        className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
        style={color ? { color } : undefined}
      >
        <span
          aria-hidden={title ? undefined : true}
          className={cn("inline-flex h-full w-auto max-w-none flex-none items-center justify-center [&>svg]:block [&>svg]:h-full [&>svg]:w-auto [&>svg]:max-w-none", svgClassName)}
          dangerouslySetInnerHTML={{ __html: buildSvgMarkup(normalizedIcon, color) }}
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
          className={cn("h-full w-auto max-w-none flex-none object-contain", svgClassName)}
        />
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
