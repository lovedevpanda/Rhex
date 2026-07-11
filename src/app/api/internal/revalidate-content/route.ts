import { timingSafeEqual } from "node:crypto"

import { apiError, apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import {
  revalidateApprovedCommentMutation,
  revalidateApprovedPostMutation,
  revalidateCheckInMutation,
} from "@/lib/content-mutation-revalidation"

type InternalRevalidationBody =
  | { type: "check-in"; userId: number }
  | { type: "approved-post"; postId: string; postSlug: string; boardSlug?: string | null; authorId: number }
  | { type: "approved-comment"; postId: string; postSlug?: string | null; boardSlug?: string | null; authorId: number }

function getInternalSecret() {
  return process.env.INTERNAL_REVALIDATION_SECRET?.trim() ?? ""
}

function requireInternalSecret(request: Request) {
  const expected = getInternalSecret()
  const received = request.headers.get("x-internal-revalidation-secret")?.trim() ?? ""

  if (!expected) {
    // Do not reuse the user-session signing key as an internal API credential.
    // A deployment that has not configured a dedicated secret must fail closed.
    apiError(403, "无权操作")
  }

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (
    expectedBuffer.length !== receivedBuffer.length
    || !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    apiError(403, "无权操作")
  }
}

function asSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeBody(body: Record<string, unknown>): InternalRevalidationBody {
  if (body.type === "check-in") {
    const userId = asSafeNumber(body.userId)
    if (!userId) apiError(400, "缺少用户 ID")
    return { type: "check-in", userId }
  }

  if (body.type === "approved-post") {
    const postId = asString(body.postId)
    const postSlug = asString(body.postSlug)
    const authorId = asSafeNumber(body.authorId)
    if (!postId || !postSlug || !authorId) apiError(400, "缺少帖子刷新参数")
    return {
      type: "approved-post",
      postId,
      postSlug,
      authorId,
      boardSlug: asString(body.boardSlug),
    }
  }

  if (body.type === "approved-comment") {
    const postId = asString(body.postId)
    const authorId = asSafeNumber(body.authorId)
    if (!postId || !authorId) apiError(400, "缺少评论刷新参数")
    return {
      type: "approved-comment",
      postId,
      authorId,
      postSlug: asString(body.postSlug),
      boardSlug: asString(body.boardSlug),
    }
  }

  apiError(400, "不支持的刷新类型")
}

export const POST = createRouteHandler(async ({ request }) => {
  requireInternalSecret(request)
  const body = normalizeBody(await readJsonBody(request))

  if (body.type === "check-in") {
    revalidateCheckInMutation(body)
  } else if (body.type === "approved-post") {
    revalidateApprovedPostMutation(body)
  } else {
    revalidateApprovedCommentMutation(body)
  }

  return apiSuccess({ type: body.type }, "ok")
}, {
  errorMessage: "刷新缓存失败",
  logPrefix: "[api/internal/revalidate-content] unexpected error",
})
