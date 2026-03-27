import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { submitVerificationApplication } from "@/lib/verifications"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录后再申请认证" }, { status: 401 })
  }

  const body = await request.json()
  const verificationTypeId = String(body.verificationTypeId ?? "").trim()
  const content = String(body.content ?? "").trim()
  const formResponse = body.formResponse && typeof body.formResponse === "object" ? body.formResponse as Record<string, unknown> : undefined

  if (!verificationTypeId) {
    return NextResponse.json({ code: 400, message: "请选择认证类型" }, { status: 400 })
  }

  try {
    const application = await submitVerificationApplication({
      userId: currentUser.id,
      verificationTypeId,
      content,
      formResponse: formResponse ? Object.fromEntries(Object.entries(formResponse).map(([key, value]) => [key, String(value ?? "")])) : undefined,
    })


    return NextResponse.json({
      code: 0,
      message: "认证申请已提交，请等待后台审核",
      data: {
        id: application.id,
        status: application.status,
      },
    })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "提交失败" }, { status: 400 })
  }
}
