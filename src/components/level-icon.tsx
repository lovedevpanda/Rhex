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

function isSvgMarkup(value: string) {
  return SVG_WRAPPER_PATTERN.test(value.trim())
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

function buildSvgMarkup(svg: string, color?: string) {
  let markup = svg.trim()

  if (!markup) {
    return ""
  }

  if (color) {
    markup = markup
      .replace(/fill=(['"])(?!none\1)(?!currentColor\1)[^'"]*\1/gi, "fill=\"currentColor\"")
      .replace(/stroke=(['"])(?!none\1)(?!currentColor\1)[^'"]*\1/gi, "stroke=\"currentColor\"")

    if (!/\s(fill|stroke)=/i.test(markup)) {
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
          className={cn("inline-flex h-full w-full items-center justify-center [&>svg]:h-full [&>svg]:w-full", svgClassName)}
          dangerouslySetInnerHTML={{ __html: buildSvgMarkup(normalizedIcon, color) }}
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
