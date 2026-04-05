import { PostStatus } from "@/db/types"

import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { createSystemNotification } from "@/lib/notification-writes"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少必要参数")
  const commentId = requireStringField(body, "commentId", "缺少必要参数")
  const settings = await getSiteSettings()

  const result = await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        type: true,
        bountyPoints: true,
        acceptedCommentId: true,
        status: true,
      },
    })

    if (!post || post.status !== PostStatus.NORMAL) {
      apiError(400, "帖子不存在或尚未通过审核")
    }

    if (post.authorId !== currentUser.id) {
      apiError(400, "只有发帖人可以采纳答案")
    }

    if (post.type !== "BOUNTY") {
      apiError(400, "只有悬赏帖可以采纳答案")
    }

    if (post.acceptedCommentId) {
      apiError(400, "该悬赏帖已采纳答案")
    }

    const comment = await tx.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, userId: true, status: true },
    })

    if (!comment || comment.postId !== postId || comment.status !== "NORMAL") {
      apiError(400, "目标回复不存在或不可用")
    }

    if (comment.userId === currentUser.id) {
      apiError(400, "不能采纳自己的回复")
    }

    await tx.comment.update({
      where: { id: commentId },
      data: {
        isAcceptedAnswer: true,
        acceptedAt: new Date(),
      },
    })

    await tx.post.update({
      where: { id: postId },
      data: {
        acceptedCommentId: commentId,
        bountyAwardedAt: new Date(),
      },
    })

    const answerUser = await tx.user.findUnique({
      where: { id: comment.userId },
      select: { id: true, points: true },
    })

    if (!answerUser) {
      apiError(404, "答题用户不存在")
    }

    const preparedReward = post.bountyPoints && post.bountyPoints > 0
      ? await prepareScopedPointDelta({
          scopeKey: "BOUNTY_ACCEPT_REWARD",
          baseDelta: post.bountyPoints,
          userId: comment.userId,
        })
      : null

    await tx.user.update({
      where: { id: comment.userId },
      data: {
        acceptedAnswerCount: {
          increment: 1,
        },
      },
    })

    if (preparedReward) {
      await applyPointDelta({
        tx,
        userId: comment.userId,
        beforeBalance: answerUser.points,
        prepared: preparedReward,
        pointName: settings.pointName,
        reason: "悬赏帖答案被采纳，获得积分",
        relatedType: "POST",
        relatedId: postId,
      })
    }

    await createSystemNotification({
      client: tx,
      userId: comment.userId,
      senderId: currentUser.id,
      relatedType: "POST",
      relatedId: postId,
      title: "你的回复被采纳为答案",
      content: `你的回复已被采纳为悬赏帖答案${post.bountyPoints ? `，奖励基准为 ${post.bountyPoints} ${settings.pointName}` : ""}。`,
    })

    return Math.max(0, preparedReward?.finalDelta ?? 0)
  })

  return apiSuccess(undefined, `已采纳答案，奖励 ${result} ${settings.pointName}`)
}, {
  errorMessage: "采纳答案失败",
  logPrefix: "[api/posts/accept-answer] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

