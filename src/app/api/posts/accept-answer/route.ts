import { ChangeType, NotificationType, PostStatus } from "@/db/types"

import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/db/client"

import { getSiteSettings } from "@/lib/site-settings"


export async function POST(request: Request) {
  const user = await getCurrentUser()
  const body = await request.json()
  const postId = String(body.postId ?? "")
  const commentId = String(body.commentId ?? "")

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  if (!postId || !commentId) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }



  try {
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
        throw new Error("帖子不存在或尚未通过审核")
      }

      if (post.authorId !== user.id) {
        throw new Error("只有发帖人可以采纳答案")
      }

      if (post.type !== "BOUNTY") {
        throw new Error("只有悬赏帖可以采纳答案")
      }

      if (post.acceptedCommentId) {
        throw new Error("该悬赏帖已采纳答案")
      }

      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { id: true, postId: true, userId: true, status: true },
      })

      if (!comment || comment.postId !== postId || comment.status !== "NORMAL") {
        throw new Error("目标回复不存在或不可用")
      }

      if (comment.userId === user.id) {
        throw new Error("不能采纳自己的回复")
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

      await tx.user.update({
        where: { id: comment.userId },
        data: {
          acceptedAnswerCount: {
            increment: 1,
          },
          ...(post.bountyPoints && post.bountyPoints > 0
            ? {
                points: {
                  increment: post.bountyPoints,
                },
              }
            : {}),
        },
      })

      if (post.bountyPoints && post.bountyPoints > 0) {
        await tx.pointLog.create({

          data: {
            userId: comment.userId,
            changeType: ChangeType.INCREASE,
            changeValue: post.bountyPoints,
            reason: "悬赏帖答案被采纳，获得积分",
            relatedType: "POST",
            relatedId: postId,
          },
        })
      }

      await tx.notification.create({
        data: {
          userId: comment.userId,
          type: NotificationType.SYSTEM,
          senderId: user.id,
          relatedType: "POST",
          relatedId: postId,
          title: "你的回复被采纳为答案",
          content: `你的回复已被采纳为悬赏帖答案${post.bountyPoints ? `，获得 ${post.bountyPoints} ${settings.pointName}奖励` : ""}。`,

        },
      })

      return post.bountyPoints ?? 0

    })

    return NextResponse.json({ code: 0, message: `已采纳答案，奖励 ${result} ${settings.pointName}` })

  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "采纳答案失败" }, { status: 400 })
  }
}
