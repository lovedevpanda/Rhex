import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { triggerAiMention } from "@/lib/ai/mention-trigger"
import { revalidatePostDetailCache } from "@/lib/post-detail-cache"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { updatePostFlow } from "@/lib/post-update-service"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = typeof body?.postId === "string" ? body.postId : ""
  const result = await updatePostFlow({
    postId,
    body,
    request,
    currentUser: {
      id: currentUser.id,
      role: currentUser.role,
      level: currentUser.level,
      vipLevel: currentUser.vipLevel,
      vipExpiresAt: currentUser.vipExpiresAt,
    },
  })

  revalidatePostDetailCache({ postId: result.post.id, slug: result.post.slug })

  logRouteWriteSuccess({
    scope: "posts-update",
    action: result.mode === "append" ? "append-post" : "update-post",
  }, {
    userId: currentUser.id,
    targetId: result.post.id,
    extra: {
      slug: result.post.slug,
      mode: result.mode,
      contentAdjusted: result.contentAdjusted,
    },
  })

  void triggerAiMention({
    kind: "post",
    postId: result.post.id,
    triggerUserId: currentUser.id,
    mentionedUserIds: result.mentionUserIds,
  })

  return apiSuccess({
    id: result.post.id,
    slug: result.post.slug,
  }, result.mode === "append"
    ? `已追加补充内容${result.contentAdjusted ? "，部分内容已自动替换" : ""}`
    : `帖子已更新${result.contentAdjusted ? "，部分内容已自动替换" : ""}`)
}, {
  errorMessage: "修改帖子失败",
  logPrefix: "[api/posts/update] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
