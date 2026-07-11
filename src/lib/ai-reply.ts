import {
  AiReplyTaskSourceType,
  AiReplyTaskStatus,
  AutoCategorizeTaskSourceType,
  NotificationType,
  type Prisma,
} from "@/db/types"
import { prisma } from "@/db/client"

import { apiError } from "@/lib/api-route"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { enforceSensitiveText } from "@/lib/content-safety"
import { enqueuePostFollowCommentNotifications } from "@/lib/follow-notifications"
import { getAiSafePostContentText } from "@/lib/post-content"
import { stripPostContentUserLinks } from "@/lib/post-mentions"
import { extractMentionTexts, stripUserLinkTokens } from "@/lib/mentions"
import { logError, logInfo } from "@/lib/logger"
import { createNotifications } from "@/lib/notification-writes"
import { getSiteSettings } from "@/lib/site-settings"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { requestInternalContentRevalidation } from "@/lib/internal-revalidation-client"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { getAiReplyConfig, getServerAiReplyConfig, isAiReplyConfigRunnable, type AiReplyAgentConfigData, type AiReplyConfigData } from "@/lib/ai-reply-config"
import { resolveAiProvider, type AiProviderConfig } from "@/lib/ai/provider"
import { runAiTask } from "@/lib/ai/service"
import { AiProviderError } from "@/lib/ai/provider/types"
import { AiRateLimitError } from "@/lib/ai/rate-limit"
import { resolveSafeOutboundTarget } from "@/lib/safe-outbound-http"
import { getAutoCategorizeConfig, type AutoCategorizeConfig } from "@/lib/ai/capabilities/auto-categorize-config"

const AI_REPLY_BACKGROUND_JOB_NAME = "ai-reply.process"
const AI_REPLY_MAX_CONTEXT_CHARS = 4_000
const AI_REPLY_RESULT_EXCERPT_CHARS = 240
const AI_REPLY_NOTIFICATION_PREVIEW_CHARS = 80
const AI_REPLY_RETRY_BASE_DELAY_MS = 30_000
const AI_REPLY_RETRY_MAX_DELAY_MS = 10 * 60 * 1_000
const DEFAULT_AI_REPLY_PROCESSING_STALE_MS = 5 * 60 * 1_000
const AI_REPLY_ADMIN_TASKS_PAGE_SIZE = 10
const AUTO_CATEGORIZE_ADMIN_TASKS_PAGE_SIZE = 10
const AI_REPLY_DELETABLE_TASK_STATUSES = [
  AiReplyTaskStatus.SUCCEEDED,
  AiReplyTaskStatus.FAILED,
  AiReplyTaskStatus.CANCELLED,
] as const

async function ensureCanManageApps() {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.apps.manage",
    "无权限访问应用后台",
  )
}

type AiReplyTriggerReason = "mention" | "keyword" | "all-posts" | "board"

type AiReplyTaskWorkerRecord = Awaited<ReturnType<typeof loadAiReplyTaskForWorker>>
const autoCategorizeRecentTaskSelect = {
  id: true,
  sourceType: true,
  status: true,
  postId: true,
  title: true,
  attemptCount: true,
  maxAttempts: true,
  errorMessage: true,
  resultStatus: true,
  resultTagIds: true,
  resultTagsJson: true,
  resultReasoning: true,
  resultRawPreview: true,
  createdAt: true,
  updatedAt: true,
  finishedAt: true,
  post: {
    select: {
      title: true,
    },
  },
  requesterUser: {
    select: {
      username: true,
      nickname: true,
    },
  },
  resultBoard: {
    select: {
      slug: true,
      name: true,
    },
  },
} satisfies Prisma.AutoCategorizeTaskSelect

export interface AiReplyAdminData {
  config: AiReplyConfigData
  autoCategorizeConfig: AutoCategorizeConfig
  autoCategorizeDefaultBoard: {
    slug: string
    name: string
  } | null
  agentUser: {
    id: number
    username: string
    nickname: string | null
    status: string
  } | null
  agentUsers: Array<{
    id: number
    username: string
    nickname: string | null
    status: string
  }>
  summary: {
    pending: number
    processing: number
    succeeded: number
    failed: number
    cancelled: number
  }
  autoCategorizeSummary: {
    pending: number
    processing: number
    succeeded: number
    failed: number
    cancelled: number
  }
  recentTasksPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  autoCategorizeRecentTasksPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  recentTasks: Array<{
    id: string
    sourceType: AiReplyTaskSourceType
    status: AiReplyTaskStatus
    postId: string
    postTitle: string
    postSlug: string
    sourceCommentId: string | null
    sourceCommentExcerpt: string | null
    generatedCommentId: string | null
    triggerUserDisplayName: string
    agentDisplayName: string
    attemptCount: number
    maxAttempts: number
    errorMessage: string | null
    resultExcerpt: string | null
    createdAt: string
    updatedAt: string
    finishedAt: string | null
  }>
  autoCategorizeRecentTasks: Array<{
    id: string
    sourceType: AutoCategorizeTaskSourceType
    status: AiReplyTaskStatus
    postId: string | null
    postTitle: string | null
    previewTitle: string
    requesterDisplayName: string
    attemptCount: number
    maxAttempts: number
    errorMessage: string | null
    resultStatus: string | null
    resultBoard: {
      slug: string
      name: string
    } | null
    resultTags: Array<{
      slug: string
      name: string
    }>
    resultReasoning: string | null
    resultRawPreview: string | null
    createdAt: string
    updatedAt: string
    finishedAt: string | null
  }>
}

class AiReplyTaskCancelledError extends Error {}

function normalizeAiReplyAdminTasksPage(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1
}

function canDeleteAiReplyTaskLog(status: AiReplyTaskStatus) {
  return status === AiReplyTaskStatus.SUCCEEDED
    || status === AiReplyTaskStatus.FAILED
    || status === AiReplyTaskStatus.CANCELLED
}

