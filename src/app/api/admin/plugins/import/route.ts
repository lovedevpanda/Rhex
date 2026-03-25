import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import { installPluginZip } from "@/lib/plugin-import"
import { validatePluginManifest } from "@/lib/plugin-loader"

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ code: 400, message: "缺少插件文件" }, { status: 400 })
  }

  try {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const result = await installPluginZip(file)
      return NextResponse.json({
        code: 0,
        message: `插件包已写入 plugins/${result.manifest.slug}，并已自动重建插件索引。`,
        data: result.manifest,
      })
    }

    if (file.name.endsWith("plugin.manifest.json") || file.type === "application/json") {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const manifest = await validatePluginManifest(parsed)
      return NextResponse.json({
        code: 0,
        message: "插件 manifest 校验通过。你也可以直接上传 zip 插件包完成导入。",
        data: manifest,
      })
    }

    return NextResponse.json({ code: 400, message: "仅支持导入 plugin.manifest.json 或 zip 插件包" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "插件导入失败" }, { status: 400 })
  }
}
