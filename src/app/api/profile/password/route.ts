import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/db/client"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const body = await request.json()
  const currentPassword = String(body.currentPassword ?? "")
  const newPassword = String(body.newPassword ?? "")

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  if (newPassword.length < 6 || newPassword.length > 64) {
    return NextResponse.json({ code: 400, message: "新密码长度需为 6-64 位" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      passwordHash: true,
    },
  })

  if (!user) {
    return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 })
  }

  const matched = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!matched) {
    return NextResponse.json({ code: 400, message: "当前密码不正确" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return NextResponse.json({ code: 0, message: "密码已更新" })
}