function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return ""
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function containsUserLinkToken(content: string, username: string) {
  if (!content || !username) {
    return false
  }

  const pattern = new RegExp(`\\[userLink:[^\\]\\r\\n:]+:${escapeRegExp(username)}\\]`, "u")
  return pattern.test(content)
}

function doesPlainTextMentionUser(content: string, user: { username: string; nickname: string | null }) {
  const mentionTexts = extractMentionTexts(content)
  return mentionTexts.some((item) => item === user.username || item === user.nickname)
}

function buildDisplayName(user: { username: string; nickname: string | null }, anonymous = false) {
  if (anonymous) {
    return "匿名用户"
  }

  return user.nickname ?? user.username
}

function parseAutoCategorizeTagsJson(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null
      }

      const record = item as Record<string, unknown>
      const slug = typeof record.slug === "string" ? record.slug.trim() : ""
      const name = typeof record.name === "string" ? record.name.trim() : ""
      if (!slug || !name) {
        return null
      }

      return { slug, name }
    })
    .filter((item): item is { slug: string; name: string } => Boolean(item))
}

function getPostVisibleText(post: {
  content: string
  appendedContent: string | null
}) {
  const mainContent = getAiSafePostContentText(stripPostContentUserLinks(post.content))
  const appendedContent = post.appendedContent
    ? getAiSafePostContentText(stripUserLinkTokens(post.appendedContent))
    : ""
  return [mainContent, appendedContent].filter(Boolean).join("\n\n")
}

function getPostMainText(content: string) {
  return getAiSafePostContentText(stripPostContentUserLinks(content))
}

function getPostMentionTextForAi(post: {
  content: string
  appendedContent: string | null
}) {
  const mainContent = getAiSafePostContentText(post.content)
  const appendedContent = post.appendedContent ? getAiSafePostContentText(post.appendedContent) : ""
  return [mainContent, appendedContent].filter(Boolean).join("\n\n")
}

function doesPostStillMentionAgent(post: { content: string; appendedContent: string | null }, agentUser: { username: string; nickname: string | null }) {
  const mentionText = getPostMentionTextForAi(post)
  if (containsUserLinkToken(mentionText, agentUser.username)) {
    return true
  }

  return doesPlainTextMentionUser(stripUserLinkTokens(mentionText), agentUser)
}

function doesCommentStillMentionAgent(commentContent: string, agentUser: { username: string; nickname: string | null }) {
  if (containsUserLinkToken(commentContent, agentUser.username)) {
    return true
  }

  return doesPlainTextMentionUser(stripUserLinkTokens(commentContent), agentUser)
}

function buildPostSourceKey(postId: string, agentUserId: number) {
  return `post:${postId}:agent:${agentUserId}`
}

function buildCommentSourceKey(commentId: string, agentUserId: number) {
  return `comment:${commentId}:agent:${agentUserId}`
}

function buildAiReplySourceKey(params: { sourceType: AiReplyTaskSourceType; postId: string; sourceCommentId?: string; agentUserId: number; reason: AiReplyTriggerReason }) {
  const baseKey = params.sourceType === AiReplyTaskSourceType.POST
    ? buildPostSourceKey(params.postId, params.agentUserId)
    : buildCommentSourceKey(params.sourceCommentId ?? "", params.agentUserId)
  return params.reason === "mention" ? baseKey : `${baseKey}:trigger:${params.reason}`
}

function readAiReplyTriggerReason(sourceKey: string): AiReplyTriggerReason {
  if (sourceKey.endsWith(":trigger:keyword")) return "keyword"
  if (sourceKey.endsWith(":trigger:all-posts")) return "all-posts"
  if (sourceKey.endsWith(":trigger:board")) return "board"
  return "mention"
}

function textMatchesKeywordTriggers(text: string, keywords: string[]) {
  const normalizedText = text.toLowerCase()
  return keywords.some((keyword) => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return normalizedKeyword.length > 0 && normalizedText.includes(normalizedKeyword)
  })
}

function findRunnableAgentConfig(config: Awaited<ReturnType<typeof getServerAiReplyConfig>>, agentUserId: number): AiReplyAgentConfigData | null {
  return config.agents.find((agent) => agent.enabled && agent.agentUserId === agentUserId) ?? null
}

function getAiReplyRetryDelayMs(attemptCount: number) {
  const delayMs = AI_REPLY_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptCount - 1)
  return Math.min(AI_REPLY_RETRY_MAX_DELAY_MS, delayMs)
}

function getAiReplyProcessingStaleMs() {
  const rawValue = Number.parseInt(String(process.env.AI_REPLY_PROCESSING_STALE_MS ?? ""), 10)
  if (Number.isFinite(rawValue) && rawValue >= 60_000) {
    return rawValue
  }

  const backgroundPendingIdleMs = Number.parseInt(String(process.env.BACKGROUND_JOB_PENDING_IDLE_MS ?? ""), 10)
  if (Number.isFinite(backgroundPendingIdleMs) && backgroundPendingIdleMs >= 60_000) {
    return Math.max(DEFAULT_AI_REPLY_PROCESSING_STALE_MS, backgroundPendingIdleMs * 2)
  }

  return DEFAULT_AI_REPLY_PROCESSING_STALE_MS
}

function normalizeAiReplyOutput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const fencedMatch = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/u)
  return fencedMatch?.[1]?.trim() ?? trimmed
}

function buildPostReplyUserPrompt(task: NonNullable<AiReplyTaskWorkerRecord>) {
  if (!task.post) {
    return ""
  }

  const postAuthorName = buildDisplayName(task.post.author, task.post.isAnonymous)
  const postVisibleText = truncateText(getPostMainText(task.post.content), AI_REPLY_MAX_CONTEXT_CHARS)
  const appendedContentText = task.post.appendedContent
    ? truncateText(getAiSafePostContentText(stripUserLinkTokens(task.post.appendedContent)), AI_REPLY_MAX_CONTEXT_CHARS)
    : ""

  return [
    "论坛帖子上下文：",
    `节点：${task.post.board.name}`,
    `发帖人：${postAuthorName}`,
    `发帖用户：${buildDisplayName(task.triggerUser)}`,
    `帖子标题：${task.post.title}`,
    `帖子正文：\n${postVisibleText || "（无正文）"}`,
    appendedContentText
      ? `帖子补充：\n${appendedContentText}`
      : "",
    "请基于整帖语义回复。直接输出评论正文，不要带标题或额外说明。",
  ].filter(Boolean).join("\n\n")
}

