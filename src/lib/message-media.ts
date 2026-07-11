import path from "path"

export const MESSAGE_IMAGE_UPLOAD_FOLDER = "message-images"
export const MESSAGE_FILE_UPLOAD_FOLDER = "message-files"

export interface MessageFileToken {
  name: string
  url: string
  extension: string | null
}

export type MessageContentBlock =
  | {
      type: "markdown"
      content: string
    }
  | ({
      type: "file"
    } & MessageFileToken)

const MESSAGE_FILE_LINE_PATTERN = /^file::(.+?):((?:https?:\/\/|\/).+)$/i
const MESSAGE_FILE_LINE_GLOBAL_PATTERN = /^file::.+?:((?:https?:\/\/|\/).+)$/gm
const MESSAGE_IMAGE_MARKDOWN_PATTERN = /!\[[^\]\r\n]*]\((?:[^)\r\n]+)\)/g
const MESSAGE_IMAGE_MARKDOWN_LINE_PATTERN = /^!\[[^\]\r\n]*]\((?:[^)\r\n]+)\)$/

function normalizeMessageFileName(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").replace(/:/g, "-").trim()
}

export function normalizeMessageFileRouteSegment(value: string) {
  return normalizeMessageFileName(value).replace(/[\\/]+/g, "-") || "file"
}

export function resolveMessageFileExtension(url: string) {
  try {
    const parsed = new URL(url, "https://messages.local")
    const extension = path.extname(parsed.pathname).replace(/^\./, "").toLowerCase()
    return extension || null
  } catch {
    return null
  }
}

export function parseMessageFileTokenLine(line: string): MessageFileToken | null {
  const trimmed = line.trim()
  const matched = trimmed.match(MESSAGE_FILE_LINE_PATTERN)
  if (!matched) {
    return null
  }

  const name = normalizeMessageFileName(matched[1] ?? "")
  const url = matched[2]?.trim() ?? ""
  if (!name || !url) {
    return null
  }

  return {
    name,
    url,
    extension: resolveMessageFileExtension(url),
  }
}

export function containsMessageFileToken(content: string) {
  return content.split(/\r?\n/).some((line) => Boolean(parseMessageFileTokenLine(line)))
}

export function containsMessageImageSyntax(content: string) {
  return /!\[[^\]\r\n]*]\((?:[^)\r\n]+)\)/.test(content)
}

export function isImageOnlyMessageContent(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.length > 0 && lines.every((line) => MESSAGE_IMAGE_MARKDOWN_LINE_PATTERN.test(line))
}

export function buildMessageFileToken(fileName: string, url: string) {
  return `file::${normalizeMessageFileName(fileName) || "未命名文件"}:${url.trim()}`
}

export function buildMessageFileProxyUrl(uploadId: string, fileName: string) {
  return `/api/messages/files/${encodeURIComponent(uploadId)}/${encodeURIComponent(normalizeMessageFileRouteSegment(fileName))}`
}

export function buildMessageImageMarkdown(fileName: string, url: string) {
  const alt = normalizeMessageFileName(fileName).replace(/[\[\]]/g, " ") || "图片"
  return `![${alt}](${url.trim()})`
}

export function splitMessageContentBlocks(content: string): MessageContentBlock[] {
  const lines = content.split(/\r?\n/)
  const blocks: MessageContentBlock[] = []
  const markdownBuffer: string[] = []

  function flushMarkdownBuffer() {
    if (markdownBuffer.length === 0) {
      return
    }

    const nextContent = markdownBuffer.join("\n").trim()
    markdownBuffer.length = 0
    if (!nextContent) {
      return
    }

    blocks.push({
      type: "markdown",
      content: nextContent,
    })
  }

  for (const line of lines) {
    const fileToken = parseMessageFileTokenLine(line)
    if (fileToken) {
      flushMarkdownBuffer()
      blocks.push({
        type: "file",
        ...fileToken,
      })
      continue
    }

    markdownBuffer.push(line)
  }

  flushMarkdownBuffer()
  return blocks
}

export function summarizeMessagePreview(content: string) {
  const withFileSummary = content
    .split(/\r?\n/)
    .map((line) => {
      const fileToken = parseMessageFileTokenLine(line)
      return fileToken ? `[文件] ${fileToken.name}` : line
    })
    .join(" ")

  const summary = withFileSummary
    .replace(MESSAGE_IMAGE_MARKDOWN_PATTERN, "[图片]")
    .replace(/\s+/g, " ")
    .trim()

  return summary || "还没有消息，发一条开始聊天吧"
}

export function protectMessageMediaTokens(content: string) {
  const protectedTokens: string[] = []

  function createPlaceholder(token: string) {
    const placeholder = `[[MESSAGE_MEDIA_${protectedTokens.length}]]`
    protectedTokens.push(token)
    return placeholder
  }

  const withProtectedImages = content.replace(MESSAGE_IMAGE_MARKDOWN_PATTERN, (matched) => createPlaceholder(matched))
  const protectedText = withProtectedImages.replace(MESSAGE_FILE_LINE_GLOBAL_PATTERN, (matched) => createPlaceholder(matched))

  return {
    protectedText,
    restore(input: string) {
      return input.replace(/\[\[MESSAGE_MEDIA_(\d+)]]/g, (_matched, rawIndex: string) => {
        const index = Number(rawIndex)
        return Number.isInteger(index) ? (protectedTokens[index] ?? "") : ""
      })
    },
  }
}
