import {
  apiError,
  apiSuccess,
  createUserRouteHandler,
  readJsonBody,
  requireSearchParam,
  type JsonObject,
} from "@/lib/api-route"
import {
  enqueueAutoCategorizePreviewTask,
  getAutoCategorizeTaskResultForUser,
} from "@/lib/ai/capabilities/auto-categorize"
import { getAutoCategorizeConfig } from "@/lib/ai/capabilities/auto-categorize-config"
import { createPublicWriteDedupeKey, withPublicWriteGuard } from "@/lib/public-write-guard"

interface AiCategorizeRouteResponse {
  taskId?: string
  status:
    | "queued"
    | "processing"
    | "empty_input"
    | "disabled"
    | "provider_not_configured"
    | "no_requested_capabilities"
    | "no_candidate_boards"
    | "invalid_json"
    | "empty_suggestion"
    | "ok"
  board: {
    slug: string
    name: string
  } | null
  tags: Array<{
    slug: string
    name: string
  }>
  reasoning: string | null
  rawPreview?: string
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false
    }
  }

  return fallback
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

async function loadTaskResultOrThrow(taskId: string, requesterUserId: number) {
  const result = await getAutoCategorizeTaskResultForUser({ taskId, requesterUserId })
  if (!result) {
    apiError(404, "发帖辅助任务不存在")
  }

  return result
}

export const GET = createUserRouteHandler<AiCategorizeRouteResponse>(async ({ currentUser, request }) => {
  const taskId = requireSearchParam(request, "taskId", "缺少发帖辅助任务 ID")

  return apiSuccess(await loadTaskResultOrThrow(taskId, currentUser.id))

}, {
  errorMessage: "读取 AI 发帖辅助任务失败",
  logPrefix: "[api/posts/ai-categorize:GET] unexpected error",
  unauthorizedMessage: "请先登录后再使用 AI 发帖辅助",
})

export const POST = createUserRouteHandler<AiCategorizeRouteResponse>(async ({ currentUser, request }) => {
  const body = await readJsonBody(request) as JsonObject
  const title = normalizeText(body.title, 200)
  const content = normalizeText(body.content, 4000)
  const needBoard = normalizeBoolean(body.needBoard, true)
  const needTags = normalizeBoolean(body.needTags, true)
  const autoConfig = await getAutoCategorizeConfig()
  const allowBoardSuggestion = needBoard && autoConfig.writeBoardAutoSelectEnabled
  const allowTagSuggestion = needTags && autoConfig.writeTagAutoExtractEnabled

  if (!title && !content) {
    return apiSuccess({
      status: "empty_input" as const,
      board: null,
      tags: [],
      reasoning: null,
    })
  }

  if (!allowBoardSuggestion && !allowTagSuggestion) {
    return apiSuccess({
      status: "disabled" as const,
      board: null,
      tags: [],
      reasoning: null,
    })
  }

  const dedupeKey = createPublicWriteDedupeKey(
    title,
    content,
    allowBoardSuggestion,
    allowTagSuggestion,
  )

  return withPublicWriteGuard("posts-ai-categorize", {
    request,
    userId: currentUser.id,
    dedupeKey,
  }, async () => {
    const taskId = await enqueueAutoCategorizePreviewTask({
      requesterUserId: currentUser.id,
      title,
      content,
      allowBoardSuggestion,
      allowTagSuggestion,
    })

    return apiSuccess(await loadTaskResultOrThrow(taskId, currentUser.id))

  })
}, {
  errorMessage: "AI 建议生成失败",
  logPrefix: "[api/posts/ai-categorize:POST] unexpected error",
  unauthorizedMessage: "请先登录后再使用 AI 发帖辅助",
})