function buildCommentReplyUserPrompt(task: NonNullable<AiReplyTaskWorkerRecord>) {
  if (!task.post || !task.sourceComment) {
    return ""
  }

  const postAuthorName = buildDisplayName(task.post.author, task.post.isAnonymous)
  const sourceCommentAuthorName = buildDisplayName(task.sourceComment.user, task.sourceComment.useAnonymousIdentity)
  const sourceCommentText = truncateText(stripUserLinkTokens(task.sourceComment.content), AI_REPLY_MAX_CONTEXT_CHARS)
  const repliedComment = task.sourceComment.replyToComment
  const repliedCommentText = repliedComment
    ? truncateText(stripUserLinkTokens(repliedComment.content), AI_REPLY_MAX_CONTEXT_CHARS)
    : ""
  const repliedCommentAuthor = repliedComment
    ? buildDisplayName(repliedComment.user, repliedComment.useAnonymousIdentity)
    : ""

  return [
    "论坛评论上下文：",
    `节点：${task.post.board.name}`,
    `帖子标题：${task.post.title}`,
    `帖子作者：${postAuthorName}`,
    `帖子正文摘要：\n${truncateText(getPostVisibleText(task.post), AI_REPLY_MAX_CONTEXT_CHARS) || "（无正文）"}`,
    `当前评论作者：${sourceCommentAuthorName}`,
    `当前评论内容：\n${sourceCommentText || "（无内容）"}`,
    repliedComment
      ? `当前评论所回复的上一条评论（${repliedCommentAuthor}）：\n${repliedCommentText || "（无内容）"}`
      : "",
    `触发提及的用户：${buildDisplayName(task.triggerUser)}`,
    "请结合主楼和当前评论链上下文，在楼中楼直接回应当前评论。只输出评论正文。",
  ].filter(Boolean).join("\n\n")
}

async function callAiReplyModel(params: {
  config: Awaited<ReturnType<typeof getServerAiReplyConfig>>
  agentConfig: AiReplyAgentConfigData
  sourceType: AiReplyTaskSourceType
  prompt: string
  agentUser: {
    username: string
    nickname: string | null
  }
}) {
  const systemPrompt = [
    params.agentConfig.systemPrompt.trim(),
    `你当前扮演的论坛账号是 @${params.agentUser.username}${params.agentUser.nickname ? `（${params.agentUser.nickname}）` : ""}。`,
    params.sourceType === AiReplyTaskSourceType.POST
      ? params.agentConfig.postReplyPrompt.trim()
      : params.agentConfig.commentReplyPrompt.trim(),
  ].filter(Boolean).join("\n\n")

  // The provider receives the configured API key. Validate the resolved target
  // immediately before every dispatch so a saved private/local endpoint cannot
  // be reached by task retries or the admin connectivity test.
  await resolveSafeOutboundTarget(params.config.baseUrl)

  const providerConfig: AiProviderConfig = {
    kind: "openai-compatible",
    baseUrl: params.config.baseUrl,
    apiKey: params.config.apiKey ?? "",
  }
  const provider = resolveAiProvider(providerConfig)

  try {
    const result = await runAiTask({
      kind: "reply",
      appKey: "app.ai-reply",
      provider,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.prompt },
      ],
      options: {
        model: params.config.model,
        temperature: params.config.temperature,
        maxTokens: params.config.maxOutputTokens,
        timeoutMs: params.config.timeoutMs,
      },
    })

    const content = normalizeAiReplyOutput(result.text)
    if (!content) {
      throw new Error("AI provider returned empty content")
    }
    return content
  } catch (err) {
    if (err instanceof AiProviderError) {
      // openai-compatible 在 HTTP 非 2xx 时抛出 "AI provider responded with <status>: <snippet>"，
      // 保留该文案让调用方（任务表 errorMessage）与旧实现输出尽量一致。
      if (/AI provider responded with \d+/.test(err.message)) {
        throw new Error(err.message)
      }
      throw new Error(`AI provider error (${err.kind}): ${err.message}`)
    }
    throw err
  }
}

export async function sendAiReplyConnectivityTest(params: {
  config: Awaited<ReturnType<typeof getServerAiReplyConfig>>
  agentUser: {
    id: number
    username: string
    nickname: string | null
    status: string
  }
}) {
  if (params.agentUser.status !== "ACTIVE") {
    throw new Error("AI 代理账号当前不是启用状态")
  }

  const reply = await callAiReplyModel({
    config: params.config,
    agentConfig: params.config.agents.find((agent) => agent.agentUserId === params.agentUser.id) ?? {
      id: "test",
      enabled: true,
      label: "AI 助手",
      agentUserId: params.agentUser.id,
      respondToPostMentions: true,
      respondToCommentMentions: true,
      autoReplyToAllPosts: false,
      keywordTriggers: [],
      boardSlugs: [],
      systemPrompt: params.config.systemPrompt,
      postReplyPrompt: params.config.postReplyPrompt,
      commentReplyPrompt: params.config.commentReplyPrompt,
    },
    sourceType: AiReplyTaskSourceType.COMMENT,
    agentUser: params.agentUser,
    prompt: [
      "这是论坛后台的 AI 连通性测试，不是真实帖子或评论。",
      "请直接回复一句不超过 30 个字的简体中文，表达你已准备好参与论坛讨论。",
      "不要输出标题、编号、代码块或多余解释。",
    ].join("\n"),
  })

  return {
    reply: truncateText(reply, 200),
  }
}

