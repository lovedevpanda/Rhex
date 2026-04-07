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

interface MarkdownHeadingToken {
  tag: string
  content?: string
  attrs?: Array<[string, string]>
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
const HTML_CODE_BLOCK_START_PATTERN = /^\s*<(?:!doctype|html|head|body|meta|title|style|script|link)\b/i
const HTML_CODE_BLOCK_TAG_LINE_PATTERN = /^\s*(?:<!doctype[^>]*>|<!--.*?-->|<\/?[a-zA-Z][\w:-]*(?:\s+[^>]*)?\s*\/?>)\s*$/i
const HTML_CODE_BLOCK_INLINE_TAG_PATTERN = /^\s*<([a-zA-Z][\w:-]*)(?:\s+[^>]*)?>.*<\/\1>\s*$/i

type CalloutType = (typeof CALLOUT_TYPES)[number]
const MARKDOWN_RENDERER_CACHE_LIMIT = 8
const markdownRendererCache = new Map<string, MarkdownIt>()

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function upsertAttribute(attrs: Array<[string, string]> | undefined, name: string, value: string) {
  const nextAttrs = [...(attrs ?? [])]
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

    attrs = appendHtmlAttributeIfMissing(attrs, "loading", "lazy")
    attrs = appendHtmlAttributeIfMissing(attrs, "decoding", "async")

    if (isEmojiImage) {
      return `<img${attrs}>`
    }

    attrs = prependHtmlClass(attrs, "my-4 max-w-full rounded-2xl border border-border")
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
      '<div class="my-6 overflow-hidden rounded-2xl border border-border bg-black shadow-sm">',
      `<video class="block w-full max-h-[70vh] bg-black" controls preload="metadata" playsInline src="${escapeHtml(normalizedSrc)}"></video>`,
      "</div>",
    ].join("")
  }

  return [
    '<div class="my-6 rounded-2xl border border-border bg-card p-4 shadow-sm">',
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

function parseContainerTitle(info: string, type: CalloutType) {
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

function sanitizeMarkdownHtmlLine(line: string) {
  return line.replace(/<(\/)?([a-zA-Z][\w-]*)([^>]*)>/g, (raw, closingSlash: string | undefined, rawTagName: string, rawAttributes: string) => {
    const tagName = rawTagName.toLowerCase()

    if (closingSlash) {
      if (tagName === "center" || tagName === "p" || tagName === "u" || ALLOWED_MARKDOWN_HTML_INLINE_TAGS.has(tagName)) {
        return `</${tagName}>`
      }
      return escapeHtml(raw)
    }

    if (tagName === "center") {
      return "<center>"
    }

    if (tagName === "u") {
      return "<u>"
    }

    if (tagName === "span") {
      const classMatch = rawAttributes.match(/\bclass\s*=\s*(["'])([^"']+)\1/i)
      const className = classMatch?.[2]?.trim()
      if (className === "md-wavy") {
        return '<span class="md-wavy">'
      }
      return escapeHtml(raw)
    }

    if (ALLOWED_MARKDOWN_HTML_INLINE_TAGS.has(tagName)) {
      return `<${tagName}>`
    }

    if (tagName !== "p") {
      return escapeHtml(raw)
    }

    const alignMatch = rawAttributes.match(/\balign\s*=\s*(["']?)(left|center|right|justify)\1/i)
    const alignment = alignMatch?.[2]?.toLowerCase()
    if (!alignment || !ALLOWED_MARKDOWN_HTML_ALIGNMENTS.has(alignment)) {
      return escapeHtml(raw)
    }

    return `<p align="${alignment}">`
  })
}

function sanitizeMarkdownInlineHtml(input: string) {
  const lines = input.split("\n")
  const output: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      output.push(line)
      continue
    }

    output.push(inFence ? line : sanitizeMarkdownHtmlLine(line))
  }

  return output.join("\n")
}

function createMarkdownRenderer(emojiItems: MarkdownEmojiItem[]) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(code, language) {
      const languageName = language.trim().toLowerCase()
      const safeLanguage = escapeHtml(languageName || "text")

      if (languageName === "mermaid") {
        return `<div class="md-mermaid" data-mermaid="${escapeHtml(code)}"><div class="md-mermaid-loading">正在渲染 Mermaid 图表…</div></div>`
      }

      const highlighted = languageName && hljs.getLanguage(languageName)
        ? hljs.highlight(code, { language: languageName, ignoreIllegals: true }).value
        : hljs.highlightAuto(code).value

      return `<pre class="md-code-block"><div class="md-code-header"><span>${safeLanguage || "text"}</span></div><code class="language-${safeLanguage}">${highlighted}</code></pre>`
    },
  })

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
          return `<div class="md-callout md-callout-${calloutType} relative my-6 overflow-hidden rounded-[24px] border px-4 py-4"><div class="md-callout-head"><span class="md-callout-icon" aria-hidden="true">${iconSymbol}</span><div class="md-callout-title">${title}</div></div><div class="md-callout-body">`
        }

        return "</div></div>"
      },
    })
  }

  const usedSlugs = new Map<string, number>()
  md.renderer.rules.heading_open = (tokens: unknown[], index: number, options: unknown, _env: unknown, self: { renderToken: (tokens: unknown[], index: number, options: unknown) => string }) => {
    const typedTokens = tokens as MarkdownHeadingToken[]
    const headingToken = typedTokens[index]
    const inlineToken = typedTokens[index + 1]
    const rawText = inlineToken?.content ?? ""
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

export function renderMarkdown(input: string, emojiItems: MarkdownEmojiItem[]) {
  const markdown = getMarkdownRenderer(emojiItems)
  const normalizedInput = renderWavySyntax(renderRubySyntax(wrapHtmlDocumentBlocks(renderUserLinkTokens(input))))
  const sanitizedInput = sanitizeMarkdownInlineHtml(normalizedInput)
  const lines = sanitizedInput.split("\n")
  const htmlChunks: string[] = []
  const markdownBuffer: string[] = []

  function flushMarkdownBuffer() {
    if (markdownBuffer.length === 0) {
      return
    }

    htmlChunks.push(markdown.render(markdownBuffer.join("\n")))
    markdownBuffer.length = 0
  }

  for (const line of lines) {
    const mediaHtml = renderMediaToken(line.trim())
    if (mediaHtml) {
      flushMarkdownBuffer()
      htmlChunks.push(mediaHtml)
      continue
    }

    markdownBuffer.push(line)
  }

  flushMarkdownBuffer()

  const html = htmlChunks.join("\n")
    .replace(/<center>/g, '<center class="my-3 block text-center">')
    .replace(/<p>/g, '<p class="my-3 leading-7 text-foreground">')
    .replace(/<p align="left">/g, '<p align="left" class="my-3 leading-7 text-left text-foreground">')
    .replace(/<p align="center">/g, '<p align="center" class="my-3 leading-7 text-center text-foreground">')
    .replace(/<p align="right">/g, '<p align="right" class="my-3 leading-7 text-right text-foreground">')
    .replace(/<ul>/g, '<ul class="md-list md-list-unordered">')
    .replace(/<ol>/g, '<ol class="md-list md-list-ordered">')
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
    .replace(/<pre class="md-code-block">/g, '<pre class="md-code-block group my-5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:shadow-lg">')
    .replace(/<pre class="md-code-block md-mermaid-source" data-mermaid-source="true">/g, '<pre class="md-code-block md-mermaid-source group my-5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:shadow-lg" data-mermaid-source="true">')
    .replace(/<div class="md-code-header">/g, '<div class="md-code-header flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">')
    .replace(/<code>/g, '<code class="rounded bg-secondary px-1 py-0.5">')
    .replace(/<code class="language-/g, '<code class="hljs block min-w-full overflow-x-auto bg-transparent p-4 font-mono text-[13px] leading-6 language-')
    .replace(/<code class="/g, '<code class="rounded bg-secondary px-1 py-0.5 ')
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

  return decorateMarkdownImages(html)
}
