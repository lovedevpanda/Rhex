import { NextResponse } from "next/server"

import { getRequestIp } from "@/lib/request-ip"
import { sendPasswordResetCode } from "@/lib/password-reset"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email) {
      return NextResponse.json({ code: 400, message: "请输入邮箱" }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ code: 400, message: "邮箱格式不正确" }, { status: 400 })
    }

    const result = await sendPasswordResetCode({
      email,
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({
      code: 0,
      message: "验证码已发送到邮箱",
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "验证码发送失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
