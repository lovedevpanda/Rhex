import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import { createInviteCodes, getInviteCodeList } from "@/lib/invite-codes"

export async function GET() {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  const inviteCodes = await getInviteCodeList()
  return NextResponse.json({ code: 0, data: inviteCodes })
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const body = await request.json()
  const count = Math.max(1, Math.min(100, Number(body.count ?? 1) || 1))
  const note = typeof body.note === "string" ? body.note.trim() : ""

  const rows = await createInviteCodes({
    count,
    createdById: admin.id,
    note,
  })

  return NextResponse.json({ code: 0, message: `已生成 ${rows.length} 个邀请码`, data: rows })
}
