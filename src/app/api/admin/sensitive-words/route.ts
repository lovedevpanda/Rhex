import { NextResponse } from "next/server"

import { requireAdminUser, writeAdminLog } from "@/lib/admin"


import { hasDatabaseUrl } from "@/lib/db-status"
import { prisma } from "@/db/client"

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权执行后台操作" }, { status: 403 })
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可修改敏感词库" }, { status: 503 })
  }

  const body = await request.json()
  const word = String(body.word ?? "").trim()
  const matchType = String(body.matchType ?? "CONTAINS").trim().toUpperCase()
  const actionType = String(body.actionType ?? "REJECT").trim().toUpperCase()

  if (!word) {
    return NextResponse.json({ code: 400, message: "敏感词不能为空" }, { status: 400 })
  }

  const created = await prisma.sensitiveWord.create({
    data: { word, matchType, actionType, status: true },
  })
  await writeAdminLog(admin.id, "sensitiveWord.create", "CONFIG", created.id, `创建敏感词规则 ${word}`)
  return NextResponse.json({ code: 0, message: "敏感词规则已创建" })
}

export async function PUT(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权执行后台操作" }, { status: 403 })
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可修改敏感词库" }, { status: 503 })
  }

  const requestIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")?.trim() ?? null
  const body = await request.json()
  const id = String(body.id ?? "")
  if (!id) {
    return NextResponse.json({ code: 400, message: "缺少规则ID" }, { status: 400 })
  }

  await prisma.sensitiveWord.update({
    where: { id },
    data: { status: Boolean(body.status) },
  })
  await writeAdminLog(admin.id, "sensitiveWord.toggle", "CONFIG", id, `切换敏感词规则状态为 ${Boolean(body.status) ? "启用" : "停用"}`, requestIp)

  return NextResponse.json({ code: 0, message: "规则状态已更新" })
}

export async function DELETE(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权执行后台操作" }, { status: 403 })
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可修改敏感词库" }, { status: 503 })
  }

  const body = await request.json()
  const id = String(body.id ?? "")
  if (!id) {
    return NextResponse.json({ code: 400, message: "缺少规则ID" }, { status: 400 })
  }

  await prisma.sensitiveWord.delete({ where: { id } })
  await writeAdminLog(admin.id, "sensitiveWord.delete", "CONFIG", id, "删除敏感词规则")
  return NextResponse.json({ code: 0, message: "规则已删除" })
}
