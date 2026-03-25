import { TargetType } from "@/db/types"
import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { createReport } from "@/lib/reports"

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录后再举报" }, { status: 401 })
  }

  const body = await request.json()
  const targetType = String(body.targetType ?? "").toUpperCase()
  const targetId = String(body.targetId ?? "").trim()
  const reasonType = String(body.reasonType ?? "").trim()
  const reasonDetail = String(body.reasonDetail ?? "").trim()

  if (!targetId || !reasonType) {
    return NextResponse.json({ code: 400, message: "请填写完整的举报信息" }, { status: 400 })
  }

  if (targetType !== TargetType.POST && targetType !== TargetType.COMMENT && targetType !== TargetType.USER) {
    return NextResponse.json({ code: 400, message: "不支持的举报类型" }, { status: 400 })
  }

  try {
    await createReport({
      reporterId: user.id,
      targetType,
      targetId,
      reasonType,
      reasonDetail: reasonDetail || null,
    })

    return NextResponse.json({ code: 0, message: "举报已提交，管理员会尽快处理" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "举报提交失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
