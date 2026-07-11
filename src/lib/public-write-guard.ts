import type { WriteGuardOptions } from "@/lib/write-guard"
import { withWriteGuard } from "@/lib/write-guard"
import { getRequestIp } from "@/lib/request-ip"
import { isPublicRouteError } from "@/lib/public-route-error"

export const publicWriteGuardPolicies = {
  "auth-captcha": {
    scope: "auth-captcha",
    cooldownMs: 1_000,
    cooldownMessage: "验证码获取过于频繁，请稍后再试",
  },
  "auth-pow": {
    scope: "auth-pow",
    cooldownMs: 1_000,
    cooldownMessage: "验证码获取过于频繁，请稍后再试",
  },
  "auth-verify-code": {
    scope: "auth-verify-code",
    cooldownMs: 1_000,
    cooldownMessage: "验证码校验过于频繁，请稍后再试",
  },
  "auth-forgot-password-reset": {
    scope: "auth-forgot-password-reset",
    cooldownMs: 1_500,
    cooldownMessage: "密码重置操作过于频繁，请稍后再试",
  },
  "comments-create": {
    scope: "comments-create",
    cooldownMs: 1_000,
    cooldownMessage: "评论提交过于频繁，请稍后再试",
    dedupeWindowMs: 10_000,
  },
  "comments-update": {
    scope: "comments-update",
    cooldownMs: 1_000,
    cooldownMessage: "评论编辑过于频繁，请稍后再试",
    dedupeWindowMs: 5_000,
  },
  "comments-offline": {
    scope: "comments-offline",
    cooldownMs: 1_000,
    cooldownMessage: "评论操作过于频繁，请稍后再试",
    dedupeWindowMs: 10_000,
  },
  "comments-like": {
    scope: "comments-like",
    cooldownMs: 500,
    cooldownMessage: "点赞操作过于频繁，请稍后再试",
    dedupeWindowMs: 1_000,
  },
  "follows-toggle": {
    scope: "follows-toggle",
    cooldownMs: 500,
    cooldownMessage: "关注操作过于频繁，请稍后再试",
    dedupeWindowMs: 1_000,
  },
  "blocks-toggle": {
    scope: "blocks-toggle",
    cooldownMs: 500,
    cooldownMessage: "拉黑操作过于频繁，请稍后再试",
    dedupeWindowMs: 1_000,
  },
  "board-applications-submit": {
    scope: "board-applications-submit",
    cooldownMs: 3_000,
    cooldownMessage: "节点申请提交过于频繁，请稍后再试",
    dedupeWindowMs: 60_000,
  },
  "board-applications-treasury-withdraw": {
    scope: "board-applications-treasury-withdraw",
    cooldownMs: 1_500,
    cooldownMessage: "节点金库提取操作过于频繁，请稍后再试",
    dedupeWindowMs: 10_000,
  },
  "posts-ai-categorize": {
    scope: "posts-ai-categorize",
    cooldownMs: 2_000,
    cooldownMessage: "AI 发帖辅助请求过于频繁，请稍后再试",
    dedupeWindowMs: 10_000,
  },
} as const

export type PublicWriteGuardPolicyName = keyof typeof publicWriteGuardPolicies

type PublicWriteGuardInput = {
  request: Request
  userId?: number | null
  dedupeKey?: string | null
}

export function createPublicWriteGuardOptions(
  name: PublicWriteGuardPolicyName,
  input: PublicWriteGuardInput,
): WriteGuardOptions {
  const policy = publicWriteGuardPolicies[name]
  const dedupeKey = input.dedupeKey?.trim()

  return {
    scope: policy.scope,
    cooldownMs: policy.cooldownMs,
    cooldownMessage: policy.cooldownMessage,
    dedupeWindowMs: "dedupeWindowMs" in policy ? policy.dedupeWindowMs : undefined,
    ...(dedupeKey && "dedupeWindowMs" in policy ? { dedupeKey } : {}),
    identity: {
      userId: input.userId ?? null,
      ip: getRequestIp(input.request),
    },
  }
}

export async function withPublicWriteGuard<T>(
  name: PublicWriteGuardPolicyName,
  input: PublicWriteGuardInput,
  task: () => Promise<T>,
): Promise<T> {
  return withWriteGuard(createPublicWriteGuardOptions(name, input), task)
}

export function createPublicWriteDedupeKey(...parts: Array<string | number | boolean | null | undefined>) {
  return parts.map((part) => String(part ?? "")).join("\u001f")
}

const PASSWORD_RESET_ACCOUNT_DISCOVERY_MESSAGES = new Set([
  "\u8be5\u90ae\u7bb1\u672a\u7ed1\u5b9a\u8d26\u53f7",
  "\u8be5\u624b\u673a\u53f7\u672a\u7ed1\u5b9a\u8d26\u53f7",
  "\u8be5\u8d26\u53f7\u5df2\u88ab\u7981\u7528\uff0c\u65e0\u6cd5\u627e\u56de\u5bc6\u7801",
  "\u8be5\u8d26\u53f7\u672a\u6fc0\u6d3b\uff0c\u65e0\u6cd5\u627e\u56de\u5bc6\u7801",
  "\u8be5\u624b\u673a\u53f7\u5c1a\u672a\u5b8c\u6210\u7ed1\u5b9a\u9a8c\u8bc1",
])

export function shouldMaskPasswordResetSendError(error: unknown) {
  return isPublicRouteError(error)
    && PASSWORD_RESET_ACCOUNT_DISCOVERY_MESSAGES.has(error.message)
}
