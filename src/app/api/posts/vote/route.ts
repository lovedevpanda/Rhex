import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { hasDatabaseUrl } from "@/lib/db-status"
import { prisma } from "@/db/client"

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const body = await request.json()
  const postId = String(body.postId ?? "")
  const optionId = String(body.optionId ?? "")

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  if (!postId || !optionId) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 0, message: "演示环境已记录投票，但未写入数据库" })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { id: true, type: true, status: true },
      })

      if (!post || post.status !== "NORMAL") {
        throw new Error("帖子不存在或尚未通过审核")
      }

      if (post.type !== "POLL") {
        throw new Error("当前帖子不是投票帖")
      }

      const option = await tx.pollOption.findFirst({
        where: { id: optionId, postId },
        select: { id: true },
      })

      if (!option) {
        throw new Error("投票选项不存在")
      }

      const existingVote = await tx.pollVote.findUnique({
        where: {
          postId_userId: {
            postId,
            userId: user.id,
          },
        },
        select: { id: true },
      })

      if (existingVote) {
        throw new Error("你已经投过票了")
      }

      await tx.pollVote.create({
        data: {
          postId,
          optionId,
          userId: user.id,
        },
      })

      await tx.pollOption.update({
        where: { id: optionId },
        data: {
          voteCount: {
            increment: 1,
          },
        },
      })
    })

    return NextResponse.json({ code: 0, message: "投票成功" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "投票失败" }, { status: 400 })
  }
}
