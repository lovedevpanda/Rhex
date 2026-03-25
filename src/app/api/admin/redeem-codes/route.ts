import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import { createRedeemCodes, getRedeemCodeList } from "@/lib/redeem-codes"

export async function GET() {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  const redeemCodes = await getRedeemCodeList()
  return NextResponse.json({ code: 0, data: redeemCodes })
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const count = Math.max(1, Math.min(100, Number(body.count ?? 1) || 1))
    const points = Math.max(1, Number(body.points ?? 0) || 0)
    const note = typeof body.note === "string" ? body.note.trim() : ""
    const expiresAtInput = typeof body.expiresAt === "string" ? body.expiresAt.trim() : ""
    const expiresAt = expiresAtInput ? new Date(expiresAtInput) : null

    if (Number.isNaN(expiresAt?.getTime())) {
      return NextResponse.json({ code: 400, message: "过期时间格式不正确" }, { status: 400 })
    }

    const rows = await createRedeemCodes({
      count,
      points,
      createdById: admin.id,
      note,
      expiresAt,
    })

    return NextResponse.json({ code: 0, message: `已生成 ${rows.length} 个兑换码`, data: rows })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "兑换码生成失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
