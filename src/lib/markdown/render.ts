import MarkdownIt from "markdown-it"
import markdownItAbbr from "markdown-it-abbr"
import markdownItContainer from "markdown-it-container"
import markdownItDeflist from "markdown-it-deflist"
import markdownItFootnote from "markdown-it-footnote"
import markdownItIns from "markdown-it-ins"
import markdownItKatex from "@traptitech/markdown-it-katex"
import markdownItMark from "markdown-it-mark"
import markdownItSub from "markdown-it-sub"
import markdownItSup from "markdown-it-sup"
import markdownItTaskLists from "markdown-it-task-lists"
import hljs from "highlight.js"

import { renderUserLinkTokens } from "@/lib/mentions"
import { renderMarkdownEmojiHtml, type MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { isSupportedMarkdownEmbedSrc, normalizeMarkdownMediaSrc } from "@/lib/markdown/media"
import { escapeHtml } from "@/lib/markdown/shared"
import { renderPostCardEmbedHtml } from "@/lib/post-card-embed"
import type { PostLinkDisplayMode } from "@/lib/site-settings"

interface MarkdownHeadingToken {
  tag: string
  content?: string
  attrs?: MarkdownTokenAttrs
}

const CALLOUT_TYPES = ["info", "tip", "warning", "danger", "success"] as const
const CALLOUT_ICON_SYMBOLS: Record<CalloutType, string> = {
  info: "i",
  tip: "✦",
  warning: "!",
  danger: "×",
  success: "✓",
}

const ALLOWED_MARKDOWN_HTML_ALIGNMENTS = new Set(["left", "center", "right", "justify"])
const ALLOWED_MARKDOWN_HTML_INLINE_TAGS = new Set(["ruby", "rt", "rp", "span"])
const RUBY_SYNTAX_PATTERN = /\[([^\]\n]+)\](?:\^\(([^)\n]+)\)|\{([^}\n]+)\})/g
const RUBY_READING_SEPARATORS = [" ", "　", "·", "・", "．", "。", "-"] as const
const WAVY_SYNTAX_PATTERN = /(^|[^~\\])~([^~\n]+)~(?=[^~]|$)/g
const SCRATCH_MASK_SYNTAX_PATTERN = /(^|[^!\\])!!([^!\n]+?)!!(?=[^!]|$)/g
const HTML_CODE_BLOCK_START_PATTERN = /^\s*<(?:!doctype|html|head|body|meta|title|style|script|link)\b/i
const HTML_CODE_BLOCK_TAG_LINE_PATTERN = /^\s*(?:<!doctype[^>]*>|<!--.*?-->|<\/?[a-zA-Z][\w:-]*(?:\s+[^>]*)?\s*\/?>)\s*$/i
const HTML_CODE_BLOCK_INLINE_TAG_PATTERN = /^\s*<([a-zA-Z][\w:-]*)(?:\s+[^>]*)?>.*<\/\1>\s*$/i
const HTML_CODE_BLOCK_LANGUAGE_ALIASES = new Set(["html", "htm"])
const LINK_CANDIDATE_PATH_CHARS = "A-Za-z0-9\\p{L}\\p{N}\\p{M}\\-._~/?#\\[\\]@!$&*+,;=%"
const LINK_CANDIDATE_PATH_SEGMENT = `[/?#][${LINK_CANDIDATE_PATH_CHARS}]*`
const LINK_CANDIDATE_PATTERN = new RegExp(
  `https?:\\/\\/[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\\d{1,5})?(?:${LINK_CANDIDATE_PATH_SEGMENT})?`,
  "giu",
)

export const MARKDOWN_RENDER_OUTPUT_VERSION = "raw-html-sanitize-2026-07-10-multiline-safe"

type CalloutType = (typeof CALLOUT_TYPES)[number]
const MARKDOWN_RENDERER_CACHE_LIMIT = 8
const markdownRendererCache = new Map<string, MarkdownIt>()

interface MarkdownRenderEnv {
  __usedHeadingSlugs?: Map<string, number>
}

interface MarkdownRenderOptions {
  postLinkDisplayMode?: PostLinkDisplayMode
}

interface EscapedHtmlPlaceholder {
  marker: string
  html: string
}

type MarkdownTokenAttrTuple = [string, string]
type MarkdownTokenAttrs = MarkdownTokenAttrTuple[] | Record<string, unknown>

interface MarkdownToken {
  type: string
  tag: string
  nesting: number
  content: string
  attrs: MarkdownTokenAttrs | null
  markup: string
  info: string
  level: number
  children?: MarkdownToken[] | null
}

interface MarkdownTokenConstructor {
  new (type: string, tag: string, nesting: number): MarkdownToken
}

interface MarkdownCoreState {
  tokens: MarkdownToken[]
  Token: MarkdownTokenConstructor
}

interface LinkifyMatch {
  index: number
  lastIndex: number
  text: string
  url: string
}

interface LinkifyLike {
  match(input: string): LinkifyMatch[] | null
  set(options: { fuzzyLink?: boolean; fuzzyEmail?: boolean; fuzzyIP?: boolean }): LinkifyLike
}

interface MarkdownItWithLinkifyCore extends MarkdownIt {
  core: {
    ruler: {
      after(afterName: string, ruleName: string, rule: (state: MarkdownCoreState) => void): void
    }
  }
  linkify: LinkifyLike
  normalizeLink(url: string): string
  validateLink(url: string): boolean
}

interface AutoLinkMatch {
  start: number
  end: number
  text: string
  url: string
}

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function createTextToken(Token: MarkdownTokenConstructor, content: string, level: number) {
  const token = new Token("text", "", 0)
  token.content = content
  token.level = level
  return token
}

function normalizeMarkdownTokenAttrs(attrs: MarkdownTokenAttrs | null | undefined): MarkdownTokenAttrTuple[] | null {
  if (!attrs) {
    return null
  }

  const nextAttrs: MarkdownTokenAttrTuple[] = []

  if (Array.isArray(attrs)) {
    for (const item of attrs) {
      if (!Array.isArray(item) || item.length < 2 || typeof item[0] !== "string") {
        continue
      }

      nextAttrs.push([item[0], String(item[1] ?? "")])
    }
  } else {
    for (const [name, value] of Object.entries(attrs)) {
      nextAttrs.push([name, String(value ?? "")])
    }
  }

  return nextAttrs.length > 0 ? nextAttrs : null
}

