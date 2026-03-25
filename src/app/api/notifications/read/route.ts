import { NextResponse } from "next/server"

import { markNotificationAsRead } from "@/db/notification-queries"
import { getCurrentUser } from "@/lib/auth"


export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const body = await request.json()
  const notificationId = String(body.notificationId ?? "")

  if (!notificationId) {
    return NextResponse.json({ code: 400, message: "缺少通知 ID" }, { status: 400 })
  }

  await markNotificationAsRead(user.id, notificationId)


  return NextResponse.json({ code: 0, message: "已标记为已读" })
}
