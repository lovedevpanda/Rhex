import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/db/client"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const body = await request.json()
  const postId = typeof body.postId === "string" ? body.postId.trim() : ""
  const commentId = typeof body.commentId === "string" ? body.commentId.trim() : ""
  const action = body.action === "unpin" ? "unpin" : "pin"

  if (!postId || !commentId) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
    },
  })

  if (!post) {
    return NextResponse.json({ code: 404, message: "帖子不存在" }, { status: 404 })
  }

  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "MODERATOR"
  const isOwner = currentUser.id === post.authorId

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ code: 403, message: "无权操作评论置顶" }, { status: 403 })
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      postId: true,
      parentId: true,
      status: true,
      isPinnedByAuthor: true,
    },
  })

  if (!comment || comment.postId !== postId || comment.status !== "NORMAL") {
    return NextResponse.json({ code: 404, message: "评论不存在或不可操作" }, { status: 404 })
  }

  if (comment.parentId) {
    return NextResponse.json({ code: 400, message: "仅支持置顶一级评论" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    if (action === "pin") {
      await tx.comment.updateMany({
        where: {
          postId,
          parentId: null,
          isPinnedByAuthor: true,
        },
        data: {
          isPinnedByAuthor: false,
        },
      })

      await tx.comment.update({
        where: { id: commentId },
        data: { isPinnedByAuthor: true },
      })
      return
    }

    await tx.comment.update({
      where: { id: commentId },
      data: { isPinnedByAuthor: false },
    })
  })

  return NextResponse.json({
    code: 0,
    message: action === "pin" ? "评论已置顶" : "已取消评论置顶",
  })
}
