import { AiReplyTaskSourceType, AiReplyTaskStatus, NotificationType } from "@/db/types"
import { prisma } from "@/db/client"

import { apiError } from "@/lib/api-route"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { enforceSensitiveText } from "@/lib/content-safety"
import { enqueuePostFollowCommentNotifications } from "@/lib/follow-notifications"
import { getAllPostContentText } from "@/lib/post-content"
import { stripPostContentUserLinks } from "@/lib/post-mentions"
import { extractMentionTexts, stripUserLinkTokens } from "@/lib/mentions"
import { logError, logInfo } from "@/lib/logger"
import { createNotifications } from "@/lib/notification-writes"
import { getSiteSettings } from "@/lib/site-settings"
import { getAiReplyConfig, getServerAiReplyConfig, isAiReplyConfigRunnable, type AiReplyConfigData } from "@/lib/ai-reply-config"

const AI_REPLY_BACKGROUND_JOB_NAME = "ai-reply.process"
const AI_REPLY_MAX_CONTEXT_CHARS = 4_000
const AI_REPLY_RESULT_EXCERPT_CHARS = 240
const AI_REPLY_NOTIFICATION_PREVIEW_CHARS = 80
const AI_REPLY_RETRY_BASE_DELAY_MS = 30_000
const AI_REPLY_RETRY_MAX_DELAY_MS = 10 * 60 * 1_000
const DEFAULT_AI_REPLY_PROCESSING_STALE_MS = 30 * 60 * 1_000
const AI_REPLY_ADMIN_TASKS_PAGE_SIZE = 10
const AI_REPLY_DELETABLE_TASK_STATUSES = [
  AiReplyTaskStatus.SUCCEEDED,
  AiReplyTaskStatus.FAILED,
  AiReplyTaskStatus.CANCELLED,
] as const

type AiReplyTaskWorkerRecord = Awaited<ReturnType<typeof loadAiReplyTaskForWorker>>

export interface AiReplyAdminData {
  config: AiReplyConfigData
  agentUser: {
    id: number
    username: string
    nickname: string | null
    status: string
  } | null
  summary: {
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

function getPostVisibleText(post: {
  content: string
  appendedContent: string | null
}) {
  const mainContent = getAllPostContentText(stripPostContentUserLinks(post.content))
  const appendedContent = post.appendedContent ? stripUserLinkTokens(post.appendedContent) : ""
  return [mainContent, appendedContent].filter(Boolean).join("\n\n")
}

function getPostMainText(content: string) {
  return getAllPostContentText(stripPostContentUserLinks(content))
}

function doesPostStillMentionAgent(post: { content: string; appendedContent: string | null }, agentUser: { username: string; nickname: string | null }) {
  if (containsUserLinkToken(post.content, agentUser.username)) {
    return true
  }

  if (post.appendedContent && containsUserLinkToken(post.appendedContent, agentUser.username)) {
    return true
  }

  return doesPlainTextMentionUser(getPostVisibleText(post), agentUser)
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

function extractCompletionText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ""
  }

  const choices = Array.isArray((payload as { choices?: unknown }).choices)
    ? (payload as { choices: unknown[] }).choices
    : []
  const firstChoice = choices[0]

  if (!firstChoice || typeof firstChoice !== "object") {
    return ""
  }

  const delta = "delta" in firstChoice && firstChoice.delta && typeof firstChoice.delta === "object"
    ? firstChoice.delta as { content?: unknown }
    : null
  const deltaContent = delta?.content

  if (typeof deltaContent === "string") {
    return deltaContent
  }

  const message = "message" in firstChoice && firstChoice.message && typeof firstChoice.message === "object"
    ? firstChoice.message as { content?: unknown }
    : null
  const content = message?.content

  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item
        }

        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text
        }

        return ""
      })
      .join("")
      .trim()
  }

  return ""
}