function cloneMarkdownToken(Token: MarkdownTokenConstructor, token: MarkdownToken) {
  const nextToken = new Token(token.type, token.tag, token.nesting)
  nextToken.content = token.content
  nextToken.attrs = normalizeMarkdownTokenAttrs(token.attrs)
  nextToken.markup = token.markup
  nextToken.info = token.info
  nextToken.level = token.level
  nextToken.children = token.children ? token.children.map((child) => cloneMarkdownToken(Token, child)) : null
  return nextToken
}

function createParagraphToken(Token: MarkdownTokenConstructor, nesting: 1 | -1, level: number) {
  const token = new Token(nesting === 1 ? "paragraph_open" : "paragraph_close", "p", nesting)
  token.level = level
  return token
}

function createInlineToken(Token: MarkdownTokenConstructor, children: MarkdownToken[], level: number) {
  const token = new Token("inline", "", 0)
  token.children = children
  token.content = children.map((child) => child.content).join("")
  token.level = level
  return token
}

function trimTextTokenEdges(Token: MarkdownTokenConstructor, tokens: MarkdownToken[]) {
  const nextTokens = tokens.map((token) => cloneMarkdownToken(Token, token))

  for (const token of nextTokens) {
    if (token.type === "text") {
      token.content = token.content.replace(/^\s+/, "")
      break
    }
  }

  for (let index = nextTokens.length - 1; index >= 0; index -= 1) {
    const token = nextTokens[index]
    if (token?.type === "text") {
      token.content = token.content.replace(/\s+$/, "")
      break
    }
  }

  return nextTokens.filter((token) => token.type !== "text" || token.content.length > 0)
}

function isImageToken(token: MarkdownToken | undefined) {
  return token?.type === "image"
}

function isLinkedImageTokenSequence(tokens: MarkdownToken[], index: number) {
  return (
    tokens[index]?.type === "link_open"
    && tokens[index + 1]?.type === "image"
    && tokens[index + 2]?.type === "link_close"
  )
}

function splitInlineChildrenByImage(Token: MarkdownTokenConstructor, children: MarkdownToken[]) {
  const segments: MarkdownToken[][] = []
  let currentSegment: MarkdownToken[] = []
  let hasImageSegment = false

  function pushCurrentSegment() {
    const trimmedSegment = trimTextTokenEdges(Token, currentSegment)
    if (trimmedSegment.length > 0) {
      segments.push(trimmedSegment)
    }
    currentSegment = []
  }

  for (let index = 0; index < children.length; index += 1) {
    if (isLinkedImageTokenSequence(children, index)) {
      pushCurrentSegment()
      segments.push([
        cloneMarkdownToken(Token, children[index]),
        cloneMarkdownToken(Token, children[index + 1]),
        cloneMarkdownToken(Token, children[index + 2]),
      ])
      hasImageSegment = true
      index += 2
      continue
    }

    const child = children[index]
    if (isImageToken(child)) {
      pushCurrentSegment()
      segments.push([cloneMarkdownToken(Token, child)])
      hasImageSegment = true
      continue
    }

    currentSegment.push(child)
  }

  pushCurrentSegment()

  return hasImageSegment && segments.length > 1 ? segments : null
}

function splitMixedImageParagraphs(markdown: MarkdownItWithLinkifyCore) {
  markdown.core.ruler.after("inline", "split_mixed_image_paragraphs", (state) => {
    for (let index = 0; index < state.tokens.length - 2; index += 1) {
      const paragraphOpenToken = state.tokens[index]
      const inlineToken = state.tokens[index + 1]
      const paragraphCloseToken = state.tokens[index + 2]

      if (
        paragraphOpenToken?.type !== "paragraph_open"
        || inlineToken?.type !== "inline"
        || paragraphCloseToken?.type !== "paragraph_close"
        || !inlineToken.children?.length
      ) {
        continue
      }

      const segments = splitInlineChildrenByImage(state.Token, inlineToken.children)
      if (!segments) {
        continue
      }

      const replacement = segments.flatMap((segment) => [
        createParagraphToken(state.Token, 1, paragraphOpenToken.level),
        createInlineToken(state.Token, segment, inlineToken.level),
        createParagraphToken(state.Token, -1, paragraphCloseToken.level),
      ])

      state.tokens.splice(index, 3, ...replacement)
      index += replacement.length - 1
    }
  })
}

function trimAutoLinkCandidate(input: string) {
  return input.replace(/[.,!?;:]+$/g, "")
}

function hasAutoLinkBoundary(text: string, start: number, end: number) {
  const before = start > 0 ? text[start - 1] : ""
  const after = end < text.length ? text[end] : ""

  return !/[A-Za-z0-9@/._~-]/.test(before) && !/[A-Za-z0-9@/_~-]/.test(after)
}

function findAutoLinkMatch(text: string, linkify: LinkifyLike): AutoLinkMatch | null {
  LINK_CANDIDATE_PATTERN.lastIndex = 0

  for (const match of text.matchAll(LINK_CANDIDATE_PATTERN)) {
    const rawCandidate = match[0]
    const candidate = trimAutoLinkCandidate(rawCandidate)
    const start = match.index ?? 0
    const end = start + candidate.length

    if (!candidate || !hasAutoLinkBoundary(text, start, end)) {
      continue
    }

    const linkMatches = linkify.match(candidate)
    const linkMatch = linkMatches?.[0]
    if (!linkMatch || linkMatch.index !== 0 || linkMatch.lastIndex !== candidate.length) {
      continue
    }

    if (start === 0 && end === text.length) {
      return null
    }

    return {
      start,
      end,
      text: candidate,
      url: linkMatch.url,
    }
  }

  return null
}

