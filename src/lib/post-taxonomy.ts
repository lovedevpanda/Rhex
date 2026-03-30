import { STOP_WORDS } from "@/lib/stop_words"

type JiebaModule = typeof import("jieba-wasm")

let jiebaModulePromise: Promise<JiebaModule> | null = null
let jiebaReadyPromise: Promise<void> | null = null
let jiebaCut: JiebaModule["cut"] | null = null

function loadJiebaModule() {
  if (!jiebaModulePromise) {
    jiebaModulePromise = import("jieba-wasm")
  }

  return jiebaModulePromise
}

export function ensureJiebaReady() {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  if (!jiebaReadyPromise) {
    jiebaReadyPromise = loadJiebaModule()
      .then(async (module) => {
        await module.default()
        jiebaCut = module.cut
      })
      .catch((error) => {
        jiebaReadyPromise = null
        jiebaCut = null
        throw error
      })
  }

  return jiebaReadyPromise
}

const HAN_PATTERN = /[\u4e00-\u9fff]/
const ENGLISH_PATTERN = /^(?=.*[a-z])[a-z0-9]+$/i
const TAG_SYMBOL_PATTERN = /[^\p{L}\p{N}\u4e00-\u9fff]+/gu

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function sanitizeToken(value: string) {
  const cleaned = value.replace(TAG_SYMBOL_PATTERN, "").trim()
  const hasConsecutive = /(.)\1+/.test(cleaned)

  if (!cleaned || hasConsecutive) {
    return ""
  }

  return cleaned
}

function tokenizeText(text: string) {
  if (typeof window === "undefined" || !jiebaCut) {
    return [] as string[]
  }

  const normalizedText = normalizeWhitespace(text)
  if (!normalizedText) {
    return [] as string[]
  }

  try {
    const tokens = jiebaCut(normalizedText, true) as string[]

    return tokens
      .map((item: string) => sanitizeToken(item))
      .filter(Boolean)
  } catch {
    return [] as string[]
  }
}

function isValidTagToken(token: string) {
  if (!token) {
    return false
  }

  if (HAN_PATTERN.test(token)) {
    return token.length > 1 && !STOP_WORDS.has(token)
  }

  if (ENGLISH_PATTERN.test(token)) {
    return token.length > 2 && !STOP_WORDS.has(token)
  }

  return false
}

export function slugifyTagName(name: string) {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32)
}

function buildTagFrequency(text: string) {
  const frequency = new Map<string, number>()
  const tokens = tokenizeText(text)

  tokens
    .filter((token: string) => isValidTagToken(token))
    .forEach((token: string) => {
      frequency.set(token, (frequency.get(token) ?? 0) + 1)
    })

  return frequency
}

export function extractAutoTags(title: string, content: string, limit = 10) {
  const maxCount = Math.max(0, Math.min(limit, 10))
  const sourceText = normalizeWhitespace(`${title} ${content}`)
  const result = buildTagFrequency(sourceText).entries()

  return [...result]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      if (right[0].length !== left[0].length) {
        return right[0].length - left[0].length
      }

      return left[0].localeCompare(right[0], "zh-Hans-CN")
    })
    .map(([token]) => token)
    .slice(0, maxCount)
}
