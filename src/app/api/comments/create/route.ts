import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { createCommentFlow } from "@/lib/comment-create-service"
import { dispatchPostFollowCommentNotificationsBestEffort } from "@/lib/follow-notifications"
import { handleCommentCreateSideEffects } from "@/lib/interaction-side-effects"
import { evaluateUserLevelProgress } from "@/lib/level-system"
import { logRequestSucceeded } from "@/lib/request-log"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const result = await createCommentFlow({
    body,
    currentUser: {
      id: currentUser.id,
      username: currentUser.username,
      nickname: currentUser.nickname,
    },
  })

  await evaluateUserLevelProgress(currentUser.id)

  const { redPacketClaim } = await handleCommentCreateSideEffects({
    postId: result.postId,
    userId: currentUser.id,
    commentId: result.created.id,
  })

  if (!result.contentSafety.shouldReview) {
    await dispatchPostFollowCommentNotificationsBestEffort({
      commentId: result.created.id,
      excludeUserIds: [
        ...(result.isRootComment ? [result.postAuthorId] : []),
        ...(typeof result.normalizedReplyToUserId === "number" ? [result.normalizedReplyToUserId] : []),
        ...result.mentionUserIds,
      ],
    })
  }

  const redPacketMessage = redPacketClaim?.claimed
    ? `，并获得了 ${redPacketClaim.amount} ${redPacketClaim.pointName} ${redPacketClaim.rewardMode === "JACKPOT" ? "聚宝盆奖励" : "红包"}`
    : ""

  logRequestSucceeded({
    scope: "comments-create",
    action: "create-comment",
    userId: currentUser.id,
    targetId: result.created.id,
  }, {
    postId: result.postId,
    page: result.targetPage,
    reviewRequired: result.contentSafety.shouldReview,
  })

  return apiSuccess({
    id: result.created.id,
    navigation: {
      page: result.targetPage,
      sort: "oldest",
      anchor: `comment-${result.created.id}`,
    },
  }, result.contentSafety.shouldReview ? "回复命中敏感词规则，已进入审核" : result.normalizedReplyToUserName ? `已回复 @${result.normalizedReplyToUserName}${redPacketMessage}` : `回复成功${redPacketMessage}`)
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
