export interface MarkdownEmojiItem {
  shortcode: string
  label: string
  icon: string
}

const SHORTCODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/i
const SVG_WRAPPER_PATTERN = /^<svg[\s\S]*<\/svg>$/i
const REMOTE_URL_PATTERN = /^(https?:)?\/\//i
const DATA_IMAGE_PATTERN = /^data:image\//i
const BLOB_URL_PATTERN = /^blob:/i
const LOCAL_ASSET_PATTERN = /^(\/|\.\/|\.\.\/)/

export const DEFAULT_MARKDOWN_EMOJI_ITEMS: MarkdownEmojiItem[] = [
  { shortcode: "smile", label: "微笑", icon: "😀" },
  { shortcode: "heart", label: "爱心", icon: "❤️" },
  { shortcode: "rocket", label: "火箭", icon: "🚀" },
  { shortcode: "fire", label: "火焰", icon: "🔥" },
  { shortcode: "sparkles", label: "闪光", icon: "✨" },

]

function normalizeShortcode(value: string) {
  return value.trim().replace(/^:+|:+$/g, "").toLowerCase()
}

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

export function isMarkdownEmojiSvg(icon?: string | null) {
  return !!icon && isSvgMarkup(icon)
}

export function isMarkdownEmojiImage(icon?: string | null) {
  return !!icon && isImageSource(icon)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildSvgMarkup(svg: string) {
  return svg.trim()
}

export function normalizeOptionalMarkdownEmojiItems(
  input: unknown,
  fallback: MarkdownEmojiItem[] = [],
): MarkdownEmojiItem[] {
  if (!Array.isArray(input)) {
    return fallback
  }

  const seen = new Set<string>()
  const normalized = input
    .map((item) => {
      const row = item as Record<string, unknown>
      const shortcode = normalizeShortcode(String(row.shortcode ?? ""))
      const label = String(row.label ?? "").trim()
      const icon = String(row.icon ?? "").trim()

      if (!shortcode || !SHORTCODE_PATTERN.test(shortcode) || !icon || seen.has(shortcode)) {
        return null
      }

      seen.add(shortcode)
      return {
        shortcode,
        label: label || shortcode,
        icon,
      }
    })
    .filter(Boolean) as MarkdownEmojiItem[]

  return normalized.length > 0 ? normalized : fallback
}

export function normalizeMarkdownEmojiItems(input: unknown): MarkdownEmojiItem[] {
  return normalizeOptionalMarkdownEmojiItems(input, DEFAULT_MARKDOWN_EMOJI_ITEMS)
}

export function parseMarkdownEmojiMapJson(raw: string | null | undefined) {
  if (!raw) {
    return DEFAULT_MARKDOWN_EMOJI_ITEMS
  }

  try {
    return normalizeMarkdownEmojiItems(JSON.parse(raw))
  } catch {
    return DEFAULT_MARKDOWN_EMOJI_ITEMS
  }
}

export function serializeMarkdownEmojiItems(items: MarkdownEmojiItem[]) {
  return JSON.stringify(normalizeMarkdownEmojiItems(items))
}

export function getMarkdownEmojiMap(items: MarkdownEmojiItem[]) {
  return new Map(normalizeMarkdownEmojiItems(items).map((item) => [item.shortcode, item]))
}

export function renderMarkdownEmojiHtml(shortcode: string, items: MarkdownEmojiItem[]) {
  const normalizedShortcode = normalizeShortcode(shortcode)
  const matched = getMarkdownEmojiMap(items).get(normalizedShortcode)

  if (!matched) {
    return null
  }

  const title = escapeHtml(matched.label)

  if (isSvgMarkup(matched.icon)) {
    return `<span class="md-emoji md-emoji-svg" data-shortcode="${matched.shortcode}" title="${title}" aria-label="${title}"><span class="md-emoji-icon">${buildSvgMarkup(matched.icon)}</span></span>`
  }

  if (isImageSource(matched.icon)) {
    return `<span class="md-emoji md-emoji-image" data-shortcode="${matched.shortcode}" title="${title}" aria-label="${title}"><img class="md-emoji-icon" src="${escapeHtml(matched.icon)}" alt="${title}" loading="lazy" decoding="async" /></span>`
  }

  return `<span class="md-emoji md-emoji-text" data-shortcode="${matched.shortcode}" title="${title}" aria-label="${title}">${escapeHtml(matched.icon)}</span>`
}
