import { VerificationChannel } from "@/db/types"
import { NextResponse } from "next/server"

import { verifyCode } from "@/lib/verification"

export async function POST(request: Request) {
  const body = await request.json()
  const rawChannel = typeof body.channel === "string" ? body.channel.trim().toUpperCase() : ""
  const target = typeof body.target === "string" ? body.target.trim() : ""
  const code = typeof body.code === "string" ? body.code.trim() : ""
  const channel = rawChannel === VerificationChannel.EMAIL || rawChannel === VerificationChannel.PHONE ? rawChannel : ""

  if (!channel || !target || !code) {
    return NextResponse.json({ code: 400, message: "缺少校验参数" }, { status: 400 })
  }

  try {
    await verifyCode({ channel, target, code })
    return NextResponse.json({ code: 0, message: "验证码校验通过" })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "验证码校验失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
