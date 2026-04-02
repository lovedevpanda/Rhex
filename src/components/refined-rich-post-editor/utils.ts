import { AUDIO_EXTENSIONS, COMMON_EMBED_HOSTS, VIDEO_EXTENSIONS } from "@/components/refined-rich-post-editor/constants"
import type { MediaInsertResult } from "@/components/refined-rich-post-editor/types"

function normalizeMediaUrl(input: string) {
  const value = input.trim()
  if (!value) {
    return null
  }

  const normalized = value.startsWith("//") ? `https:${value}` : value

  try {
    return new URL(normalized)
  } catch {
    return null
  }
}

export function inferMediaInsert(input: string): MediaInsertResult | null {
  const url = normalizeMediaUrl(input)
  if (!url) {
    return null
  }

  const pathname = url.pathname.toLowerCase()
  const originalSrc = input.trim().startsWith("//") ? `//${url.host}${url.pathname}${url.search}${url.hash}` : url.toString()

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

  if (COMMON_EMBED_HOSTS.has(url.hostname)) {
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
  const value = input.trim()
  if (!value) {
    return null
  }

  const normalized = value.startsWith("//") ? `https:${value}` : value

  try {
    const url = new URL(normalized)
    return url.protocol === "http:" || url.protocol === "https:" ? url : null
  } catch {
    return null
  }
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
  if (!url) {
    return null
  }

  const originalSrc = urlInput.trim().startsWith("//")
    ? `//${url.host}${url.pathname}${url.search}${url.hash}`
    : url.toString()
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