function extractCompletionTextFromSse(rawText: string) {
  if (!rawText.includes("data:")) {
    return ""
  }

  const parts: string[] = []

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith("data:")) {
      continue
    }

    const data = line.slice(5).trim()
    if (!data || data === "[DONE]") {
      continue
    }

    try {
      const parsed = JSON.parse(data) as unknown
      const text = extractCompletionText(parsed)
      if (text) {
        parts.push(text)
      }
    } catch {
      continue
    }
  }

  return parts.join("").trim()
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

  return [
    "论坛帖子上下文：",
    `节点：${task.post.board.name}`,
    `发帖人：${postAuthorName}`,
    `发帖用户：${buildDisplayName(task.triggerUser)}`,
    `帖子标题：${task.post.title}`,
    `帖子正文：\n${postVisibleText || "（无正文）"}`,
    task.post.appendedContent
      ? `帖子补充：\n${truncateText(stripUserLinkTokens(task.post.appendedContent), AI_REPLY_MAX_CONTEXT_CHARS)}`
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
  sourceType: AiReplyTaskSourceType
  prompt: string
  agentUser: {
    username: string
    nickname: string | null
  }
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.config.timeoutMs)

  const systemPrompt = [
    params.config.systemPrompt.trim(),
    `你当前扮演的论坛账号是 @${params.agentUser.username}${params.agentUser.nickname ? `（${params.agentUser.nickname}）` : ""}。`,
    params.sourceType === AiReplyTaskSourceType.POST
      ? params.config.postReplyPrompt.trim()
      : params.config.commentReplyPrompt.trim(),
  ].filter(Boolean).join("\n\n")

  try {
    const response = await fetch(`${params.config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.config.apiKey}`,
      },
      body: JSON.stringify({
        model: params.config.model,
        stream: false,
        temperature: params.config.temperature,
        max_tokens: params.config.maxOutputTokens,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: params.prompt,
          },
        ],
      }),
      signal: controller.signal,
    })

    const rawText = await response.text()
    let parsed: unknown = null

    try {
      parsed = rawText ? JSON.parse(rawText) : null
    } catch {
      parsed = null
    }

    if (!response.ok) {
      const message = parsed && typeof parsed === "object" && "error" in parsed
        ? JSON.stringify(parsed)
        : rawText

      throw new Error(`AI provider responded with ${response.status}: ${truncateText(message, 600)}`)
    }

    const content = normalizeAiReplyOutput(
      extractCompletionText(parsed) || extractCompletionTextFromSse(rawText),
    )
    if (!content) {
      const contentType = response.headers.get("content-type") ?? ""
      throw new Error(`AI provider returned empty content${contentType ? ` (${contentType})` : ""}`)
    }

    return content
  } finally {
    clearTimeout(timeout)
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
}) {
  return prisma.$transaction(async (tx) => {
    const createdAt = new Date()

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

    return comment
  })
}

