import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { enqueueAiReplyForPostMention } from "@/lib/ai-reply"
import { enqueueNewPostFollowNotifications } from "@/lib/follow-notifications"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { enqueueEvaluateUserLevelProgress } from "@/lib/level-system"
import { createPostFlow } from "@/lib/post-create-service"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export const POST = createUserRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const result = await createPostFlow(body)

  logRouteWriteSuccess({
    scope: "posts-create",
    action: "create-post",
  }, {
    userId: result.author.id,
    targetId: result.post.id,
    extra: {
      slug: result.post.slug,
      status: result.post.status,
      reviewRequired: result.shouldPending,
      contentAdjusted: result.contentAdjusted,
    },
  })

  revalidateUserSurfaceCache(result.author.id)
  if (!result.shouldPending) {
    revalidateHomeSidebarStatsCache()
    expireTaxonomyCacheImmediately()
  }

  void enqueueEvaluateUserLevelProgress(result.author.id, { notifyOnUpgrade: true })

  if (!result.shouldPending) {
    void enqueueNewPostFollowNotifications(result.post.id)
    void enqueueAiReplyForPostMention({
      postId: result.post.id,
      triggerUserId: result.author.id,
      mentionedUserIds: result.mentionUserIds,
    })
  }

  return apiSuccess({
    id: result.post.id,
    slug: result.post.slug,
    status: result.post.status,
  }, result.shouldPending ? "当前节点开启发帖审核，已提交审核" : result.contentAdjusted ? "发布成功，部分内容已自动替换" : "发布成功")
}, {
  errorMessage: "创建帖子失败",
  logPrefix: "[api/posts/create] unexpected error",
  unauthorizedMessage: "请先登录后再发帖",
  allowStatuses: ["ACTIVE"],
  forbiddenMessages: {
    MUTED: "账号已被禁言，暂不可发帖",
    BANNED: "账号已被拉黑，无法发帖",
  },
})
