import { cache } from "react"

import { findActiveSensitiveWords } from "@/db/content-safety-queries"

export type SensitiveMatchType = "EXACT" | "CONTAINS" | "REGEX"
export type SensitiveActionType = "REJECT" | "REVIEW" | "REPLACE"
export type SensitiveScene = "post.title" | "post.content" | "post.tags" | "comment.content" | "profile.nickname" | "profile.bio" | "yinyang.question" | "yinyang.answer"

export interface SensitiveWordRule {
  id: string
  word: string
  matchType: SensitiveMatchType
  actionType: SensitiveActionType
  status: boolean
}

export interface CompiledSensitiveWordRule extends SensitiveWordRule {
  matcher: RegExp | null
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
const SENSITIVE_WORD_RULES_CACHE_TTL_MS = 60_000

let cachedSensitiveWordRules: CompiledSensitiveWordRule[] | null = null
let sensitiveWordRulesCacheExpiry = 0
let sensitiveWordRulesCachePromise: Promise<CompiledSensitiveWordRule[]> | null = null

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

function compileSensitiveWordRules(rules: Awaited<ReturnType<typeof findActiveSensitiveWords>>): CompiledSensitiveWordRule[] {
  return rules.map((rule) => {
    const normalizedRule: SensitiveWordRule = {
      id: rule.id,
      word: rule.word,
      matchType: normalizeMatchType(rule.matchType),
      actionType: normalizeActionType(rule.actionType),
      status: rule.status,
    }

    return {
      ...normalizedRule,
      matcher: buildMatcher(normalizedRule),
    }
  })
}

function setSensitiveWordRulesCache(rules: CompiledSensitiveWordRule[]) {
  cachedSensitiveWordRules = rules
  sensitiveWordRulesCacheExpiry = Date.now() + SENSITIVE_WORD_RULES_CACHE_TTL_MS
}

async function readSensitiveWordRulesFromDB(): Promise<CompiledSensitiveWordRule[]> {
  const rules = await findActiveSensitiveWords()
  return compileSensitiveWordRules(rules)
}

export function invalidateSensitiveWordRulesCache() {
  cachedSensitiveWordRules = null
  sensitiveWordRulesCacheExpiry = 0
  sensitiveWordRulesCachePromise = null
}

async function getMemoryCachedSensitiveWordRules(): Promise<CompiledSensitiveWordRule[]> {
  if (cachedSensitiveWordRules && Date.now() < sensitiveWordRulesCacheExpiry) {
    return cachedSensitiveWordRules
  }

  if (!sensitiveWordRulesCachePromise) {
    sensitiveWordRulesCachePromise = readSensitiveWordRulesFromDB()
      .then((rules) => {
        setSensitiveWordRulesCache(rules)
        return rules
      })
      .finally(() => {
        sensitiveWordRulesCachePromise = null
      })
  }

  return sensitiveWordRulesCachePromise
}

const getCachedSensitiveWordRules = cache(async (): Promise<CompiledSensitiveWordRule[]> => {
  return getMemoryCachedSensitiveWordRules()
})

export async function getSensitiveWordRules(): Promise<CompiledSensitiveWordRule[]> {
  return getCachedSensitiveWordRules()
}

export async function scanSensitiveText(
  input: SensitiveScanInput,
  rules?: CompiledSensitiveWordRule[],
): Promise<SensitiveScanResult> {
  const text = input.text.trim()
  const activeRules = rules ?? await getSensitiveWordRules()
  let sanitizedText = text
  const hits: SensitiveHit[] = []

  for (const rule of activeRules) {
    if (!rule.matcher || !text) {
      continue
    }

    if (!rule.matcher.test(text)) {
      continue
    }

    hits.push({
      ruleId: rule.id,
      word: rule.word,
      matchType: rule.matchType,
      actionType: rule.actionType,
    })

    if (rule.actionType === "REPLACE") {
      sanitizedText = sanitizedText.replace(rule.matcher, DEFAULT_REPLACEMENT)
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

export async function enforceSensitiveText(
  input: SensitiveScanInput,
  rules?: CompiledSensitiveWordRule[],
) {
  const result = await scanSensitiveText(input, rules)
  if (result.shouldReject) {
    const first = result.hits.find((item) => item.actionType === "REJECT")
    throw new ContentSafetyError(first ? `内容包含敏感词：${first.word}` : "内容包含敏感词")
  }
  return result
}
