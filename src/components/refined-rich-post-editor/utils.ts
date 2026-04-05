import type { MediaInsertResult } from "@/components/refined-rich-post-editor/types"
import { AUDIO_EXTENSIONS, MARKDOWN_EMBED_HOST_SET, VIDEO_EXTENSIONS, normalizeMarkdownMediaSrc, normalizeMarkdownMediaUrl } from "@/lib/markdown/media"

export function inferMediaInsert(input: string): MediaInsertResult | null {
  const url = normalizeMarkdownMediaUrl(input)
  const originalSrc = normalizeMarkdownMediaSrc(input)
  if (!url) {
    return null
  }

  const pathname = url.pathname.toLowerCase()
  if (!originalSrc) {
    return null
  }

  if (VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return {
      template: `MEDIA::video::${originalSrc}`,
      message: "已识别为视频地址，将按 video 标签渲染",
    }
  }

  if (AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return {
      template: `MEDIA::audio::${originalSrc}`,
      message: "已识别为音频地址，将按 audio 标签渲染",
    }
  }

  if (MARKDOWN_EMBED_HOST_SET.has(url.hostname)) {
    return {
      template: `MEDIA::iframe::${originalSrc}`,
      message: "已识别为站点媒体链接，将按 iframe 渲染",
    }
  }

  return {
    template: `MEDIA::iframe::${originalSrc}`,
    message: "无法判断直链格式，将按 iframe 渲染",
  }
}

export function normalizeRemoteUrl(input: string) {
  return normalizeMarkdownMediaUrl(input)
}

function normalizeMarkdownAltText(input: string) {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\]/g, "\\]")
}

export function inferRemoteImageInsert(urlInput: string, altInput: string): MediaInsertResult | null {
  const url = normalizeRemoteUrl(urlInput)
  const originalSrc = normalizeMarkdownMediaSrc(urlInput)
  if (!url) {
    return null
  }

  if (!originalSrc) {
    return null
  }
  const altText = normalizeMarkdownAltText(altInput) || "image"

  return {
    template: `![${altText}](${originalSrc})`,
    message: "已插入远程图片地址",
  }
}

export function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}
