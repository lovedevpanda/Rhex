import { NextResponse } from "next/server"

import { requireAdminUser, writeAdminLog } from "@/lib/admin"


import { getLevelDefinitions, saveLevelDefinitions } from "@/lib/level-system"

export async function GET() {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  const levels = await getLevelDefinitions()
  return NextResponse.json({ code: 0, data: levels })
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const body = await request.json()


  const levels = Array.isArray(body.levels) ? body.levels : []

  try {
    const saved = await saveLevelDefinitions(levels)
    await writeAdminLog(admin.id, "site.levels.update", "SITE", "level-system", `管理员更新了 ${saved.length} 个等级定义`)
    return NextResponse.json({ code: 0, message: "等级系统设置已保存", data: saved })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "保存等级设置失败" }, { status: 400 })
  }
}
