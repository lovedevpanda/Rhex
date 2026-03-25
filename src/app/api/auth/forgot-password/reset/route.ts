import { NextResponse } from "next/server"

import { resetPasswordByEmailCode } from "@/lib/password-reset"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const code = typeof body.code === "string" ? body.code.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : ""

    if (!email || !code || !password || !confirmPassword) {
      return NextResponse.json({ code: 400, message: "请完整填写邮箱、验证码和新密码" }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ code: 400, message: "两次输入的密码不一致" }, { status: 400 })
    }

    await resetPasswordByEmailCode({
      email,
      code,
      password,
    })

    return NextResponse.json({
      code: 0,
      message: "密码已重置，请使用新密码登录",
    })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "重置密码失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
