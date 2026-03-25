import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { purchaseInviteCode } from "@/lib/invite-codes"

export async function POST() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  try {
    const inviteCode = await purchaseInviteCode(user.id)
    return NextResponse.json({ code: 0, message: "邀请码购买成功", data: { code: inviteCode.code } })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "邀请码购买失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