async function loadAiReplyTaskForWorker(taskId: string) {
  return prisma.aiReplyTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      sourceType: true,
      status: true,
      postId: true,
      sourceCommentId: true,
      generatedCommentId: true,
      triggerUserId: true,
      agentUserId: true,
      attemptCount: true,
      maxAttempts: true,
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

async function markAiReplyTaskSucceeded(taskId: string, generatedCommentId: string, resultExcerpt: string) {
  await prisma.aiReplyTask.update({
    where: { id: taskId },
    data: {
      status: AiReplyTaskStatus.SUCCEEDED,
      generatedCommentId,
      resultExcerpt: truncateText(resultExcerpt, AI_REPLY_RESULT_EXCERPT_CHARS),
      errorMessage: null,
      finishedAt: new Date(),
    },
  })
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

  if (config.agentUserId !== task.agentUserId) {
    throw new AiReplyTaskCancelledError("AI 代理账号配置已变更，任务已取消")
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

    if (!config.respondToPostMentions) {
      throw new AiReplyTaskCancelledError("当前未启用帖子提及回复")
    }

    if (!doesPostStillMentionAgent(task.post, task.agentUser)) {
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

  if (!config.respondToCommentMentions) {
    throw new AiReplyTaskCancelledError("当前未启用评论提及回复")
  }

  if (task.sourceComment.postId !== task.postId) {
    throw new AiReplyTaskCancelledError("源评论与帖子不匹配，任务已取消")
  }

  if (!doesCommentStillMentionAgent(task.sourceComment.content, task.agentUser)) {
    throw new AiReplyTaskCancelledError("评论中已不存在对 AI 账号的提及，任务已取消")
  }
}

async function buildAiReplyContent(task: NonNullable<AiReplyTaskWorkerRecord>) {
  const config = await getServerAiReplyConfig()
  assertTaskStillRunnable(task, config)

  const prompt = task.sourceType === AiReplyTaskSourceType.POST
    ? buildPostReplyUserPrompt(task)
    : buildCommentReplyUserPrompt(task)

  const rawReply = await callAiReplyModel({
    config,
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

  try {
    const content = await buildAiReplyContent(task)
    const createdComment = task.sourceType === AiReplyTaskSourceType.POST
      ? await createAiReplyComment({
          postId: task.postId,
          agentUserId: task.agentUserId,
          content,
        })
      : await createAiReplyComment({
          postId: task.postId,
          agentUserId: task.agentUserId,
          content,
          parentId: task.sourceComment?.parentId ?? task.sourceComment?.id,
          replyToUserId: task.sourceComment?.userId,
          replyToCommentId: task.sourceComment?.id,
        })

    await markAiReplyTaskSucceeded(task.id, createdComment.id, createdComment.content)

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

async function maybeEnqueueAiReplyTask(params: {
  sourceType: AiReplyTaskSourceType
  postId: string
  sourceCommentId?: string
  triggerUserId: number
  mentionedUserIds: number[]
}) {
  const config = await getServerAiReplyConfig()

  if (!isAiReplyConfigRunnable(config) || !config.agentUserId) {
    return
  }

  if (params.triggerUserId === config.agentUserId) {
    return
  }

  if (!params.mentionedUserIds.includes(config.agentUserId)) {
    return
  }

  if (params.sourceType === AiReplyTaskSourceType.POST && !config.respondToPostMentions) {
    return
  }

  if (params.sourceType === AiReplyTaskSourceType.COMMENT && !config.respondToCommentMentions) {
    return
  }

  const sourceKey = params.sourceType === AiReplyTaskSourceType.POST
    ? buildPostSourceKey(params.postId, config.agentUserId)
    : buildCommentSourceKey(params.sourceCommentId ?? "", config.agentUserId)

  const task = await upsertAiReplyTask({
    sourceType: params.sourceType,
    sourceKey,
    postId: params.postId,
    sourceCommentId: params.sourceCommentId,
    triggerUserId: params.triggerUserId,
    agentUserId: config.agentUserId,
  })

  if (!task.shouldEnqueue) {
    return
  }

  await enqueueBackgroundJob(AI_REPLY_BACKGROUND_JOB_NAME, {
    taskId: task.id,
  })

  logInfo({
    scope: "ai-reply",
    action: "task-enqueued",
    userId: config.agentUserId,
    targetId: task.id,
    metadata: {
      sourceType: params.sourceType,
      postId: params.postId,
      sourceCommentId: params.sourceCommentId ?? null,
    },
  })
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
  return getAiReplyAdminDataPage({ page: 1 })
}

export async function getAiReplyAdminDataPage(options?: {
  page?: number | null
}): Promise<AiReplyAdminData> {
  const config = await getAiReplyConfig()

  const [agentUser, pending, processing, succeeded, failed, cancelled, totalRecentTasks] = await Promise.all([
    config.agentUserId
      ? prisma.user.findUnique({
          where: { id: config.agentUserId },
          select: {
            id: true,
            username: true,
            nickname: true,
            status: true,
          },
        })
      : Promise.resolve(null),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.PENDING } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.PROCESSING } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.SUCCEEDED } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.FAILED } }),
    prisma.aiReplyTask.count({ where: { status: AiReplyTaskStatus.CANCELLED } }),
    prisma.aiReplyTask.count(),
  ])
  const pageSize = AI_REPLY_ADMIN_TASKS_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(totalRecentTasks / pageSize))
  const page = Math.min(normalizeAiReplyAdminTasksPage(options?.page), totalPages)
  const recentTasks = await prisma.aiReplyTask.findMany({
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (page - 1) * pageSize,
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
    })

  return {
    config,
    agentUser,
    summary: {
      pending,
      processing,
      succeeded,
      failed,
      cancelled,
    },
    recentTasksPagination: {
      page,
      pageSize,
      total: totalRecentTasks,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    recentTasks: recentTasks.map((task) => ({
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
  }
}

export async function deleteAiReplyTaskLog(taskId: string) {
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
  const result = await prisma.aiReplyTask.deleteMany({
    where: {
      status: {
        in: [...AI_REPLY_DELETABLE_TASK_STATUSES],
      },
    },
  })

  return result.count
}