async function createAiReplyComment(params: {
  postId: string
  agentUserId: number
  content: string
  parentId?: string
  replyToUserId?: number
  replyToCommentId?: string
  taskId: string
  taskStartedAt: Date
}) {
  return prisma.$transaction(async (tx) => {
    const createdAt = new Date()

    // A stale worker can be reclaimed while its model request is still in
    // flight. Claim the task row inside the same transaction as the comment
    // write so only the worker that still owns this startedAt value can create
    // the externally visible reply.
    const taskOwnership = await tx.aiReplyTask.updateMany({
      where: {
        id: params.taskId,
        status: AiReplyTaskStatus.PROCESSING,
        startedAt: params.taskStartedAt,
        generatedCommentId: null,
      },
      data: {
        startedAt: createdAt,
      },
    })

    if (taskOwnership.count !== 1) {
      return null
    }

    const comment = await tx.comment.create({
      data: {
        postId: params.postId,
        userId: params.agentUserId,
        content: params.content,
        parentId: params.parentId ?? undefined,
        replyToUserId: params.replyToUserId ?? undefined,
        replyToCommentId: params.replyToCommentId ?? undefined,
        status: "NORMAL",
      },
      select: {
        id: true,
        postId: true,
        parentId: true,
        replyToUserId: true,
        content: true,
      },
    })

    await tx.user.update({
      where: { id: params.agentUserId },
      data: {
        commentCount: {
          increment: 1,
        },
        lastCommentAt: createdAt,
      },
    })

    await tx.post.update({
      where: { id: params.postId },
      data: {
        commentCount: {
          increment: 1,
        },
        lastCommentedAt: createdAt,
        activityAt: createdAt,
      },
    })

    await tx.aiReplyTask.update({
      where: { id: params.taskId },
      data: {
        status: AiReplyTaskStatus.SUCCEEDED,
        generatedCommentId: comment.id,
        resultExcerpt: truncateText(comment.content, AI_REPLY_RESULT_EXCERPT_CHARS),
        errorMessage: null,
        finishedAt: createdAt,
      },
    })

    return comment
  })
}

async function loadAiReplyTaskForWorker(taskId: string) {
  return prisma.aiReplyTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      sourceKey: true,
      sourceType: true,
      status: true,
      postId: true,
      sourceCommentId: true,
      generatedCommentId: true,
      triggerUserId: true,
      agentUserId: true,
      attemptCount: true,
      maxAttempts: true,
      startedAt: true,
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          appendedContent: true,
          status: true,
          isAnonymous: true,
          authorId: true,
          board: {
            select: {
              name: true,
              slug: true,
            },
          },
          author: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      },
      sourceComment: {
        select: {
          id: true,
          postId: true,
          userId: true,
          parentId: true,
          content: true,
          status: true,
          useAnonymousIdentity: true,
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          replyToComment: {
            select: {
              id: true,
              content: true,
              useAnonymousIdentity: true,
              user: {
                select: {
                  username: true,
                  nickname: true,
                },
              },
            },
          },
        },
      },
      triggerUser: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      agentUser: {
        select: {
          id: true,
          username: true,
          nickname: true,
          status: true,
        },
      },
    },
  })
}

async function claimAiReplyTask(taskId: string) {
  const now = new Date()
  const staleStartedAt = new Date(now.getTime() - getAiReplyProcessingStaleMs())
  const claimed = await prisma.aiReplyTask.updateMany({
    where: {
      id: taskId,
      scheduledAt: {
        lte: now,
      },
      OR: [
        {
          status: AiReplyTaskStatus.PENDING,
        },
        {
          status: AiReplyTaskStatus.PROCESSING,
          OR: [
            {
              startedAt: null,
            },
            {
              startedAt: {
                lte: staleStartedAt,
              },
            },
          ],
        },
      ],
    },
    data: {
      status: AiReplyTaskStatus.PROCESSING,
      startedAt: now,
      finishedAt: null,
      errorMessage: null,
      attemptCount: {
        increment: 1,
      },
    },
  })

  return claimed.count > 0
}

async function markAiReplyTaskCancelled(taskId: string, message: string) {
  await prisma.aiReplyTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.CANCELLED,
      errorMessage: truncateText(message, 1_000),
      finishedAt: new Date(),
    },
  })
}

async function markAiReplyTaskFailed(taskId: string, message: string) {
  await prisma.aiReplyTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.FAILED,
      errorMessage: truncateText(message, 1_000),
      finishedAt: new Date(),
    },
  })
}

async function requeueAiReplyTask(taskId: string, message: string, delayMs: number) {
  const scheduledAt = new Date(Date.now() + delayMs)

  await prisma.aiReplyTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.PENDING,
      scheduledAt,
      startedAt: null,
      finishedAt: null,
      errorMessage: truncateText(message, 1_000),
    },
  })

  await enqueueBackgroundJob(AI_REPLY_BACKGROUND_JOB_NAME, { taskId }, { delayMs })
}