function collectAutoLinkMatches(text: string, linkify: LinkifyLike) {
  const matches: AutoLinkMatch[] = []
  let lastEnd = 0

  LINK_CANDIDATE_PATTERN.lastIndex = 0

  for (const match of text.matchAll(LINK_CANDIDATE_PATTERN)) {
    const rawCandidate = match[0]
    const candidate = trimAutoLinkCandidate(rawCandidate)
    const start = match.index ?? 0
    const end = start + candidate.length

    if (!candidate || start < lastEnd || !hasAutoLinkBoundary(text, start, end)) {
      continue
    }

    const linkMatches = linkify.match(candidate)
    const linkMatch = linkMatches?.[0]
    if (!linkMatch || linkMatch.index !== 0 || linkMatch.lastIndex !== candidate.length) {
      continue
    }

    matches.push({
      start,
      end,
      text: candidate,
      url: linkMatch.url,
    })
    lastEnd = end
  }

  return matches
}

function splitAutoLinkToken(
  tokens: MarkdownToken[],
  index: number,
  Token: MarkdownTokenConstructor,
  markdown: MarkdownItWithLinkifyCore,
) {
  const linkOpenToken = tokens[index]
  const linkTextToken = tokens[index + 1]
  const linkCloseToken = tokens[index + 2]

  if (
    !linkOpenToken
    || !linkTextToken
    || !linkCloseToken
    || linkOpenToken.type !== "link_open"
    || linkTextToken.type !== "text"
    || linkCloseToken.type !== "link_close"
    || linkOpenToken.markup !== "linkify"
    || linkOpenToken.info !== "auto"
  ) {
    return null
  }

  const linkMatch = findAutoLinkMatch(linkTextToken.content, markdown.linkify)
  if (!linkMatch) {
    return null
  }

  const normalizedUrl = markdown.normalizeLink(linkMatch.url)
  if (!markdown.validateLink(normalizedUrl)) {
    return null
  }

  const prefix = linkTextToken.content.slice(0, linkMatch.start)
  const suffix = linkTextToken.content.slice(linkMatch.end)
  const replacement: MarkdownToken[] = []

  if (prefix) {
    replacement.push(createTextToken(Token, prefix, linkOpenToken.level))
  }

  const nextLinkOpenToken = cloneMarkdownToken(Token, linkOpenToken)
  nextLinkOpenToken.attrs = upsertAttribute(nextLinkOpenToken.attrs ?? undefined, "href", normalizedUrl)
  replacement.push(nextLinkOpenToken)
  replacement.push(createTextToken(Token, linkMatch.text, linkTextToken.level))
  replacement.push(cloneMarkdownToken(Token, linkCloseToken))

  if (suffix) {
    replacement.push(createTextToken(Token, suffix, linkOpenToken.level))
  }

  return replacement
}

function linkifyTextToken(
  token: MarkdownToken,
  Token: MarkdownTokenConstructor,
  markdown: MarkdownItWithLinkifyCore,
) {
  const linkMatches = collectAutoLinkMatches(token.content, markdown.linkify)
  if (linkMatches.length === 0) {
    return null
  }

  const replacement: MarkdownToken[] = []
  let lastEnd = 0
  let level = token.level

  for (const linkMatch of linkMatches) {
    const normalizedUrl = markdown.normalizeLink(linkMatch.url)
    if (!markdown.validateLink(normalizedUrl)) {
      continue
    }

    if (linkMatch.start > lastEnd) {
      replacement.push(createTextToken(Token, token.content.slice(lastEnd, linkMatch.start), token.level))
    }

    const linkOpenToken = new Token("link_open", "a", 1)
    linkOpenToken.attrs = [["href", normalizedUrl]]
    linkOpenToken.level = level++
    linkOpenToken.markup = "linkify"
    linkOpenToken.info = "auto"
    replacement.push(linkOpenToken)

    replacement.push(createTextToken(Token, linkMatch.text, level))

    const linkCloseToken = new Token("link_close", "a", -1)
    linkCloseToken.level = --level
    linkCloseToken.markup = "linkify"
    linkCloseToken.info = "auto"
    replacement.push(linkCloseToken)

    lastEnd = linkMatch.end
  }

  if (lastEnd === 0) {
    return null
  }

  if (lastEnd < token.content.length) {
    replacement.push(createTextToken(Token, token.content.slice(lastEnd), token.level))
  }

  return replacement
}

function fixCjkAutoLinkBoundaries(markdown: MarkdownItWithLinkifyCore) {
  markdown.core.ruler.after("linkify", "fix_cjk_auto_link_boundaries", (state) => {
    for (const blockToken of state.tokens) {
      if (blockToken.type !== "inline" || !blockToken.children?.length) {
        continue
      }

      for (let index = 0; index < blockToken.children.length - 2; index++) {
        const replacement = splitAutoLinkToken(blockToken.children, index, state.Token, markdown)
        if (!replacement) {
          continue
        }

        blockToken.children.splice(index, 3, ...replacement)
        index += replacement.length - 1
      }

      let linkDepth = 0
      for (let index = 0; index < blockToken.children.length; index++) {
        const childToken = blockToken.children[index]
        if (childToken.type === "link_open") {
          linkDepth++
          continue
        }

        if (childToken.type === "link_close") {
          linkDepth = Math.max(0, linkDepth - 1)
          continue
        }

        if (linkDepth > 0 || childToken.type !== "text") {
          continue
        }

        const replacement = linkifyTextToken(childToken, state.Token, markdown)
        if (!replacement) {
          continue
        }

        blockToken.children.splice(index, 1, ...replacement)
        index += replacement.length - 1
      }
    }
  })
}

function upsertAttribute(attrs: MarkdownTokenAttrs | null | undefined, name: string, value: string) {
  const nextAttrs = normalizeMarkdownTokenAttrs(attrs) ?? []
  const index = nextAttrs.findIndex(([attrName]) => attrName === name)

  if (index >= 0) {
    nextAttrs[index] = [name, value]
  } else {
    nextAttrs.push([name, value])
  }

  return nextAttrs
}

function appendHtmlAttributeIfMissing(attrs: string, name: string, value: string) {
  const pattern = new RegExp(`\\b${name}\\s*=`, "i")
  if (pattern.test(attrs)) {
    return attrs
  }

  return `${attrs} ${name}="${escapeHtml(value)}"`
}

