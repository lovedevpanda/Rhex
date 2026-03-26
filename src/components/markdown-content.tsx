"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { createPortal } from "react-dom"

import { renderMarkdownEmojiHtml, type MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { useMarkdownEmojiMap } from "@/components/site-settings-provider"

import MarkdownIt from "markdown-it"
import markdownItAbbr from "markdown-it-abbr"
import markdownItAttrs from "markdown-it-attrs"
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
import mermaid from "mermaid"
import { X } from "lucide-react"

interface MarkdownContentProps {
  content: string
  className?: string
  emptyText?: string
  markdownEmojiMap?: MarkdownEmojiItem[]
}

interface LightboxImage {
  src: string
  alt: string
}

interface MarkdownHeadingToken {
  tag: string
  content?: string
  attrs?: Array<[string, string]>
}

const SUPPORTED_IFRAME_HOSTS = [
  "player.bilibili.com",
  "www.bilibili.com",
  "music.163.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "v.qq.com",
]

const CALLOUT_TYPES = ["info", "tip", "warning", "danger", "success"] as const

type CalloutType = (typeof CALLOUT_TYPES)[number]

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
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

function normalizeMediaSrc(src: string) {
  const trimmed = src.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed

  try {
    const url = new URL(normalized)
    if (!["https:", "http:"].includes(url.protocol)) {
      return null
    }
    return trimmed.startsWith("//") ? `//${url.host}${url.pathname}${url.search}${url.hash}` : url.toString()
  } catch {
    return null
  }
}

function isSupportedIframeHost(src: string) {
  const normalized = normalizeMediaSrc(src)
  if (!normalized) {
    return false
  }

  try {
    const url = new URL(normalized.startsWith("//") ? `https:${normalized}` : normalized)
    return SUPPORTED_IFRAME_HOSTS.includes(url.hostname)
  } catch {
    return false
  }
}

function renderIframe(src: string) {
  const normalizedSrc = normalizeMediaSrc(src)
  if (!normalizedSrc || !isSupportedIframeHost(normalizedSrc)) {
    return `<pre><code>${escapeHtml(`MEDIA::iframe::${src}`)}</code></pre>`
  }


  return [
    '<div>',
    `<iframe  frameborder="no" border="0" marginwidth="0" marginheight="0" class="block w-full" src="${escapeHtml(normalizedSrc)}" title="嵌入媒体" width="100%"  loading="lazy" referrerpolicy="no-referrer-when-downgrade" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="true"></iframe>`,
    "</div>",
  ].join("")
}

function renderMediaTag(tagName: "video" | "audio", src: string) {
  const normalizedSrc = normalizeMediaSrc(src)
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
  return suffix || type.toUpperCase()
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

function createMarkdownRenderer(emojiItems: MarkdownEmojiItem[]) {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(code, language) {
      const languageName = language.trim().toLowerCase()
      const safeLanguage = escapeHtml(languageName || "text")

      if (languageName === "mermaid") {
        return `<pre class="md-code-block md-mermaid-source" data-mermaid-source="true"><div class="md-code-header"><span>mermaid</span></div><code class="language-mermaid">${escapeHtml(code)}</code></pre><div class="md-mermaid" data-mermaid="${escapeHtml(code)}"><div class="md-mermaid-loading">正在渲染 Mermaid 图表…</div></div>`
      }

      const highlighted = languageName && hljs.getLanguage(languageName)
        ? hljs.highlight(code, { language: languageName, ignoreIllegals: true }).value
        : hljs.highlightAuto(code).value

      return `<pre class="md-code-block"><div class="md-code-header"><span>${safeLanguage || "text"}</span></div><code class="language-${safeLanguage}">${highlighted}</code></pre>`
    },
  })

  md.use(markdownItAbbr)
  md.use(markdownItAttrs)
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
          const title = escapeHtml(parseContainerTitle(token.info, calloutType))
          return `<div class="md-callout md-callout-${calloutType}"><div class="md-callout-title">${title}</div><div class="md-callout-body">`
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

function renderMarkdown(input: string, emojiItems: MarkdownEmojiItem[]) {
  const markdown = createMarkdownRenderer(emojiItems)
  const lines = input.split("\n")
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

  return htmlChunks.join("\n")
    .replace(/<p>/g, '<p class="my-3 leading-7 text-foreground">')
    .replace(/<ul>/g, '<ul class="my-4 list-disc space-y-2 pl-6 text-foreground">')
    .replace(/<ol>/g, '<ol class="my-4 list-decimal space-y-2 pl-6 text-foreground">')
    .replace(/<li>/g, '<li class="leading-7">')
    .replace(/<a /g, '<a class="font-medium text-primary underline underline-offset-4 break-all" target="_blank" rel="noreferrer nofollow ugc" ')
    .replace(/<strong>/g, '<strong class="font-semibold text-foreground">')
    .replace(/<em>/g, '<em class="italic text-foreground">')
    .replace(/<hr>/g, '<hr class="my-6 border-border" />')
    .replace(/<table>/g, '<div class="my-4 overflow-x-auto rounded-2xl border border-border"><table class="min-w-full border-collapse text-sm">')
    .replace(/<\/table>/g, '</table></div>')
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
    .replace(/<img /g, '<img class="my-4 max-w-full rounded-2xl border border-border" loading="lazy" ')
    .replace(/<dl>/g, '<dl class="my-4 space-y-2">')
    .replace(/<dt>/g, '<dt class="font-semibold text-foreground">')
    .replace(/<dd>/g, '<dd class="ml-0 border-l-2 border-border pl-4 text-muted-foreground">')
    .replace(/<abbr /g, '<abbr class="cursor-help underline decoration-dotted underline-offset-4" ')
    .replace(/<mark>/g, '<mark class="rounded bg-amber-200/70 px-1 text-foreground dark:bg-amber-400/20">')
    .replace(/<ins>/g, '<ins class="decoration-emerald-500 decoration-2 underline-offset-4">')
    .replace(/<sup>/g, '<sup class="align-super text-[0.7em]">')
    .replace(/<sub>/g, '<sub class="align-sub text-[0.7em]">')
    .replace(/<section class="footnotes">/g, '<section class="footnotes mt-8 border-t border-border pt-4">')
    .replace(/<ol class="footnotes-list">/g, '<ol class="footnotes-list list-decimal space-y-2 pl-6 text-sm text-muted-foreground">')
    .replace(/<a class="footnote-ref"/g, '<a class="footnote-ref align-super text-[0.7em] text-primary no-underline"')
    .replace(/<a class="footnote-backref"/g, '<a class="footnote-backref ml-1 text-primary no-underline"')
    .replace(/<input class="task-list-item-checkbox" /g, '<input class="task-list-item-checkbox mr-2 mt-1 size-4 rounded border-border accent-primary" disabled ')
    .replace(/<li class="task-list-item">/g, '<li class="task-list-item flex items-start gap-2 leading-7">')
    .replace(/<div class="md-callout/g, '<div class="my-5 rounded-2xl border p-4 shadow-sm md-callout')
    .replace(/<div class="md-callout-title">/g, '<div class="mb-2 text-sm font-semibold uppercase tracking-[0.2em]">')
    .replace(/<div class="md-callout-body">/g, '<div class="space-y-3 text-sm leading-7">')
}

function bindImageLightbox(container: HTMLElement, onOpenImage: (image: LightboxImage) => void) {
  const cleanups: Array<() => void> = []

  const handleContainerClick = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) {
      return
    }

    const src = target.getAttribute("src")?.trim()
    if (!src) {
      return
    }

    onOpenImage({
      src,
      alt: target.getAttribute("alt") ?? "",
    })
  }

  const handleContainerKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
      return
    }

    const target = keyboardEvent.target
    if (!(target instanceof HTMLImageElement)) {
      return
    }

    const src = target.getAttribute("src")?.trim()
    if (!src) {
      return
    }

    keyboardEvent.preventDefault()
    onOpenImage({
      src,
      alt: target.getAttribute("alt") ?? "",
    })
  }

  for (const image of Array.from(container.querySelectorAll<HTMLImageElement>("img"))) {
    image.classList.add("cursor-zoom-in", "transition-opacity", "hover:opacity-90")
    image.setAttribute("role", "button")
    image.setAttribute("tabindex", "0")
    image.setAttribute("aria-label", image.getAttribute("alt")?.trim() || "点击放大图片")
  }

  container.addEventListener("click", handleContainerClick)
  container.addEventListener("keydown", handleContainerKeyDown)

  cleanups.push(() => {
    container.removeEventListener("click", handleContainerClick)
    container.removeEventListener("keydown", handleContainerKeyDown)
  })

  return () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}

