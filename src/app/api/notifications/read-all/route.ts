import { NextResponse } from "next/server"

import { markAllNotificationsAsRead } from "@/db/notification-queries"
import { getCurrentUser } from "@/lib/auth"


export async function POST() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  await markAllNotificationsAsRead(user.id)


  return NextResponse.json({ code: 0, message: "全部通知已标记为已读" })
}