function prependHtmlClass(attrs: string, className: string) {
  if (/\bclass\s*=\s*"([^"]*)"/i.test(attrs)) {
    return attrs.replace(/\bclass\s*=\s*"([^"]*)"/i, (_matched, existingClassName: string) => `class="${className} ${existingClassName.trim()}"`)
  }

  return ` class="${className}"${attrs}`
}

function decorateMarkdownImages(html: string) {
  return html.replace(/<img\b([^>]*)>/gi, (_matched, rawAttrs: string) => {
    let attrs = rawAttrs
    const isEmojiImage = /\bclass\s*=\s*"[^"]*\bmd-emoji-icon\b/i.test(attrs)
    const isPostCardImage = /\bclass\s*=\s*"[^"]*\bmd-post-card-(?:cover-image|avatar)\b/i.test(attrs)

    attrs = appendHtmlAttributeIfMissing(attrs, "loading", "lazy")
    attrs = appendHtmlAttributeIfMissing(attrs, "decoding", "async")

    if (isEmojiImage || isPostCardImage) {
      return `<img${attrs}>`
    }

    attrs = prependHtmlClass(attrs, "my-4 max-w-full")
    attrs = appendHtmlAttributeIfMissing(attrs, "fetchpriority", "low")
    return `<img${attrs}>`
  })
}

function renderIframe(src: string) {
  const normalizedSrc = normalizeMarkdownMediaSrc(src)
  if (!normalizedSrc || !isSupportedMarkdownEmbedSrc(normalizedSrc)) {
    return `<pre><code>${escapeHtml(`MEDIA::iframe::${src}`)}</code></pre>`
  }

  return [
    "<div>",
    `<iframe  frameborder="no" border="0" marginwidth="0" marginheight="0" class="block w-full" src="${escapeHtml(normalizedSrc)}" title="嵌入媒体" width="100%"  loading="lazy" referrerpolicy="no-referrer-when-downgrade" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="true"></iframe>`,
    "</div>",
  ].join("")
}

function renderMediaTag(tagName: "video" | "audio", src: string) {
  const normalizedSrc = normalizeMarkdownMediaSrc(src)
  if (!normalizedSrc) {
    return `<pre><code>${escapeHtml(`MEDIA::${tagName}::${src}`)}</code></pre>`
  }

  if (tagName === "video") {
    return [
      '<div class="my-6 overflow-hidden rounded-2xl border border-border bg-black shadow-xs">',
      `<video class="block w-full max-h-[70vh] bg-black" controls preload="metadata" playsInline src="${escapeHtml(normalizedSrc)}"></video>`,
      "</div>",
    ].join("")
  }

  return [
    '<div>',
    `<audio class="block w-full" controls preload="metadata" src="${escapeHtml(normalizedSrc)}"></audio>`,
    "</div>",
  ].join("")
}

function renderMediaToken(token: string) {
  const matched = token.match(/^MEDIA::(video|audio|iframe)::(.+)$/)
  if (!matched) {
    return null
  }

  const [, type, src] = matched
  if (type === "iframe") {
    return renderIframe(src)
  }

  return renderMediaTag(type as "video" | "audio", src)
}

function parseContainerTitle(info: string, type: string) {
  const suffix = info.slice(type.length).trim()
  return suffix || ""
}

function getCalloutTypeTitle(type: CalloutType) {
  switch (type) {
    case "info":
      return "说明"
    case "tip":
      return "技巧"
    case "warning":
      return "注意"
    case "danger":
      return "危险"
    case "success":
      return "成功"
    default:
      return ""
  }
}

function applyMarkdownEmojiShortcodes(input: string, emojiItems: MarkdownEmojiItem[]) {
  return input.replace(/(^|[^\\]):([a-zA-Z0-9_-]{1,32}):/g, (matched, prefix: string, shortcode: string) => {
    const rendered = renderMarkdownEmojiHtml(shortcode, emojiItems)
    if (!rendered) {
      return matched
    }

    return `${prefix}${rendered}`
  })
}

function wrapHtmlDocumentBlocks(input: string) {
  const lines = input.split("\n")
  const output: string[] = []
  let inFence = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (/^```/.test(trimmed)) {
      inFence = !inFence
      output.push(line)
      continue
    }

    if (inFence || !HTML_CODE_BLOCK_START_PATTERN.test(trimmed)) {
      output.push(line)
      continue
    }

    const blockLines: string[] = [line]
    let scriptOrStyleDepth = /<style\b/i.test(trimmed) && !/<\/style>/i.test(trimmed)
      ? 1
      : /<script\b/i.test(trimmed) && !/<\/script>/i.test(trimmed)
        ? 1
        : 0

    while (index + 1 < lines.length) {
      const nextLine = lines[index + 1]
      const nextTrimmed = nextLine.trim()

      if (/^```/.test(nextTrimmed)) {
        break
      }

      if (/<style\b/i.test(nextTrimmed) && !/<\/style>/i.test(nextTrimmed)) {
        scriptOrStyleDepth += 1
      }
      if (/<script\b/i.test(nextTrimmed) && !/<\/script>/i.test(nextTrimmed)) {
        scriptOrStyleDepth += 1
      }

      const isHtmlishLine = nextTrimmed === ""
        || HTML_CODE_BLOCK_TAG_LINE_PATTERN.test(nextTrimmed)
        || HTML_CODE_BLOCK_INLINE_TAG_PATTERN.test(nextTrimmed)
        || scriptOrStyleDepth > 0

      if (!isHtmlishLine) {
        break
      }

      blockLines.push(nextLine)
      index += 1

      if (scriptOrStyleDepth > 0) {
        if (/<\/style>/i.test(nextTrimmed)) {
          scriptOrStyleDepth = Math.max(0, scriptOrStyleDepth - 1)
        }
        if (/<\/script>/i.test(nextTrimmed)) {
          scriptOrStyleDepth = Math.max(0, scriptOrStyleDepth - 1)
        }
      }
    }

    output.push("```html")
    output.push(...blockLines)
    output.push("```")
  }

  return output.join("\n")
}

