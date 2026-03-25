import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { redeemPointsCode } from "@/lib/redeem-codes"

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const redeemCode = await redeemPointsCode({
      userId: user.id,
      code: String(body.code ?? ""),
    })

    return NextResponse.json({
      code: 0,
      message: "兑换成功",
      data: {
        code: redeemCode.code,
        points: redeemCode.points,
      },
    })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "兑换失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
