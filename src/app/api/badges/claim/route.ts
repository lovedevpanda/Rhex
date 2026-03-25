import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { claimBadge } from "@/lib/badges"
import { hasDatabaseUrl } from "@/lib/db-status"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录后再领取勋章" }, { status: 401 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可领取勋章" }, { status: 503 })
  }

  const body = await request.json()
  const badgeId = String(body.badgeId ?? "").trim()

  if (!badgeId) {
    return NextResponse.json({ code: 400, message: "缺少勋章参数" }, { status: 400 })
  }

  try {
    const badge = await claimBadge(currentUser.id, badgeId)
    return NextResponse.json({ code: 0, message: `已领取勋章：${badge.name}` })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "领取失败" }, { status: 400 })
  }
}
