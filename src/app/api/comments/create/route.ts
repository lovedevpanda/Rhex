import { NextResponse } from "next/server"

import { countRootCommentsByPostId, createCommentWithRelations, findCommentAuthorByUserId, findCommentParentById, findRootCommentPageById } from "@/db/comment-queries"

import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission, getBoardAccessContextByPostId } from "@/lib/board-access"
import { extractMentionTexts, findMentionUsers } from "@/lib/comment-mentions"
import { ContentSafetyError, enforceSensitiveText } from "@/lib/content-safety"
import { hasDatabaseUrl } from "@/lib/db-status"
import { evaluateUserLevelProgress } from "@/lib/level-system"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryClaimPostRedPacket } from "@/lib/post-red-packets"
import { getSiteSettings } from "@/lib/site-settings"
import { validateCommentPayload } from "@/lib/validators"

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const body = await request.json()
  const validated = validateCommentPayload(body)

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录后再评论" }, { status: 401 })
  }

  if (user.status === "MUTED" || user.status === "BANNED") {
    return NextResponse.json({ code: 403, message: user.status === "BANNED" ? "账号已被拉黑，无法回复" : "账号已被禁言，暂不可回复" }, { status: 403 })
  }

  if (!validated.success || !validated.data) {
    return NextResponse.json({ code: 400, message: validated.message ?? "参数错误" }, { status: 400 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 0, message: "success", data: { id: `mock-${Date.now()}` } })
  }

  const { postId, content, parentId, replyToUserName } = validated.data

  try {
    const contentSafety = await enforceSensitiveText({ scene: "comment.content", text: content })
    const mentionTexts = extractMentionTexts(contentSafety.sanitizedText)
    const [postContext, dbUser, parentComment, mentionUsers, settings] = await Promise.all([
      getBoardAccessContextByPostId(postId),
      findCommentAuthorByUserId(user.id),
      parentId ? findCommentParentById(parentId) : Promise.resolve(null),
      findMentionUsers(mentionTexts),
      getSiteSettings(),
    ])

    if (!postContext || !dbUser || postContext.post.status !== "NORMAL") {
      return NextResponse.json({ code: 404, message: "帖子不存在或暂不可评论" }, { status: 404 })
    }

    const permission = checkBoardPermission(dbUser, postContext.settings, "reply")
    if (!permission.allowed) {
      return NextResponse.json({ code: 403, message: permission.message || "当前没有回复权限" }, { status: 403 })
    }

    if (postContext.settings.replyIntervalSeconds > 0 && dbUser.lastCommentAt) {
      const waitSeconds = postContext.settings.replyIntervalSeconds - Math.floor((Date.now() - new Date(dbUser.lastCommentAt).getTime()) / 1000)
      if (waitSeconds > 0) {
        return NextResponse.json({ code: 429, message: `回复过于频繁，请 ${waitSeconds} 秒后再试` }, { status: 429 })
      }
    }

    const requiredPoints = Math.max(0, -(postContext.settings.replyPointDelta ?? 0))
    if (dbUser.points < requiredPoints) {
      return NextResponse.json({ code: 400, message: `当前${settings.pointName}不足，无法在该节点回复` }, { status: 400 })
    }

    let normalizedParentId = ""
    let normalizedReplyToUserId: number | null = null
    let normalizedReplyToUserName = replyToUserName

    if (parentComment) {
      if (parentComment.postId !== postId || parentComment.status !== "NORMAL") {
        return NextResponse.json({ code: 400, message: "回复目标不存在或不可用" }, { status: 400 })
      }

      normalizedParentId = parentComment.parentId ?? parentComment.id
      normalizedReplyToUserId = parentComment.userId
      normalizedReplyToUserName = parentComment.user.nickname ?? parentComment.user.username
    }

    const created = await createCommentWithRelations({
      postId,
      userId: user.id,
      content: contentSafety.sanitizedText,
      status: contentSafety.shouldReview ? "PENDING" : "NORMAL",
      parentId: normalizedParentId || undefined,
      replyToUserId: normalizedReplyToUserId ?? undefined,
      replyPointDelta: postContext.settings.replyPointDelta ?? 0,
      pointName: settings.pointName,
      senderName: user.nickname ?? user.username,
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

    await evaluateUserLevelProgress(user.id)

    const [redPacketClaim] = await Promise.all([
      tryClaimPostRedPacket({ postId, userId: user.id, triggerType: "REPLY", triggerCommentId: created.id }).catch(() => null),
      enrollUserInLotteryPool({ postId, userId: user.id, replyCommentId: created.id }).catch(() => null),
    ])

    const redPacketMessage = redPacketClaim?.claimed ? `，并领取了 ${redPacketClaim.amount} ${redPacketClaim.pointName} 红包` : ""

    return NextResponse.json({
      code: 0,
      message: contentSafety.shouldReview ? "回复命中敏感词规则，已进入审核" : normalizedReplyToUserName ? `已回复 @${normalizedReplyToUserName}${redPacketMessage}` : `回复成功${redPacketMessage}`,
      data: {
        id: created.id,
        navigation: {
          page: targetPage,
          sort: "oldest",
          anchor: `comment-${created.id}`,
        },
      },
    })
  } catch (error) {
    console.error(error)
    if (error instanceof ContentSafetyError) {
      return NextResponse.json({ code: 400, message: error.message }, { status: error.statusCode })
    }
    const message = error instanceof Error && error.message ? error.message : "评论失败"
    return NextResponse.json({ code: 500, message }, { status: 500 })
  }
}
