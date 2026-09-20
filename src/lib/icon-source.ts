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

/**
 * 危险结构黑名单。
 *
 * 第二分支的 `(?:^|[\s/])` 前缀是为了覆盖「`/` 当属性分隔符」的写法，
 * 归一步骤(见 normalizeSvgMarkupForInspection)已把它收敛成空白，这里保留双保险。
 *
 * href 不在第二分支里：合法的图标会用 `<use href="#icon">` 或 `fill="url(#g)"`
 * 引用同文档片段，一刀切会误杀。第三分支只放行 `#fragment` 形式的引用。
 */
const UNSAFE_SVG_CONTENT_PATTERN = /<\s*\/?\s*(?:script|style|foreignobject|iframe|object|embed|audio|video|image|animate(?:color|motion|transform)?|set)\b|(?:^|[\s/])(?:on[a-z]+|style|src)\s*=|\s(?:xlink:)?href\s*=\s*(?!(?:["']#|#))|(?:javascript|vbscript)\s*:|@import|url\s*\(\s*(?!["']?\s*#)|&#/i

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
 * 与其在正则里逐个补"解析器的等价写法"（黑名单永远补不完），不如**先收敛再检查**：
 * 把「标签名后」与「属性名前」的 `/` 换成空格。
 *
 * 关键点：必须**跳过引号内的内容**。`href="#a/b"` 里的 `/` 不是分隔符，
 * 一并替换会让合法图标被误判 —— 早期版本就把所有 `<use href="#icon">` 拒掉了。
 */
export function normalizeSvgMarkupForInspection(markup: string) {
  // 引号内的字符串先摘出来存好，用不含 `/` 的占位符代替，处理完再还原
  const literals: string[] = []
  const withPlaceholders = markup.replace(/"[^"]*"|'[^']*'/g, (literal) => {
    literals.push(literal)
    return `\u0000${literals.length - 1}\u0000`
  })

  const normalized = withPlaceholders
    // 标签名后紧跟的 "/"（如 <svg/onload=\>）不是自闭合语义，改成空格
    .replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)\s*\//g, "<$1 ")
    // 其余位于引号外的 "/" 一律视为属性分隔符
    .replace(/\//g, " ")

  return normalized.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => literals[Number(index)] ?? "")
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
