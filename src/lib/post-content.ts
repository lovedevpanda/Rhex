export type PostBlockAccessType = "PUBLIC" | "AUTHOR_ONLY" | "REPLY_UNLOCK" | "PURCHASE_UNLOCK"

export interface PostContentBlock {
  id: string
  type: PostBlockAccessType
  text: string
  price?: number
  replyThreshold?: number
  summary?: string
}

export interface PostContentDocument {
  version: 1
  blocks: PostContentBlock[]
}

function createId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : ""
}

function normalizePrice(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined
  }

  return Math.min(100000, Math.floor(numberValue))
}

function normalizeReplyThreshold(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined
  }

  return Math.min(999, Math.floor(numberValue))
}

function normalizeBlockType(value: unknown): PostBlockAccessType {
  if (value === "AUTHOR_ONLY" || value === "REPLY_UNLOCK" || value === "PURCHASE_UNLOCK") {
    return value
  }

  return "PUBLIC"
}

export function buildPostContentDocument(input: {
  publicContent?: string
  authorOnlyContent?: string
  replyUnlockContent?: string
  replyThreshold?: number
  purchaseUnlockContent?: string
  purchasePrice?: number
}): PostContentDocument {
  const blocks: PostContentBlock[] = []
  const publicContent = normalizeText(input.publicContent)
  const authorOnlyContent = normalizeText(input.authorOnlyContent)
  const replyUnlockContent = normalizeText(input.replyUnlockContent)
  const purchaseUnlockContent = normalizeText(input.purchaseUnlockContent)

  if (publicContent) {
    blocks.push({
      id: createId("public", blocks.length),
      type: "PUBLIC",
      text: publicContent,
    })
  }

  if (authorOnlyContent) {
    blocks.push({
      id: createId("author", blocks.length),
      type: "AUTHOR_ONLY",
      text: authorOnlyContent,
    })
  }

  if (replyUnlockContent) {
    blocks.push({
      id: createId("reply", blocks.length),
      type: "REPLY_UNLOCK",
      text: replyUnlockContent,
      replyThreshold: normalizeReplyThreshold(input.replyThreshold) ?? 1,
    })
  }

  if (purchaseUnlockContent) {
    blocks.push({
      id: createId("purchase", blocks.length),
      type: "PURCHASE_UNLOCK",
      text: purchaseUnlockContent,
      price: normalizePrice(input.purchasePrice) ?? 1,
    })
  }

  return {
    version: 1,
    blocks: blocks.length > 0
      ? blocks
      : [{ id: "public-1", type: "PUBLIC", text: "" }],
  }
}

export function parsePostContentDocument(rawContent: string): PostContentDocument {
  const normalized = typeof rawContent === "string" ? rawContent.trim() : ""

  if (!normalized) {
    return {
      version: 1,
      blocks: [{ id: "public-1", type: "PUBLIC", text: "" }],
    }
  }

  try {
    const parsed = JSON.parse(normalized) as PostContentDocument
    if (parsed && parsed.version === 1 && Array.isArray(parsed.blocks)) {
      const normalizedBlocks: PostContentBlock[] = parsed.blocks
        .map((block, index) => ({
          id: normalizeText(block?.id) || createId("block", index),
          type: normalizeBlockType(block?.type),
          text: normalizeText(block?.text),
          price: normalizePrice(block?.price),
          replyThreshold: normalizeReplyThreshold(block?.replyThreshold),
          summary: normalizeText(block?.summary) || undefined,
        }))
        .filter((block) => block.text)

      if (normalizedBlocks.length > 0) {
        return {
          version: 1,
          blocks: normalizedBlocks,
        }
      }
    }
  } catch {
    // ignore legacy plain text content
  }

  return {
    version: 1,
    blocks: [{ id: "public-1", type: "PUBLIC", text: rawContent }],
  }
}

export function serializePostContentDocument(document: PostContentDocument) {
  return JSON.stringify(document)
}

export function getPublicPostContentText(rawContent: string) {
  return parsePostContentDocument(rawContent)
    .blocks
    .filter((block) => block.type === "PUBLIC")
    .map((block) => block.text)
    .join("\n\n")
    .trim()
}

export function getAllPostContentText(rawContent: string) {
  return parsePostContentDocument(rawContent)
    .blocks
    .map((block) => block.text)
    .join("\n\n")
    .trim()
}

