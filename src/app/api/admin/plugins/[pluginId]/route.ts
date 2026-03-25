import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import { pluginBundleRegistry } from "@/lib/plugin-bundle-registry"
import { getPluginInstallation } from "@/lib/plugins"

async function resolveAdminPluginApi(pluginId: string) {
  const installed = await getPluginInstallation(pluginId)
  if (!installed || !installed.enabled) {
    return null
  }

  return pluginBundleRegistry[installed.pluginId] ?? pluginBundleRegistry[installed.slug]
}

export async function GET(request: Request, { params }: { params: { pluginId: string } }) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  const bundle = await resolveAdminPluginApi(params.pluginId)
  const handler = bundle?.adminApi?.GET
  if (!handler) {
    return NextResponse.json({ code: 404, message: "插件后台接口不存在" }, { status: 404 })
  }
  return handler(request, { pluginId: params.pluginId, admin: true })
}

export async function POST(request: Request, { params }: { params: { pluginId: string } }) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const bundle = await resolveAdminPluginApi(params.pluginId)
  const handler = bundle?.adminApi?.POST
  if (!handler) {
    return NextResponse.json({ code: 404, message: "插件后台接口不存在" }, { status: 404 })
  }
  return handler(request, { pluginId: params.pluginId, admin: true })
}