async function enhanceMarkdown(container: HTMLElement) {
  const headingSelectors = "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"
  for (const heading of Array.from(container.querySelectorAll<HTMLElement>(headingSelectors))) {
    if (heading.querySelector(":scope > a.md-heading-anchor")) {
      continue
    }

    const anchor = document.createElement("a")
    anchor.className = "md-heading-anchor"
    anchor.href = `#${heading.id}`
    anchor.setAttribute("aria-label", `链接到 ${heading.textContent ?? "标题"}`)
    anchor.textContent = "#"
    heading.appendChild(anchor)
  }

  for (const codeBlock of Array.from(container.querySelectorAll<HTMLElement>("pre.md-code-block"))) {
    const header = codeBlock.querySelector<HTMLElement>(":scope > .md-code-header")
    if (!header || header.querySelector(".md-copy-button")) {
      continue
    }

    const button = document.createElement("button")
    button.type = "button"
    button.className = "md-copy-button"
    button.textContent = "复制"
    button.addEventListener("click", async () => {
      const code = codeBlock.querySelector("code")?.textContent ?? ""
      if (!code) {
        return
      }

      try {
        await navigator.clipboard.writeText(code)
        button.textContent = "已复制"
        window.setTimeout(() => {
          button.textContent = "复制"
        }, 1500)
      } catch {
        button.textContent = "失败"
        window.setTimeout(() => {
          button.textContent = "复制"
        }, 1500)
      }
    })
    header.appendChild(button)
  }

  const mermaidBlocks = Array.from(container.querySelectorAll<HTMLElement>("[data-mermaid]"))
  if (mermaidBlocks.length === 0) {
    return
  }

  const isDark = document.documentElement.classList.contains("dark")
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: isDark ? "dark" : "default",
  })

  await Promise.all(
    mermaidBlocks.map(async (block, index) => {
      if (block.dataset.processed === "true") {
        return
      }

      const source = block.dataset.mermaid ?? ""
      if (!source.trim()) {
        return
      }

      try {
        const renderResult = await mermaid.render(`mermaid-${index}-${Date.now()}`, source)
        block.innerHTML = renderResult.svg
        block.dataset.processed = "true"
      } catch {
        block.innerHTML = `<pre class="my-0 overflow-x-auto rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><code>${escapeHtml(source)}</code></pre><p class="mt-3 text-sm text-rose-700 dark:text-rose-300">Mermaid 图表渲染失败，请检查语法。</p>`
      }
    }),
  )
}