function assertTaskStillRunnable(task: NonNullable<AiReplyTaskWorkerRecord>, config: Awaited<ReturnType<typeof getServerAiReplyConfig>>) {
  if (!isAiReplyConfigRunnable(config)) {
    throw new AiReplyTaskCancelledError("AI 配置当前不可用，任务已取消")
  }

  const agentConfig = findRunnableAgentConfig(config, task.agentUserId)
  if (!agentConfig) {
    throw new AiReplyTaskCancelledError("AI 代理账号配置已变更或已停用，任务已取消")
  }

  if (task.agentUser.status !== "ACTIVE") {
    throw new AiReplyTaskCancelledError("AI 代理账号当前不可用，任务已取消")
  }

  if (!task.post || task.post.status !== "NORMAL") {
    throw new AiReplyTaskCancelledError("源帖子已不存在或不可见，任务已取消")
  }

  if (task.sourceType === AiReplyTaskSourceType.POST) {
    if (task.post.authorId === task.agentUserId) {
      throw new AiReplyTaskCancelledError("AI 自己发布的帖子不会再次触发 AI 回复")
    }

    const triggerReason = readAiReplyTriggerReason(task.sourceKey)
    if (triggerReason === "mention" && !agentConfig.respondToPostMentions) {
      throw new AiReplyTaskCancelledError("当前未启用帖子提及回复")
    }

    if (triggerReason === "mention" && !doesPostStillMentionAgent(task.post, task.agentUser)) {
      throw new AiReplyTaskCancelledError("帖子中已不存在对 AI 账号的提及，任务已取消")
    }

    return
  }

  if (!task.sourceComment || task.sourceComment.status !== "NORMAL") {
    throw new AiReplyTaskCancelledError("源评论已不存在或不可见，任务已取消")
  }

  if (task.sourceComment.userId === task.agentUserId) {
    throw new AiReplyTaskCancelledError("AI 自己的评论不会再次触发 AI 回复")
  }

  const triggerReason = readAiReplyTriggerReason(task.sourceKey)
  if (triggerReason === "mention" && !agentConfig.respondToCommentMentions) {
    throw new AiReplyTaskCancelledError("当前未启用评论提及回复")
  }

  if (task.sourceComment.postId !== task.postId) {
    throw new AiReplyTaskCancelledError("源评论与帖子不匹配，任务已取消")
  }

  if (triggerReason === "mention" && !doesCommentStillMentionAgent(task.sourceComment.content, task.agentUser)) {
    throw new AiReplyTaskCancelledError("评论中已不存在对 AI 账号的提及，任务已取消")
  }
}

async function buildAiReplyContent(task: NonNullable<AiReplyTaskWorkerRecord>) {
  const config = await getServerAiReplyConfig()
  assertTaskStillRunnable(task, config)
  const agentConfig = findRunnableAgentConfig(config, task.agentUserId)
  if (!agentConfig) {
    throw new AiReplyTaskCancelledError("AI 代理账号配置已变更或已停用，任务已取消")
  }

  const prompt = task.sourceType === AiReplyTaskSourceType.POST
    ? buildPostReplyUserPrompt(task)
    : buildCommentReplyUserPrompt(task)

  const rawReply = await callAiReplyModel({
    config,
    agentConfig,
    sourceType: task.sourceType,
    prompt,
    agentUser: task.agentUser,
  })
  const siteSettings = await getSiteSettings()
  const contentSafety = await enforceSensitiveText({
    scene: "comment.content",
    text: rawReply,
  })
  const fallback = "我看到了你的提及，但当前上下文还不够明确。你可以再补充一点关键信息，我再继续跟进。"
  const normalized = truncateText(
    contentSafety.sanitizedText || fallback,
    Math.max(32, Math.min(1_500, siteSettings.commentContentMaxLength)),
  )

  if (!normalized.trim()) {
    return fallback
  }

  return normalized
}

async function dispatchAiReplyNotifications(params: {
  task: NonNullable<AiReplyTaskWorkerRecord>
  generatedCommentId: string
  content: string
}) {
  const preview = truncateText(params.content, AI_REPLY_NOTIFICATION_PREVIEW_CHARS)
  const notifications = [] as Array<Parameters<typeof createNotifications>[0]["notifications"][number]>
  const excludeUserIds = [] as number[]

  if (params.task.sourceType === AiReplyTaskSourceType.POST && params.task.post.authorId !== params.task.agentUserId) {
    notifications.push({
      userId: params.task.post.authorId,
      type: NotificationType.REPLY_POST,
      senderId: params.task.agentUserId,
      relatedType: "COMMENT",
      relatedId: params.generatedCommentId,
      title: "你的帖子有了新回复",
      content: `${buildDisplayName(params.task.agentUser)} 回复了你的帖子：${preview}`,
    })
    excludeUserIds.push(params.task.post.authorId)
  }

  if (
    params.task.sourceType === AiReplyTaskSourceType.COMMENT
    && params.task.sourceComment
    && params.task.sourceComment.userId !== params.task.agentUserId
  ) {
    notifications.push({
      userId: params.task.sourceComment.userId,
      type: NotificationType.REPLY_COMMENT,
      senderId: params.task.agentUserId,
      relatedType: "COMMENT",
      relatedId: params.generatedCommentId,
      title: "你的评论有了新回复",
      content: `${buildDisplayName(params.task.agentUser)} 回复了你的评论：${preview}`,
    })
    excludeUserIds.push(params.task.sourceComment.userId)
  }

  if (notifications.length > 0) {
    await createNotifications({
      notifications,
    })
  }

  void enqueuePostFollowCommentNotifications({
    commentId: params.generatedCommentId,
    excludeUserIds,
  }).catch((error) => {
    logError({
      scope: "ai-reply",
      action: "follow-notification-enqueue-failed",
      userId: params.task.agentUserId,
      targetId: params.task.id,
      metadata: {
        generatedCommentId: params.generatedCommentId,
        sourceType: params.task.sourceType,
      },
    }, error)
  })
}

