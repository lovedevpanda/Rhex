const SVG_PREFIX_PATTERN = /^(?:<\?xml[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!doctype\s+svg[\s\S]*?>\s*)*/i
const SVG_MARKUP_PATTERN = /^(?:<\?xml[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!doctype\s+svg[\s\S]*?>\s*)*<svg\b[\s\S]*<\/svg>\s*$/i
const REMOTE_URL_PATTERN = /^(https?:)?\/\//i
const DATA_IMAGE_PATTERN = /^data:image\//i
const BLOB_URL_PATTERN = /^blob:/i
const LOCAL_ASSET_PATTERN = /^(\/|\.\/|\.\.\/)/
const ICON_TEXT_SUMMARY_MAX_LENGTH = 24

export function isSvgMarkup(value: string | null | undefined) {
  return SVG_MARKUP_PATTERN.test(String(value ?? "").trim())
}

export function isImageSource(value: string | null | undefined) {
  const normalizedValue = String(value ?? "").trim()

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

const UNSAFE_SVG_CONTENT_PATTERN = /<\s*\/?\s*(?:script|style|foreignobject|iframe|object|embed|audio|video|image|animate(?:color|motion|transform)?|set)\b|\s(?:on[a-z]+|style|src)\s*=|\s(?:xlink:)?href\s*=\s*(?!(?:["']#|#))|(?:javascript|vbscript)\s*:|@import|url\s*\(\s*(?!["']?\s*#)|&#/i

export function stripSvgDocumentPrefix(value: string) {
  return value.trim().replace(SVG_PREFIX_PATTERN, "")
}

/**
 * SVG markup is rendered inline for level icons, so it must not contain browser-executable
 * elements, event handlers, CSS, or external references. Unsupported markup is rejected
 * rather than partially rewritten to avoid creating a sanitizer bypass surface.
 */
export function sanitizeInlineSvgMarkup(value: string) {
  const markup = stripSvgDocumentPrefix(value)

  if (!isSvgMarkup(markup) || UNSAFE_SVG_CONTENT_PATTERN.test(markup)) {
    return null
  }

  return markup
}

export function describeIconSource(value: string | null | undefined) {
  const normalizedValue = String(value ?? "").trim()

  if (!normalizedValue) {
    return ""
  }

  if (isSvgMarkup(normalizedValue)) {
    return "SVG 图标"
  }

  if (isImageSource(normalizedValue)) {
    if (DATA_IMAGE_PATTERN.test(normalizedValue)) {
      return "图片数据"
    }

    if (BLOB_URL_PATTERN.test(normalizedValue)) {
      return "临时图片"
    }

    const pathWithoutQuery = normalizedValue.split(/[?#]/)[0] ?? ""
    const filename = pathWithoutQuery.split("/").filter(Boolean).at(-1)
    return filename ? `图片：${filename}` : "图片图标"
  }

  return normalizedValue.length > ICON_TEXT_SUMMARY_MAX_LENGTH
    ? `${normalizedValue.slice(0, ICON_TEXT_SUMMARY_MAX_LENGTH)}...`
    : normalizedValue
}
