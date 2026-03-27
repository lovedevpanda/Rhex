import { countRootCommentsByPostId, createCommentWithRelations, findCommentAuthorByUserId, findCommentParentById, findRootCommentPageById } from "@/db/comment-queries"

import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { extractMentionTexts, findMentionUsers } from "@/lib/comment-mentions"
import { enforceSensitiveText } from "@/lib/content-safety"
import { evaluateUserLevelProgress } from "@/lib/level-system"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryClaimPostRedPacket } from "@/lib/post-red-packets"
import { getSiteSettings } from "@/lib/site-settings"
import { validateCommentPayload } from "@/lib/validators"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await request.json()
  const validated = validateCommentPayload(body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }



  const { postId, content, parentId, replyToUserName } = validated.data
  const contentSafety = await enforceSensitiveText({ scene: "comment.content", text: content })
  const mentionTexts = extractMentionTexts(contentSafety.sanitizedText)
  const [postContext, dbUser, parentComment, mentionUsers, settings] = await Promise.all([
    getBoardAccessContextByPostId(postId),
    findCommentAuthorByUserId(currentUser.id),
    parentId ? findCommentParentById(parentId) : Promise.resolve(null),
    findMentionUsers(mentionTexts),
    getSiteSettings(),
  ])

  if (!postContext || !dbUser || postContext.post.status !== "NORMAL") {
    apiError(404, "帖子不存在或暂不可评论")
  }

  const permission = checkBoardPermission(dbUser, postContext.settings, "reply")
  if (!permission.allowed) {
    apiError(403, permission.message || "当前没有回复权限")
  }

  if (postContext.settings.replyIntervalSeconds > 0 && dbUser.lastCommentAt) {
    const waitSeconds = postContext.settings.replyIntervalSeconds - Math.floor((Date.now() - new Date(dbUser.lastCommentAt).getTime()) / 1000)
    if (waitSeconds > 0) {
      apiError(429, `回复过于频繁，请 ${waitSeconds} 秒后再试`)
    }
  }

  const requiredPoints = Math.max(0, -(postContext.settings.replyPointDelta ?? 0))
  if (dbUser.points < requiredPoints) {
    apiError(400, `当前${settings.pointName}不足，无法在该节点回复`)
  }

  let normalizedParentId = ""
  let normalizedReplyToUserId: number | null = null
  let normalizedReplyToUserName = replyToUserName

  if (parentComment) {
    if (parentComment.postId !== postId || parentComment.status !== "NORMAL") {
      apiError(400, "回复目标不存在或不可用")
    }

    normalizedParentId = parentComment.parentId ?? parentComment.id
    normalizedReplyToUserId = parentComment.userId
    normalizedReplyToUserName = parentComment.user.nickname ?? parentComment.user.username
  }

  const created = await createCommentWithRelations({
    postId,
    userId: currentUser.id,
    content: contentSafety.sanitizedText,
    status: contentSafety.shouldReview ? "PENDING" : "NORMAL",
    parentId: normalizedParentId || undefined,
    replyToUserId: normalizedReplyToUserId ?? undefined,
    replyPointDelta: postContext.settings.replyPointDelta ?? 0,
    pointName: settings.pointName,
    senderName: currentUser.nickname ?? currentUser.username,
    postAuthorId: postContext.post.authorId,
    mentionUsers,
    normalizedParentId: normalizedParentId || undefined,
    normalizedReplyToUserId,
  })

  const pageSize = 15
  const totalRootComments = normalizedParentId ? null : await countRootCommentsByPostId(postId)
  const targetPage = normalizedParentId
    ? await findRootCommentPageById({
        postId,
        rootCommentId: normalizedParentId,
        pageSize,
        sort: "oldest",
      })
    : Math.max(1, Math.ceil((totalRootComments ?? 0) / pageSize))

  await evaluateUserLevelProgress(currentUser.id)

  const [redPacketClaim] = await Promise.all([
    tryClaimPostRedPacket({ postId, userId: currentUser.id, triggerType: "REPLY", triggerCommentId: created.id }).catch(() => null),
    enrollUserInLotteryPool({ postId, userId: currentUser.id, replyCommentId: created.id }).catch(() => null),
  ])

  const redPacketMessage = redPacketClaim?.claimed ? `，并领取了 ${redPacketClaim.amount} ${redPacketClaim.pointName} 红包` : ""

  return apiSuccess({
    id: created.id,
    navigation: {
      page: targetPage,
      sort: "oldest",
      anchor: `comment-${created.id}`,
    },
  }, contentSafety.shouldReview ? "回复命中敏感词规则，已进入审核" : normalizedReplyToUserName ? `已回复 @${normalizedReplyToUserName}${redPacketMessage}` : `回复成功${redPacketMessage}`)
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