async function processAiReplyTask(taskId: string) {
  const claimed = await claimAiReplyTask(taskId)
  if (!claimed) {
    return
  }

  const task = await loadAiReplyTaskForWorker(taskId)
  if (!task) {
    return
  }
  if (!task.startedAt) {
    return
  }

  try {
    const content = await buildAiReplyContent(task)
    const createdComment = task.sourceType === AiReplyTaskSourceType.POST
      ? await createAiReplyComment({
          postId: task.postId,
          agentUserId: task.agentUserId,
          content,
          taskId: task.id,
          taskStartedAt: task.startedAt,
        })
      : await createAiReplyComment({
          postId: task.postId,
          agentUserId: task.agentUserId,
          content,
          parentId: task.sourceComment?.parentId ?? task.sourceComment?.id,
          replyToUserId: task.sourceComment?.userId,
          replyToCommentId: task.sourceComment?.id,
          taskId: task.id,
          taskStartedAt: task.startedAt,
        })

    if (!createdComment) {
      // Another worker reclaimed this stale task and now owns completion.
      // Returning prevents this replay from producing a second reply.
      return
    }

    await requestInternalContentRevalidation({
      type: "approved-comment",
      postId: task.postId,
      postSlug: task.post.slug,
      boardSlug: task.post.board.slug,
      authorId: task.agentUserId,
    }).catch((error) => {
      logError({
        scope: "ai-reply",
        action: "revalidate-cache",
        userId: task.agentUserId,
        targetId: createdComment.id,
        metadata: {
          postId: task.postId,
          sourceType: task.sourceType,
        },
      }, error)
    })

    logInfo({
      scope: "ai-reply",
      action: "task-succeeded",
      userId: task.agentUserId,
      targetId: task.id,
      metadata: {
        generatedCommentId: createdComment.id,
        sourceType: task.sourceType,
      },
    })

    try {
      await dispatchAiReplyNotifications({
        task,
        generatedCommentId: createdComment.id,
        content: createdComment.content,
      })
    } catch (notificationError) {
      logError({
        scope: "ai-reply",
        action: "notification-failed",
        userId: task.agentUserId,
        targetId: task.id,
        metadata: {
          generatedCommentId: createdComment.id,
          sourceType: task.sourceType,
        },
      }, notificationError)
    }
  } catch (error) {
    if (error instanceof AiReplyTaskCancelledError) {
      await markAiReplyTaskCancelled(task.id, error.message)
      logInfo({
        scope: "ai-reply",
        action: "task-cancelled",
        userId: task.agentUserId,
        targetId: task.id,
        metadata: {
          sourceType: task.sourceType,
          reason: error.message,
        },
      })
      return
    }

    logError({
      scope: "ai-reply",
      action: "task-failed",
      userId: task.agentUserId,
      targetId: task.id,
      metadata: {
        sourceType: task.sourceType,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
      },
    }, error)

    const message = error instanceof Error ? error.message : String(error)
    // step 9: 日调用上限触发时不重试，直接落 FAILED（带 [RATE_LIMIT] 前缀方便过滤）
    if (error instanceof AiRateLimitError) {
      await markAiReplyTaskFailed(task.id, `[RATE_LIMIT] ${message}`)
      return
    }
    if (task.attemptCount < task.maxAttempts) {
      await requeueAiReplyTask(task.id, message, getAiReplyRetryDelayMs(task.attemptCount))
      return
    }

    await markAiReplyTaskFailed(task.id, message)
  }
}

async function upsertAiReplyTask(params: {
  sourceType: AiReplyTaskSourceType
  sourceKey: string
  postId: string
  sourceCommentId?: string
  triggerUserId: number
  agentUserId: number
  reason: AiReplyTriggerReason
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.aiReplyTask.findUnique({
      where: { sourceKey: params.sourceKey },
      select: {
        id: true,
        status: true,
      },
    })

    if (!existing) {
      const created = await tx.aiReplyTask.create({
        data: {
          sourceType: params.sourceType,
          sourceKey: params.sourceKey,
          postId: params.postId,
          sourceCommentId: params.sourceCommentId ?? null,
          triggerUserId: params.triggerUserId,
          agentUserId: params.agentUserId,
          status: AiReplyTaskStatus.PENDING,
        },
        select: {
          id: true,
        },
      })

      return {
        id: created.id,
        shouldEnqueue: true,
      }
    }

    if (
      existing.status === AiReplyTaskStatus.PENDING
      || existing.status === AiReplyTaskStatus.PROCESSING
      || existing.status === AiReplyTaskStatus.SUCCEEDED
    ) {
      return {
        id: existing.id,
        shouldEnqueue: false,
      }
    }

    await tx.aiReplyTask.update({
      where: { id: existing.id },
      data: {
        sourceType: params.sourceType,
        postId: params.postId,
        sourceCommentId: params.sourceCommentId ?? null,
        triggerUserId: params.triggerUserId,
        agentUserId: params.agentUserId,
        status: AiReplyTaskStatus.PENDING,
        scheduledAt: new Date(),
        startedAt: null,
        finishedAt: null,
        generatedCommentId: null,
        errorMessage: null,
        resultExcerpt: null,
        attemptCount: 0,
      },
    })

    return {
      id: existing.id,
      shouldEnqueue: true,
    }
  })
}