function resolveCodeBlockLanguage(code: string, language: string) {
  const languageName = language.trim().toLowerCase()
  const trimmedCode = code.trimStart()

  if (HTML_CODE_BLOCK_START_PATTERN.test(trimmedCode)) {
    return "html"
  }

  if (HTML_CODE_BLOCK_LANGUAGE_ALIASES.has(languageName)) {
    return "html"
  }

  return languageName
}

function splitRubyReading(value: string) {
  for (const separator of RUBY_READING_SEPARATORS) {
    const parts = value.split(separator).map((part) => part.trim()).filter(Boolean)
    if (parts.length > 1) {
      return { parts, separator }
    }
  }

  return { parts: [value.trim()], separator: "" }
}

function splitBaseText(value: string) {
  return Array.from(value.trim()).filter(Boolean)
}

function groupByTargetCount(items: string[], targetCount: number) {
  const groups: string[][] = []

  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor(index * items.length / targetCount)
    const end = Math.floor((index + 1) * items.length / targetCount)
    groups.push(items.slice(start, Math.max(start + 1, end)))
  }

  return groups
}

function buildRubyHtml(baseText: string, readingText: string) {
  const normalizedBase = baseText.trim()
  const normalizedReading = readingText.trim()
  if (!normalizedBase || !normalizedReading) {
    return `[${baseText}]{${readingText}}`
  }

  const baseParts = splitBaseText(normalizedBase)
  const { parts: readingParts, separator } = splitRubyReading(normalizedReading)

  if (readingParts.length <= 1 || baseParts.length <= 1) {
    return `<ruby>${escapeHtml(normalizedBase)}<rt>${escapeHtml(normalizedReading)}</rt></ruby>`
  }

  if (baseParts.length === readingParts.length) {
    return baseParts.map((part, index) => `<ruby>${escapeHtml(part)}<rt>${escapeHtml(readingParts[index] ?? "")}</rt></ruby>`).join("")
  }

  if (readingParts.length < baseParts.length) {
    const baseGroups = groupByTargetCount(baseParts, readingParts.length)
    return baseGroups.map((group, index) => `<ruby>${escapeHtml(group.join(""))}<rt>${escapeHtml(readingParts[index] ?? "")}</rt></ruby>`).join("")
  }

  const readingGroups = groupByTargetCount(readingParts, baseParts.length)
  const joiner = separator === " " || separator === "　" ? " " : separator
  return baseParts.map((part, index) => `<ruby>${escapeHtml(part)}<rt>${escapeHtml((readingGroups[index] ?? []).join(joiner))}</rt></ruby>`).join("")
}

function renderRubySyntaxLine(line: string) {
  return line
    .split(/(`[^`]*`)/g)
    .map((segment) => segment.startsWith("`") && segment.endsWith("`")
      ? segment
      : segment.replace(RUBY_SYNTAX_PATTERN, (_matched, baseText: string, parenReading: string | undefined, braceReading: string | undefined) => buildRubyHtml(baseText, parenReading ?? braceReading ?? "")))
    .join("")
}

function renderRubySyntax(input: string) {
  const lines = input.split("\n")
  const output: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      output.push(line)
      continue
    }

    output.push(inFence ? line : renderRubySyntaxLine(line))
  }

  return output.join("\n")
}

function buildWavyHtml(content: string) {
  const normalized = content.trim()
  if (!normalized) {
    return `~${content}~`
  }

  return `<span class="md-wavy">${escapeHtml(normalized)}</span>`
}

function renderWavySyntaxLine(line: string) {
  return line
    .split(/(`[^`]*`)/g)
    .map((segment) => segment.startsWith("`") && segment.endsWith("`")
      ? segment
      : segment.replace(WAVY_SYNTAX_PATTERN, (_matched, prefix: string, content: string) => `${prefix}${buildWavyHtml(content)}`))
    .join("")
}

function renderWavySyntax(input: string) {
  const lines = input.split("\n")
  const output: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      output.push(line)
      continue
    }

    output.push(inFence ? line : renderWavySyntaxLine(line))
  }

  return output.join("\n")
}

function buildScratchMaskHtml(content: string) {
  const normalized = content.trim()
  if (!normalized) {
    return `!!${content}!!`
  }

  return `<label class="md-scratch-mask inline cursor-pointer align-baseline"><input type="checkbox" class="peer sr-only" aria-label="显示遮罩内容" /><span class="md-scratch-mask-content bg-foreground text-transparent transition-colors select-none peer-checked:bg-transparent peer-checked:text-inherit peer-checked:select-text">${escapeHtml(normalized)}</span></label>`
}

