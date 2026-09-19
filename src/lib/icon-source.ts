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

const UNSAFE_SVG_CONTENT_PATTERN = /<\s*\/?\s*(?:script|style|foreignobject|iframe|object|embed|audio|video|image|animate(?:color|motion|transform)?|set)\b|(?:^|[\s/])(?:on[a-z]+|style|src|xlink:href|href)\s*=|\s(?:xlink:)?href\s*=\s*(?!(?:["']#|#))|(?:javascript|vbscript)\s*:|@import|url\s*\(\s*(?!["']?\s*#)|&#/i

/**
 * 归一化 SVG 标记后再做安全检查。
 *
 * ## 为什么需要这一步
 *
 * HTML 解析器把 `/` 也当作属性分隔符：`<svg/onload=alert(1)>` 里的 `onload`
 * 是一个真实的事件处理器。而检查用的正则要求 `on*=` 前面是空白，于是这类写法
 * 会被放行 —— 已实测：`<svg/onload=...>`、`<svg id=x/onload=...>`、
 * `<svg\t/onload=...>`、`<a xlink:href="#x" /onclick=...>` 全部通过检查，
 * 而这些标记会被 `LevelIcon` 用 dangerouslySetInnerHTML 内联进页面，等于全站 XSS。
 *
 * 与其在正则里逐个补"解析器的等价写法"（黑名单永远补不完），不如**先把它们
 * 收敛成统一形式**再检查：
 *   - 标签名后的 `/`（含空白后）改成空格，消掉 `<svg/onload=` 这种粘写
 *   - 属性名前的 `/` 改成空格，消掉 `/onclick=` 这种粘写
 *
 * 归一化只影响"分隔符的写法"，不改变标记语义，所以合法图标不受影响。
 */
export function normalizeSvgMarkupForInspection(markup: string) {
  return markup
    .replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)\s*\//g, "<$1 ")
    .replace(/\//g, " ")
}

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

  if (!isSvgMarkup(markup)) {
    return null
  }

  // 归一化后再检查：把 `/` 分隔的属性写法收敛成空白，避免黑白名单判定被粘写绕过
  if (UNSAFE_SVG_CONTENT_PATTERN.test(normalizeSvgMarkupForInspection(markup))) {
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
