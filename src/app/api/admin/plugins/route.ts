import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import { installPlugin, listPluginInstallations, uninstallPlugin, updatePluginConfig, disableInstalledPlugin } from "@/lib/plugins"

export async function GET() {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  const data = await listPluginInstallations()
  return NextResponse.json({ code: 0, data })
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const body = await request.json()
  const action = String(body.action ?? "")
  const pluginId = String(body.pluginId ?? "").trim()

  if (!pluginId) {
    return NextResponse.json({ code: 400, message: "缺少插件标识" }, { status: 400 })
  }

  try {
    if (action === "install") {
      const data = await installPlugin(pluginId)
      const repairedFiles = Array.isArray(data?.migration?.repairedFiles) ? data.migration.repairedFiles : []
      const executedFiles = Array.isArray(data?.migration?.executedFiles) ? data.migration.executedFiles : []
      const parts = [] as string[]
      if (repairedFiles.length > 0) {
        parts.push(`已修复迁移状态：${repairedFiles.join(", ")}`)
      }
      if (executedFiles.length > 0) {
        parts.push(`已执行迁移：${executedFiles.join(", ")}`)
      }
      const message = parts.length > 0 ? `插件已激活，${parts.join("；")}` : "插件已激活，本次没有新的迁移需要执行"
      return NextResponse.json({ code: 0, message, data })
    }

    if (action === "disable") {
      const reason = typeof body.reason === "string" ? body.reason : undefined
      const data = await disableInstalledPlugin(pluginId, reason)
      return NextResponse.json({ code: 0, message: "插件已停用", data })
    }

    if (action === "uninstall") {
      const mode = body.mode === "delete-files" ? "delete-files" : "clean-db"
      const data = await uninstallPlugin(pluginId, { mode })
      const revertedFiles = Array.isArray(data?.migration?.revertedFiles) ? data.migration.revertedFiles : []
      const message = mode === "delete-files"
        ? `插件已彻底卸载：已停用、清库并删除文件${revertedFiles.length > 0 ? `，回滚迁移：${revertedFiles.join(", ")}` : ""}`
        : `插件已清库卸载：已停用并清理插件数据${revertedFiles.length > 0 ? `，回滚迁移：${revertedFiles.join(", ")}` : ""}`
      return NextResponse.json({ code: 0, message, data })
    }

    if (action === "save-config") {
      const config = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : {}
      const data = await updatePluginConfig(pluginId, config)
      return NextResponse.json({ code: 0, message: "插件配置已保存", data })
    }

    return NextResponse.json({ code: 400, message: "不支持的操作" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "插件操作失败" }, { status: 400 })
  }
}