function renderScratchMaskSyntaxLine(line: string) {
  return line
    .split(/(`[^`]*`)/g)
    .map((segment) => segment.startsWith("`") && segment.endsWith("`")
      ? segment
      : segment.replace(SCRATCH_MASK_SYNTAX_PATTERN, (_matched, prefix: string, content: string) => `${prefix}${buildScratchMaskHtml(content)}`))
    .join("")
}

function renderScratchMaskSyntax(input: string) {
  const lines = input.split("\n")
  const output: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      output.push(line)
      continue
    }

    output.push(inFence ? line : renderScratchMaskSyntaxLine(line))
  }

  return output.join("\n")
}

function createEscapedHtmlPlaceholder(raw: string, placeholders: EscapedHtmlPlaceholder[]) {
  const marker = `\uE000MD_ESCAPED_HTML_${placeholders.length}\uE001`
  placeholders.push({ marker, html: escapeHtml(raw) })
  return marker
}

function restoreEscapedHtmlPlaceholders(html: string, placeholders: EscapedHtmlPlaceholder[]) {
  if (placeholders.length === 0) {
    return html
  }

  return placeholders.reduce(
    (currentHtml, placeholder) => currentHtml.replaceAll(placeholder.marker, placeholder.html),
    html,
  )
}

function sanitizeMarkdownHtmlTag(raw: string, placeholders: EscapedHtmlPlaceholder[]) {
  const match = raw.match(/^<(\/)?([a-zA-Z][\w-]*)([\s\S]*?)>$/)
  if (!match) {
    return createEscapedHtmlPlaceholder(raw, placeholders)
  }

  const [, closingSlash, rawTagName, rawAttributes] = match
  const tagName = rawTagName.toLowerCase()
  const attributes = rawAttributes ?? ""

  if (closingSlash) {
    if (
      attributes.trim().length === 0
      && (tagName === "center" || tagName === "p" || tagName === "u" || ALLOWED_MARKDOWN_HTML_INLINE_TAGS.has(tagName))
    ) {
      return `</${tagName}>`
    }

    return createEscapedHtmlPlaceholder(raw, placeholders)
  }

  if (tagName === "center" || tagName === "u" || (ALLOWED_MARKDOWN_HTML_INLINE_TAGS.has(tagName) && tagName !== "span")) {
    return attributes.trim().length === 0
      ? `<${tagName}>`
      : createEscapedHtmlPlaceholder(raw, placeholders)
  }

  if (tagName === "span") {
    const classMatch = attributes.match(/^\s+class\s*=\s*(["'])md-wavy\1\s*$/i)
    return classMatch
      ? '<span class="md-wavy">'
      : createEscapedHtmlPlaceholder(raw, placeholders)
  }

  if (tagName === "p") {
    const alignMatch = attributes.match(/^\s+align\s*=\s*(["']?)(left|center|right|justify)\1\s*$/i)
    const alignment = alignMatch?.[2]?.toLowerCase()
    if (alignment && ALLOWED_MARKDOWN_HTML_ALIGNMENTS.has(alignment)) {
      return `<p align="${alignment}">`
    }
  }

  return createEscapedHtmlPlaceholder(raw, placeholders)
}

function sanitizeMarkdownHtmlFragment(input: string, placeholders: EscapedHtmlPlaceholder[]) {
  let output = ""
  let cursor = 0

  while (cursor < input.length) {
    const tagStart = input.indexOf("<", cursor)
    if (tagStart === -1) {
      output += input.slice(cursor)
      break
    }

    output += input.slice(cursor, tagStart)
    const tagEnd = input.indexOf(">", tagStart + 1)
    if (tagEnd === -1) {
      output += createEscapedHtmlPlaceholder("<", placeholders)
      cursor = tagStart + 1
      continue
    }

    output += sanitizeMarkdownHtmlTag(input.slice(tagStart, tagEnd + 1), placeholders)
    cursor = tagEnd + 1
  }

  return output
}

function sanitizeMarkdownInlineHtml(input: string, placeholders: EscapedHtmlPlaceholder[]) {
  const output: string[] = []
  const markdownBuffer: string[] = []
  let inFence = false

  function flushMarkdownBuffer() {
    if (markdownBuffer.length === 0) {
      return
    }

    output.push(sanitizeMarkdownHtmlFragment(markdownBuffer.join("\n"), placeholders))
    markdownBuffer.length = 0
  }

  for (const line of input.split("\n")) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      if (!inFence) {
        flushMarkdownBuffer()
        inFence = true
      } else {
        inFence = false
      }

      output.push(line)
      continue
    }

    if (inFence) {
      output.push(line)
      continue
    }

    markdownBuffer.push(line)
  }

  flushMarkdownBuffer()
  return output.join("\n")
}

function createMarkdownRenderer(emojiItems: MarkdownEmojiItem[]) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(code, language) {
      const languageName = resolveCodeBlockLanguage(code, language)
      const safeLanguage = escapeHtml(languageName || "text")
      const safeCode = languageName && hljs.getLanguage(languageName)
        ? hljs.highlight(code, { language: languageName, ignoreIllegals: true }).value
        : escapeHtml(code)

      if (languageName === "mermaid") {
        return `<div class="md-mermaid" data-mermaid="${escapeHtml(code)}"><div class="md-mermaid-loading">正在渲染 Mermaid 图表…</div></div>`
      }

      return `<pre class="md-code-block"><div class="md-code-header"><span>${safeLanguage || "text"}</span></div><code class="language-${safeLanguage}">${safeCode}</code></pre>`
    },
  })
  const mdWithLinkify = md as MarkdownItWithLinkifyCore
  mdWithLinkify.linkify.set({ fuzzyLink: false })
  splitMixedImageParagraphs(mdWithLinkify)
  fixCjkAutoLinkBoundaries(mdWithLinkify)

  md.use(markdownItAbbr)
  md.use(markdownItDeflist)
  md.use(markdownItFootnote)
  md.use(markdownItIns)
  md.use(markdownItKatex, { throwOnError: false, strict: "ignore" })
  md.use(markdownItMark)
  md.use(markdownItSub)
  md.use(markdownItSup)
  md.use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true })

  for (const calloutType of CALLOUT_TYPES) {
    md.use(markdownItContainer, calloutType, {
      render(tokens: Array<{ info: string; nesting: number }>, index: number) {
        const token = tokens[index]
        if (token.nesting === 1) {
          const iconSymbol = CALLOUT_ICON_SYMBOLS[calloutType]
          const title = escapeHtml(parseContainerTitle(token.info, calloutType) || getCalloutTypeTitle(calloutType))
          return `<div class="md-callout md-callout-${calloutType} relative my-6 overflow-hidden rounded-xl border px-4 py-4"><div class="md-callout-head"><span class="md-callout-icon" aria-hidden="true">${iconSymbol}</span><div class="md-callout-title">${title}</div></div><div class="md-callout-body">`
        }

        return "</div></div>"
      },
    })
  }

  md.use(markdownItContainer, "spoiler", {
    render(tokens: Array<{ info: string; nesting: number }>, index: number) {
      const token = tokens[index]
      if (token.nesting === 1) {
        const title = escapeHtml(parseContainerTitle(token.info, "spoiler") || "剧透内容")
        return `<details class="md-spoiler my-6 overflow-hidden rounded-xl border border-border/80 bg-secondary/20 shadow-xs"><summary class="md-spoiler-summary cursor-pointer select-none px-4 py-3 font-medium text-foreground"><span>${title}</span><span class="ml-2 text-xs font-normal text-muted-foreground">点击展开</span></summary><div class="md-spoiler-body border-t border-border/70 px-4 py-4">`
      }

      return "</div></details>"
    },
  })

  md.renderer.rules.heading_open = (tokens: unknown[], index: number, options: unknown, env: unknown, self: { renderToken: (tokens: unknown[], index: number, options: unknown) => string }) => {
    const typedTokens = tokens as MarkdownHeadingToken[]
    const headingToken = typedTokens[index]
    const inlineToken = typedTokens[index + 1]
    const rawText = inlineToken?.content ?? ""
    const renderEnv = (typeof env === "object" && env !== null ? env : {}) as MarkdownRenderEnv
    const usedSlugs = renderEnv.__usedHeadingSlugs ?? new Map<string, number>()
    renderEnv.__usedHeadingSlugs = usedSlugs
    const baseSlug = slugify(rawText) || `${headingToken.tag}-${index}`
    const seen = usedSlugs.get(baseSlug) ?? 0
    usedSlugs.set(baseSlug, seen + 1)
    const finalSlug = seen === 0 ? baseSlug : `${baseSlug}-${seen}`
    headingToken.attrs = upsertAttribute(headingToken.attrs, "id", finalSlug)

    return self.renderToken(tokens, index, options)
  }

  const defaultTextRule = md.renderer.rules.text
  md.renderer.rules.text = (tokens, index, options, env, self) => {
    const raw = defaultTextRule
      ? defaultTextRule(tokens, index, options, env, self)
      : ((tokens[index] as { content?: string } | undefined)?.content ?? "")
    return applyMarkdownEmojiShortcodes(raw, emojiItems)
  }

  return md
}

function getMarkdownRenderer(emojiItems: MarkdownEmojiItem[]) {
  const cacheKey = JSON.stringify(emojiItems)
  const cached = markdownRendererCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const markdown = createMarkdownRenderer(emojiItems)
  markdownRendererCache.set(cacheKey, markdown)

  if (markdownRendererCache.size > MARKDOWN_RENDERER_CACHE_LIMIT) {
    const oldestKey = markdownRendererCache.keys().next().value
    if (oldestKey) {
      markdownRendererCache.delete(oldestKey)
    }
  }

  return markdown
}

function renderMarkdownChunk(markdown: MarkdownIt, source: string, env: MarkdownRenderEnv) {
  return (markdown as MarkdownIt & { render: (input: string, renderEnv?: MarkdownRenderEnv) => string }).render(source, env)
}

function normalizeLooseOrderedBlockquoteItems(input: string) {
  const lines = input.split("\n")
  const output: string[] = []
  let inFence = false

  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    const trimmed = line.trim()

    if (/^(?:```|~~~)/.test(trimmed)) {
      inFence = !inFence
      output.push(line)
      index += 1
      continue
    }

    if (inFence) {
      output.push(line)
      index += 1
      continue
    }

    const markerMatch = line.match(/^(\s*)(\d{1,9}[.)])\s*$/)
    if (!markerMatch) {
      output.push(line)
      index += 1
      continue
    }

    let quoteStartIndex = index + 1
    while (quoteStartIndex < lines.length && lines[quoteStartIndex]?.trim() === "") {
      quoteStartIndex += 1
    }

    const firstQuoteLine = lines[quoteStartIndex]
    if (!firstQuoteLine || !/^\s*>/.test(firstQuoteLine)) {
      output.push(line)
      index += 1
      continue
    }

    const [, markerIndent = "", marker = ""] = markerMatch
    const continuationIndent = `${markerIndent}${" ".repeat(marker.length + 1)}`
    let quoteIndex = quoteStartIndex

    output.push(`${markerIndent}${marker} ${firstQuoteLine.trimStart()}`)
    quoteIndex += 1

    while (quoteIndex < lines.length && /^\s*>/.test(lines[quoteIndex] ?? "")) {
      output.push(`${continuationIndent}${(lines[quoteIndex] ?? "").trimStart()}`)
      quoteIndex += 1
    }

    index = quoteIndex
  }

  return output.join("\n")
}

