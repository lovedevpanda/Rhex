export const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m3u8"]
export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]
export const MARKDOWN_EMBED_HOSTS = [
  "player.bilibili.com",
  "www.bilibili.com",
  "music.163.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "v.qq.com",
] as const

export const MARKDOWN_EMBED_HOST_SET = new Set<string>(MARKDOWN_EMBED_HOSTS)

export function normalizeMarkdownMediaUrl(input: string) {
  const value = input.trim()
  if (!value) {
    return null
  }

  const normalized = value.startsWith("//") ? `https:${value}` : value

  try {
    const url = new URL(normalized)
    return ["http:", "https:"].includes(url.protocol) ? url : null
  } catch {
    return null
  }
}

export function normalizeMarkdownMediaSrc(input: string) {
  const url = normalizeMarkdownMediaUrl(input)
  if (!url) {
    return null
  }

  return input.trim().startsWith("//")
    ? `//${url.host}${url.pathname}${url.search}${url.hash}`
    : url.toString()
}

export function isSupportedMarkdownEmbedHost(hostname: string) {
  return MARKDOWN_EMBED_HOST_SET.has(hostname)
}

export function isSupportedMarkdownEmbedSrc(input: string) {
  const normalizedSrc = normalizeMarkdownMediaSrc(input)
  if (!normalizedSrc) {
    return false
  }

  try {
    const url = new URL(normalizedSrc.startsWith("//") ? `https:${normalizedSrc}` : normalizedSrc)
    return isSupportedMarkdownEmbedHost(url.hostname)
  } catch {
    return false
  }
}
