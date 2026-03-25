import { findActiveSensitiveWords } from "@/db/content-safety-queries"


export type SensitiveMatchType = "EXACT" | "CONTAINS" | "REGEX"
export type SensitiveActionType = "REJECT" | "REVIEW" | "REPLACE"
export type SensitiveScene = "post.title" | "post.content" | "comment.content" | "profile.nickname" | "profile.bio"

export interface SensitiveWordRule {
  id: string
  word: string
  matchType: SensitiveMatchType
  actionType: SensitiveActionType
  status: boolean
}

export interface SensitiveScanInput {
  scene: SensitiveScene
  text: string
}

export interface SensitiveHit {
  ruleId: string
  word: string
  matchType: SensitiveMatchType
  actionType: SensitiveActionType
}

export interface SensitiveScanResult {
  scene: SensitiveScene
  originalText: string
  sanitizedText: string
  hits: SensitiveHit[]
  shouldReject: boolean
  shouldReview: boolean
}

export class ContentSafetyError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(message: string, statusCode = 400, code = "CONTENT_SAFETY_REJECTED") {
    super(message)
    this.name = "ContentSafetyError"
    this.statusCode = statusCode
    this.code = code
  }
}

const DEFAULT_REPLACEMENT = "**"

function normalizeMatchType(value: string): SensitiveMatchType {
  if (value === "EXACT" || value === "REGEX") {
    return value
  }
  return "CONTAINS"
}

function normalizeActionType(value: string): SensitiveActionType {
  if (value === "REVIEW" || value === "REPLACE") {
    return value
  }
  return "REJECT"
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildMatcher(rule: SensitiveWordRule) {
  if (rule.matchType === "REGEX") {
    try {
      return new RegExp(rule.word, "giu")
    } catch {
      return null
    }
  }

  if (rule.matchType === "EXACT") {
    return new RegExp(`^${escapeRegExp(rule.word)}$`, "iu")
  }

  return new RegExp(escapeRegExp(rule.word), "giu")
}

export async function getSensitiveWordRules() {
  const rules = await findActiveSensitiveWords()


  return rules.map((rule) => ({
    id: rule.id,
    word: rule.word,
    matchType: normalizeMatchType(rule.matchType),
    actionType: normalizeActionType(rule.actionType),
    status: rule.status,
  }))
}

export async function scanSensitiveText(input: SensitiveScanInput): Promise<SensitiveScanResult> {
  const text = input.text.trim()
  const rules = await getSensitiveWordRules()
  let sanitizedText = text
  const hits: SensitiveHit[] = []

  for (const rule of rules) {
    const matcher = buildMatcher(rule)
    if (!matcher || !text) {
      continue
    }

    if (!matcher.test(text)) {
      continue
    }

    hits.push({
      ruleId: rule.id,
      word: rule.word,
      matchType: rule.matchType,
      actionType: rule.actionType,
    })

    if (rule.actionType === "REPLACE") {
      const replaceMatcher = buildMatcher(rule)
      if (replaceMatcher) {
        sanitizedText = sanitizedText.replace(replaceMatcher, DEFAULT_REPLACEMENT)
      }
    }
  }

  return {
    scene: input.scene,
    originalText: text,
    sanitizedText,
    hits,
    shouldReject: hits.some((item) => item.actionType === "REJECT"),
    shouldReview: hits.some((item) => item.actionType === "REVIEW"),
  }
}

export async function enforceSensitiveText(input: SensitiveScanInput) {
  const result = await scanSensitiveText(input)
  if (result.shouldReject) {
    const first = result.hits.find((item) => item.actionType === "REJECT")
    throw new ContentSafetyError(first ? `内容包含敏感词：${first.word}` : "内容包含敏感词")
  }
  return result
}