function stripUnsafeScriptTags(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
}

export function isImageOnlyMarkdownHtml(html: string) {
  const normalized = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(\/)?(?:p|div|figure|span|a|picture)\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<img\b[^>]*>/gi, "__MD_IMG__")
    .replace(/(?:&nbsp;|&#160;|\s)+/gi, "")

  if (!normalized.includes("__MD_IMG__")) {
    return false
  }

  return normalized.replace(/__MD_IMG__/g, "") === ""
}

export function renderMarkdown(input: string, emojiItems: MarkdownEmojiItem[], options: MarkdownRenderOptions = {}) {
  const markdown = getMarkdownRenderer(emojiItems)
  const normalizedInput = normalizeLooseOrderedBlockquoteItems(renderWavySyntax(renderRubySyntax(wrapHtmlDocumentBlocks(renderUserLinkTokens(input)))))
  const escapedHtmlPlaceholders: EscapedHtmlPlaceholder[] = []
  const sanitizedInput = renderScratchMaskSyntax(sanitizeMarkdownInlineHtml(normalizedInput, escapedHtmlPlaceholders))
  const lines = sanitizedInput.split("\n")
  const htmlChunks: string[] = []
  const markdownBuffer: string[] = []
  const renderEnv: MarkdownRenderEnv = {
    __usedHeadingSlugs: new Map<string, number>(),
  }

  function flushMarkdownBuffer() {
    if (markdownBuffer.length === 0) {
      return
    }

    htmlChunks.push(renderMarkdownChunk(markdown, markdownBuffer.join("\n"), renderEnv))
    markdownBuffer.length = 0
  }

  for (const line of lines) {
    const postCardHtml = renderPostCardEmbedHtml(line.trim(), {
      postLinkDisplayMode: options.postLinkDisplayMode,
    })
    if (postCardHtml) {
      flushMarkdownBuffer()
      htmlChunks.push(postCardHtml)
      continue
    }

    const mediaHtml = renderMediaToken(line.trim())
    if (mediaHtml) {
      flushMarkdownBuffer()
      htmlChunks.push(mediaHtml)
      continue
    }

    markdownBuffer.push(line)
  }

  flushMarkdownBuffer()

  const html = stripUnsafeScriptTags(htmlChunks.join("\n"))
    .replace(/<center>/g, '<center class="my-3 block text-center">')
    .replace(/<p>/g, '<p class="my-3 leading-7 text-foreground">')
    .replace(/<p align="left">/g, '<p align="left" class="my-3 leading-7 text-left text-foreground">')
    .replace(/<p align="center">/g, '<p align="center" class="my-3 leading-7 text-center text-foreground">')
    .replace(/<p align="right">/g, '<p align="right" class="my-3 leading-7 text-right text-foreground">')
    .replace(/<ul(?!\s+class=)([^>]*)>/g, '<ul class="md-list md-list-unordered"$1>')
    .replace(/<ol(?!\s+class=)([^>]*)>/g, '<ol class="md-list md-list-ordered"$1>')
    .replace(/<li>/g, '<li class="md-list-item">')
    .replace(/<a /g, '<a class="font-medium text-primary underline underline-offset-4 break-all" target="_blank" rel="noreferrer nofollow ugc" ')
    .replace(/<strong>/g, '<strong class="font-semibold text-foreground">')
    .replace(/<em>/g, '<em class="italic text-foreground">')
    .replace(/<hr>/g, '<hr class="my-6 border-border" />')
    .replace(/<table>/g, '<div class="my-4 overflow-x-auto rounded-2xl border border-border"><table class="min-w-full border-collapse text-sm">')
    .replace(/<\/table>/g, "</table></div>")
    .replace(/<thead>/g, '<thead class="bg-secondary/60">')
    .replace(/<th>/g, '<th class="border border-border px-3 py-2 text-left font-medium">')
    .replace(/<td>/g, '<td class="border border-border px-3 py-2 align-top">')
    .replace(/<pre>/g, '<pre class="my-4 overflow-x-auto rounded-2xl bg-secondary p-4">')
    .replace(/<pre class="md-code-block">/g, '<pre class="md-code-block group my-5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 shadow-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:shadow-lg">')
    .replace(/<pre class="md-code-block md-mermaid-source" data-mermaid-source="true">/g, '<pre class="md-code-block md-mermaid-source group my-5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 shadow-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:shadow-lg" data-mermaid-source="true">')
    .replace(/<div class="md-code-header">/g, '<div class="md-code-header flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">')
    .replace(/<code>/g, '<code class="rounded bg-secondary px-1 py-0.5">')
    .replace(/<code class="language-/g, '<code class="hljs block min-w-full overflow-x-auto bg-transparent px-5 py-5 font-mono text-[13px] leading-6 language-')
    .replace(/<code class="(?!hljs\b|rounded\b)/g, '<code class="rounded bg-secondary px-1 py-0.5 ')
    .replace(/<blockquote>/g, '<blockquote class="my-4 border-l-4 border-border pl-4 text-muted-foreground">')
    .replace(/<h1 id="([^"]+)">/g, '<h1 id="$1" class="group mt-6 scroll-mt-24 text-3xl font-bold leading-tight text-foreground">')
    .replace(/<h2 id="([^"]+)">/g, '<h2 id="$1" class="group mt-5 scroll-mt-24 text-2xl font-semibold leading-tight text-foreground">')
    .replace(/<h3 id="([^"]+)">/g, '<h3 id="$1" class="group mt-4 scroll-mt-24 text-xl font-semibold leading-snug text-foreground">')
    .replace(/<h4 id="([^"]+)">/g, '<h4 id="$1" class="group mt-4 scroll-mt-24 text-lg font-semibold leading-snug text-foreground">')
    .replace(/<h5 id="([^"]+)">/g, '<h5 id="$1" class="group mt-3 scroll-mt-24 text-base font-semibold leading-snug text-foreground">')
    .replace(/<h6 id="([^"]+)">/g, '<h6 id="$1" class="group mt-3 scroll-mt-24 text-sm font-semibold leading-snug text-foreground">')
    .replace(/<dl>/g, '<dl class="my-4 space-y-2">')
    .replace(/<dt>/g, '<dt class="font-semibold text-foreground">')
    .replace(/<dd>/g, '<dd class="ml-0 border-l-2 border-border pl-4 text-muted-foreground">')
    .replace(/<abbr /g, '<abbr class="cursor-help underline decoration-dotted underline-offset-4" ')
    .replace(/<mark>/g, '<mark class="rounded bg-amber-200/70 px-1 text-foreground dark:bg-amber-400/20">')
    .replace(/<ins>/g, '<ins class="decoration-emerald-500 decoration-2 underline-offset-4">')
    .replace(/<u>/g, '<u class="decoration-current underline underline-offset-4">')
    .replace(/<sup>/g, '<sup class="align-super text-[0.7em]">')
    .replace(/<sub>/g, '<sub class="align-sub text-[0.7em]">')
    .replace(/<section class="footnotes">/g, '<section class="footnotes mt-8 border-t border-border pt-4">')
    .replace(/<ol class="footnotes-list">/g, '<ol class="footnotes-list list-decimal space-y-2 pl-6 text-sm text-muted-foreground">')
    .replace(/<a class="footnote-ref"/g, '<a class="footnote-ref align-super text-[0.7em] text-primary no-underline"')
    .replace(/<a class="footnote-backref"/g, '<a class="footnote-backref ml-1 text-primary no-underline"')
    .replace(/<ul class="contains-task-list">/g, '<ul class="md-list md-task-list contains-task-list">')
    .replace(/<input class="task-list-item-checkbox" /g, '<input class="task-list-item-checkbox mr-2 mt-1 size-4 rounded border-border accent-primary" disabled ')
    .replace(/<li class="task-list-item">/g, '<li class="task-list-item flex items-start gap-2 leading-7">')
    .replace(/<li class="task-list-item enabled">/g, '<li class="task-list-item enabled flex items-start gap-2 leading-7">')

  return restoreEscapedHtmlPlaceholders(decorateMarkdownImages(html), escapedHtmlPlaceholders)
}

export function isImageOnlyMarkdown(input: string, emojiItems: MarkdownEmojiItem[]) {
  if (!input.trim()) {
    return false
  }

  return isImageOnlyMarkdownHtml(renderMarkdown(input, emojiItems))
}
