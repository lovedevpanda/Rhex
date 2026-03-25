import { VerificationChannel } from "@/db/types"
import { NextResponse } from "next/server"

import { sendRegisterVerificationEmail } from "@/lib/mailer"
import { getRequestIp } from "@/lib/request-ip"
import { sendVerificationCode } from "@/lib/verification"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPhone(value: string) {
  return /^1\d{10}$/.test(value)
}

export async function POST(request: Request) {
  const body = await request.json()
  const rawChannel = typeof body.channel === "string" ? body.channel.trim().toUpperCase() : ""
  const target = typeof body.target === "string" ? body.target.trim() : ""
  const channel = rawChannel === VerificationChannel.EMAIL || rawChannel === VerificationChannel.PHONE ? rawChannel : ""

  if (!channel || !target) {
    return NextResponse.json({ code: 400, message: "缺少验证码参数" }, { status: 400 })
  }

  if (channel === VerificationChannel.EMAIL && !isValidEmail(target)) {
    return NextResponse.json({ code: 400, message: "邮箱格式不正确" }, { status: 400 })
  }

  if (channel === VerificationChannel.PHONE && !isValidPhone(target)) {
    return NextResponse.json({ code: 400, message: "手机号格式不正确" }, { status: 400 })
  }

  if (channel === VerificationChannel.PHONE) {
    return NextResponse.json({ code: 400, message: "当前暂未接入短信通道，请先关闭手机验证码或后续接入短信服务" }, { status: 400 })
  }

  try {
    const result = await sendVerificationCode({
      channel,
      target,
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    })

    await sendRegisterVerificationEmail({
      to: target,
      code: result.code,
    })

    return NextResponse.json({
      code: 0,
      message: "验证码已发送到邮箱",
      data: {
        expiresAt: result.expiresAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "验证码发送失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
