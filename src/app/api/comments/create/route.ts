import { NotificationType } from "@/db/types"
import { enqueueAiReplyForCommentMention } from "@/lib/ai-reply"
import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { createCommentFlow } from "@/lib/comment-create-service"
import { enqueuePostFollowCommentNotifications } from "@/lib/follow-notifications"
import { handleCommentCreateSideEffects } from "@/lib/interaction-side-effects"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { enqueueEvaluateUserLevelProgress } from "@/lib/level-system"
import { enqueueNotifications } from "@/lib/notification-writes"
import { logRequestSucceeded } from "@/lib/request-log"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const requestUrl = new URL(request.url)

  await executeAddonActionHook("comment.create.before", {
    authorId: currentUser.id,
    authorUsername: currentUser.username,
    body,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })
  const result = await createCommentFlow({
    body,
    currentUser: {
      id: currentUser.id,
      username: currentUser.username,
      nickname: currentUser.nickname,
    },
  })

  void enqueueEvaluateUserLevelProgress(currentUser.id, { notifyOnUpgrade: true })

  await handleCommentCreateSideEffects({
    postId: result.postId,
    userId: currentUser.id,
    commentId: result.created.id,
  })

  logRequestSucceeded({
    scope: "comments-create",
    action: "create-comment",
    userId: currentUser.id,
    targetId: result.created.id,
  }, {
    postId: result.postId,
    page: result.targetPage,
    reviewRequired: result.reviewRequired,
  })

  revalidateUserSurfaceCache(currentUser.id)
  if (!result.reviewRequired) {
    revalidateHomeSidebarStatsCache()
  }

  if (!result.reviewRequired) {
    const notifications = [] as Array<{
      userId: number
      type: NotificationType
      senderId: number
      relatedType: "POST" | "COMMENT"
      relatedId: string
      title: string
      content: string
    }>

    if (result.isRootComment && result.postAuthorId !== currentUser.id) {
      notifications.push({
        userId: result.postAuthorId,
        type: NotificationType.REPLY_POST,
        senderId: currentUser.id,
        relatedType: "COMMENT",
        relatedId: result.created.id,
        title: "你的帖子有了新回复",
        content: `${result.senderName} 回复了你的帖子：${result.created.content.slice(0, 80)}`,
      })
    }

    if (result.normalizedReplyToUserId && result.normalizedReplyToUserId !== currentUser.id) {
      notifications.push({
        userId: result.normalizedReplyToUserId,
        type: NotificationType.REPLY_COMMENT,
        senderId: currentUser.id,
        relatedType: "COMMENT",
        relatedId: result.created.id,
        title: "你的评论有了新回复",
        content: `${result.senderName} 回复了你的评论：${result.created.content.slice(0, 80)}`,
      })
    }

    const mentionTargets = [...new Set(result.mentionUserIds)].filter((userId) => userId !== currentUser.id && userId !== result.normalizedReplyToUserId)
    notifications.push(
      ...mentionTargets.map((userId) => ({
        userId,
        type: NotificationType.MENTION,
        senderId: currentUser.id,
        relatedType: "COMMENT" as const,
        relatedId: result.created.id,
        title: "你被提及了",
        content: `${result.senderName} 在评论中提到了你：${result.created.content.slice(0, 80)}`,
      })),
    )

    if (notifications.length > 0) {
      void enqueueNotifications(notifications)
    }

    void enqueuePostFollowCommentNotifications({
      commentId: result.created.id,
      excludeUserIds: [
        ...(result.isRootComment ? [result.postAuthorId] : []),
        ...(typeof result.normalizedReplyToUserId === "number" ? [result.normalizedReplyToUserId] : []),
        ...result.mentionUserIds,
      ],
    })

    void enqueueAiReplyForCommentMention({
      postId: result.postId,
      sourceCommentId: result.created.id,
      triggerUserId: currentUser.id,
      mentionedUserIds: result.mentionUserIds,
    })
  }

  await executeAddonActionHook("comment.create.after", {
    commentId: result.created.id,
    postId: result.postId,
    authorId: currentUser.id,
    status: result.created.status,
    parentId: result.created.parentId ?? null,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })

  return apiSuccess({
    id: result.created.id,
    navigation: {
      page: result.targetPage,
      sort: "oldest",
      view: result.commentView,
      anchor: `comment-${result.created.id}`,
    },
  }, result.reviewRequired
    ? "当前节点开启回帖审核，回复已进入审核"
    : `${result.normalizedReplyToUserName ? `已回复 @${result.normalizedReplyToUserName}` : "回复成功"}${result.contentAdjusted ? "，部分内容已自动替换" : ""}`)
}, {
  errorMessage: "评论失败",
  logPrefix: "[api/comments/create] unexpected error",
  unauthorizedMessage: "请先登录后再评论",
  allowStatuses: ["ACTIVE"],
  forbiddenMessages: {
    MUTED: "账号已被禁言，暂不可回复",
    BANNED: "账号已被拉黑，无法回复",
  },
})