export function MarkdownContent({ content, className, emptyText, markdownEmojiMap }: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null)
  const normalized = content.replace(/\r\n/g, "\n").trim()
  const resolvedMarkdownEmojiMap = useMarkdownEmojiMap(markdownEmojiMap)
  const html = useMemo(() => (normalized ? renderMarkdown(normalized, resolvedMarkdownEmojiMap) : ""), [normalized, resolvedMarkdownEmojiMap])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !html) {
      return
    }

    let removeImageLightbox = () => {}
    let cancelled = false

    void enhanceMarkdown(container).then(() => {
      if (cancelled) {
        return
      }

      removeImageLightbox = bindImageLightbox(container, setLightboxImage)
    })

    return () => {
      cancelled = true
      removeImageLightbox()
    }
  }, [html])

  useEffect(() => {
    if (!lightboxImage) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImage(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [lightboxImage])

  if (!normalized) {
    return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null
  }

  return (
    <>
      <div
        ref={containerRef}
        className={className ?? "markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {lightboxImage ? createPortal(
        <div key={lightboxImage.src} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightboxImage(null)}>
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-80"
            onClick={() => setLightboxImage(null)}
            aria-label="关闭图片预览"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative h-[90vh] w-[90vw] max-w-[1400px]" onClick={(event) => event.stopPropagation()}>
            <Image
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              fill
              unoptimized
              className="rounded-2xl object-contain shadow-2xl"
              sizes="90vw"
            />
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
