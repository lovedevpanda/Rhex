import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { hasDatabaseUrl } from "@/lib/db-status"
import { prisma } from "@/db/client"

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录后再关注节点" }, { status: 401 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可关注节点" }, { status: 503 })
  }

  const body = await request.json()
  const boardId = String(body.boardId ?? "")

  if (!boardId) {
    return NextResponse.json({ code: 400, message: "缺少节点参数" }, { status: 400 })
  }

  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true } })
  if (!board) {
    return NextResponse.json({ code: 404, message: "节点不存在" }, { status: 404 })
  }

  const existing = await prisma.boardFollow.findUnique({
    where: {
      userId_boardId: {
        userId: user.id,
        boardId,
      },
    },
  })

  if (existing) {
    await prisma.boardFollow.delete({ where: { id: existing.id } })
    return NextResponse.json({ code: 0, message: "已取消关注节点", data: { followed: false } })
  }

  await prisma.boardFollow.create({
    data: {
      userId: user.id,
      boardId,
    },
  })

  return NextResponse.json({ code: 0, message: "关注节点成功", data: { followed: true } })
}
