import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { unbindCurrentUserVerification } from "@/lib/verifications"

export async function POST() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录后再操作" }, { status: 401 })
  }

  try {
    await unbindCurrentUserVerification(currentUser.id)
    return NextResponse.json({ code: 0, message: "认证已解除绑定，你现在可以重新申请其它认证" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "解除绑定失败" }, { status: 400 })
  }
}