async function loadAiReplyTriggerSource(params: {
  sourceType: AiReplyTaskSourceType
  postId: string
  sourceCommentId?: string
}) {
  if (params.sourceType === AiReplyTaskSourceType.POST) {
    const post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: {
        id: true,
        title: true,
        content: true,
        appendedContent: true,
        status: true,
        authorId: true,
        board: {
          select: {
            slug: true,
          },
        },
      },
    })

    if (!post || post.status !== "NORMAL") {
      return null
    }

    return {
      authorId: post.authorId,
      boardSlug: post.board.slug,
      text: [
        post.title,
        getPostMentionTextForAi({
          content: post.content,
          appendedContent: post.appendedContent,
        }),
      ].filter(Boolean).join("\n\n"),
    }
  }

  const comment = params.sourceCommentId
    ? await prisma.comment.findUnique({
        where: { id: params.sourceCommentId },
        select: {
          id: true,
          content: true,
          status: true,
          userId: true,
          post: {
            select: {
              id: true,
              status: true,
              authorId: true,
              board: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      })
    : null

  if (!comment || comment.status !== "NORMAL" || comment.post.status !== "NORMAL" || comment.post.id !== params.postId) {
    return null
  }

  return {
    authorId: comment.userId,
    boardSlug: comment.post.board.slug,
    text: stripUserLinkTokens(comment.content),
  }
}

function resolveAiReplyTriggerReasonForAgent(params: {
  sourceType: AiReplyTaskSourceType
  mentionedUserIds: number[]
  source: { boardSlug: string; text: string }
  agent: AiReplyAgentConfigData
}): AiReplyTriggerReason | null {
  if (params.agent.agentUserId && params.mentionedUserIds.includes(params.agent.agentUserId)) {
    if (params.sourceType === AiReplyTaskSourceType.POST && params.agent.respondToPostMentions) {
      return "mention"
    }

    if (params.sourceType === AiReplyTaskSourceType.COMMENT && params.agent.respondToCommentMentions) {
      return "mention"
    }
  }

  if (params.sourceType === AiReplyTaskSourceType.POST) {
    if (params.agent.autoReplyToAllPosts) {
      return "all-posts"
    }

    if (params.agent.boardSlugs.includes(params.source.boardSlug.toLowerCase())) {
      return "board"
    }
  }

  if (textMatchesKeywordTriggers(params.source.text, params.agent.keywordTriggers)) {
    return "keyword"
  }

  return null
}

async function maybeEnqueueAiReplyTask(params: {
  sourceType: AiReplyTaskSourceType
  postId: string
  sourceCommentId?: string
  triggerUserId: number
  mentionedUserIds: number[]
}) {
  const config = await getServerAiReplyConfig()

  if (!isAiReplyConfigRunnable(config)) {
    return
  }

  const source = await loadAiReplyTriggerSource(params)
  if (!source) {
    return
  }

  const enqueuedTasks: Array<{ id: string; agentUserId: number; reason: AiReplyTriggerReason }> = []

  for (const agent of config.agents) {
    if (!agent.enabled || !agent.agentUserId) {
      continue
    }

    if (params.triggerUserId === agent.agentUserId || source.authorId === agent.agentUserId) {
      continue
    }

    const reason = resolveAiReplyTriggerReasonForAgent({
      sourceType: params.sourceType,
      mentionedUserIds: params.mentionedUserIds,
      source,
      agent,
    })
    if (!reason) {
      continue
    }

    const sourceKey = buildAiReplySourceKey({
      sourceType: params.sourceType,
      postId: params.postId,
      sourceCommentId: params.sourceCommentId,
      agentUserId: agent.agentUserId,
      reason,
    })

    const task = await upsertAiReplyTask({
      sourceType: params.sourceType,
      sourceKey,
      postId: params.postId,
      sourceCommentId: params.sourceCommentId,
      triggerUserId: params.triggerUserId,
      agentUserId: agent.agentUserId,
      reason,
    })

    if (!task.shouldEnqueue) {
      continue
    }

    await enqueueBackgroundJob(AI_REPLY_BACKGROUND_JOB_NAME, {
      taskId: task.id,
    })
    enqueuedTasks.push({ id: task.id, agentUserId: agent.agentUserId, reason })

    logInfo({
      scope: "ai-reply",
      action: "task-enqueued",
      userId: agent.agentUserId,
      targetId: task.id,
      metadata: {
        sourceType: params.sourceType,
        postId: params.postId,
        sourceCommentId: params.sourceCommentId ?? null,
        triggerReason: reason,
      },
    })
  }

  return enqueuedTasks
}

registerBackgroundJobHandler(AI_REPLY_BACKGROUND_JOB_NAME, async (payload) => {
  await processAiReplyTask(payload.taskId)
})

export async function enqueueAiReplyForPostMention(params: {
  postId: string
  triggerUserId: number
  mentionedUserIds: number[]
}) {
  return maybeEnqueueAiReplyTask({
    sourceType: AiReplyTaskSourceType.POST,
    postId: params.postId,
    triggerUserId: params.triggerUserId,
    mentionedUserIds: params.mentionedUserIds,
  })
}

export async function enqueueAiReplyForCommentMention(params: {
  postId: string
  sourceCommentId: string
  triggerUserId: number
  mentionedUserIds: number[]
}) {
  return maybeEnqueueAiReplyTask({
    sourceType: AiReplyTaskSourceType.COMMENT,
    postId: params.postId,
    sourceCommentId: params.sourceCommentId,
    triggerUserId: params.triggerUserId,
    mentionedUserIds: params.mentionedUserIds,
  })
}

export async function getAiReplyAdminData(): Promise<AiReplyAdminData> {
  await ensureCanManageApps()
  return getAiReplyAdminDataPage({ page: 1, autoCategorizePage: 1 })
}

export async function getAiReplyAdminDataPage(options?: {
  page?: number | null
  autoCategorizePage?: number | null
}): Promise<AiReplyAdminData> {
  await ensureCanManageApps()

  const [config, autoCategorizeConfig] = await Promise.all([
    getAiReplyConfig(),
    getAutoCategorizeConfig(),
  ])

  const agentUserIds = Array.from(new Set(config.agents.map((agent) => agent.agentUserId).filter((id): id is number => Boolean(id))))
  const [agentUsers, autoCategorizeDefaultBoard, pending, processing, succeeded, failed, cancelled, totalRecentTasks, autoPending, autoProcessing, autoSucceeded, autoFailed, autoCancelled, autoTotalRecentTasks] = await Promise.all([
    agentUserIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: agentUserIds } },
          select: {
            id: true,
            username: true,
            nickname: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    autoCategorizeConfig.defaultBoardSlug
      ? prisma.board.findUnique({
          where: { slug: autoCategorizeConfig.defaultBoardSlug },
          select: {
            slug: true,
            name: true,
          },
        })
      : Promise.resolve(null),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.PENDING } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.PROCESSING } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.SUCCEEDED } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.FAILED } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.CANCELLED } }),
    prisma.aiReplyTask.count(),
    prisma.autoCategorizeTask.count({ where: { status: AiReplyTaskStatus.PENDING } }),
    prisma.autoCategorizeTask.count({ where: { status: AiReplyTaskStatus.PROCESSING } }),
    prisma.autoCategorizeTask.count({ where: { status: AiReplyTaskStatus.SUCCEEDED } }),
    prisma.autoCategorizeTask.count({ where: { status: AiReplyTaskStatus.FAILED } }),
    prisma.autoCategorizeTask.count({ where: { status: AiReplyTaskStatus.CANCELLED } }),
    prisma.autoCategorizeTask.count(),
  ])
  const agentUserMap = new Map(agentUsers.map((user) => [user.id, user]))
  const agentUser = config.agentUserId ? agentUserMap.get(config.agentUserId) ?? null : null
  const orderedAgentUsers = agentUserIds
    .map((id) => agentUserMap.get(id))
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
  const pageSize = AI_REPLY_ADMIN_TASKS_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(totalRecentTasks / pageSize))
  const page = Math.min(normalizeAiReplyAdminTasksPage(options?.page), totalPages)
  const autoCategorizePageSize = AUTO_CATEGORIZE_ADMIN_TASKS_PAGE_SIZE
  const autoCategorizeTotalPages = Math.max(1, Math.ceil(autoTotalRecentTasks / autoCategorizePageSize))
  const autoCategorizePage = Math.min(normalizeAiReplyAdminTasksPage(options?.autoCategorizePage), autoCategorizeTotalPages)
  const effectiveSkip = (page - 1) * pageSize
  const autoCategorizeEffectiveSkip = (autoCategorizePage - 1) * autoCategorizePageSize
  const [pagedRecentTasks, autoRecentTasks] = await Promise.all([
    prisma.aiReplyTask.findMany({
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: effectiveSkip,
      take: pageSize,
      select: {
        id: true,
        sourceType: true,
        status: true,
        postId: true,
        sourceCommentId: true,
        generatedCommentId: true,
        attemptCount: true,
        maxAttempts: true,
        errorMessage: true,
        resultExcerpt: true,
        createdAt: true,
        updatedAt: true,
        finishedAt: true,
        post: {
          select: {
            title: true,
            slug: true,
          },
        },
        sourceComment: {
          select: {
            content: true,
          },
        },
        triggerUser: {
          select: {
            username: true,
            nickname: true,
          },
        },
        agentUser: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    }),
    prisma.autoCategorizeTask.findMany({
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: autoCategorizeEffectiveSkip,
      take: autoCategorizePageSize,
      select: autoCategorizeRecentTaskSelect,
    }),
  ])
  const autoRecentTaskTagIds = Array.from(new Set(autoRecentTasks.flatMap((task) => task.resultTagIds)))
  const autoRecentTaskTags = autoRecentTaskTagIds.length > 0
    ? await prisma.tag.findMany({
      where: { id: { in: autoRecentTaskTagIds } },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    })
    : []
  const autoRecentTaskTagMap = new Map(autoRecentTaskTags.map((tag) => [tag.id, tag]))

  return {
    config,
    autoCategorizeConfig,
    autoCategorizeDefaultBoard,
    agentUser,
    agentUsers: orderedAgentUsers,
    summary: {
      pending,
      processing,
      succeeded,
      failed,
      cancelled,
    },
    autoCategorizeSummary: {
      pending: autoPending,
      processing: autoProcessing,
      succeeded: autoSucceeded,
      failed: autoFailed,
      cancelled: autoCancelled,
    },
    recentTasksPagination: {
      page,
      pageSize,
      total: totalRecentTasks,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    autoCategorizeRecentTasksPagination: {
      page: autoCategorizePage,
      pageSize: autoCategorizePageSize,
      total: autoTotalRecentTasks,
      totalPages: autoCategorizeTotalPages,
      hasPrevPage: autoCategorizePage > 1,
      hasNextPage: autoCategorizePage < autoCategorizeTotalPages,
    },
    recentTasks: pagedRecentTasks.map((task) => ({
      id: task.id,
      sourceType: task.sourceType,
      status: task.status,
      postId: task.postId,
      postTitle: task.post.title,
      postSlug: task.post.slug,
      sourceCommentId: task.sourceCommentId,
      sourceCommentExcerpt: task.sourceComment ? truncateText(stripUserLinkTokens(task.sourceComment.content), AI_REPLY_NOTIFICATION_PREVIEW_CHARS) : null,
      generatedCommentId: task.generatedCommentId,
      triggerUserDisplayName: buildDisplayName(task.triggerUser),
      agentDisplayName: buildDisplayName(task.agentUser),
      attemptCount: task.attemptCount,
      maxAttempts: task.maxAttempts,
      errorMessage: task.errorMessage,
      resultExcerpt: task.resultExcerpt,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    })),
    autoCategorizeRecentTasks: autoRecentTasks.map((task) => ({
      id: task.id,
      sourceType: task.sourceType,
      status: task.status,
      postId: task.postId,
      postTitle: task.post?.title ?? null,
      previewTitle: task.title,
      requesterDisplayName: buildDisplayName(task.requesterUser),
      attemptCount: task.attemptCount,
      maxAttempts: task.maxAttempts,
      errorMessage: task.errorMessage,
      resultStatus: task.resultStatus,
      resultBoard: task.resultBoard
        ? {
            slug: task.resultBoard.slug,
            name: task.resultBoard.name,
          }
        : null,
      resultTags: task.resultTagIds
        .length > 0 && parseAutoCategorizeTagsJson(task.resultTagsJson).length === 0
        ? task.resultTagIds
          .map((id) => autoRecentTaskTagMap.get(id))
          .filter((tag): tag is { id: string; slug: string; name: string } => Boolean(tag))
          .map((tag) => ({
            slug: tag.slug,
            name: tag.name,
          }))
        : parseAutoCategorizeTagsJson(task.resultTagsJson),
      resultReasoning: task.resultReasoning,
      resultRawPreview: task.resultRawPreview,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    })),
  }
}

export async function deleteAiReplyTaskLog(taskId: string) {
  await ensureCanManageApps()

  const task = await prisma.aiReplyTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!task) {
    apiError(404, "任务日志不存在")
  }

  if (!canDeleteAiReplyTaskLog(task.status)) {
    apiError(400, "执行中的任务不能删除，请等待任务结束后再删除日志")
  }

  await prisma.aiReplyTask.delete({
    where: { id: taskId },
  })
}

export async function deleteAllAiReplyTaskLogs() {
  await ensureCanManageApps()

  const result = await prisma.aiReplyTask.deleteMany({
    where: {
      status: {
        in: [...AI_REPLY_DELETABLE_TASK_STATUSES],
      },
    },
  })

  return result.count
}
