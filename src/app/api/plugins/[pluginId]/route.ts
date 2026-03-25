import { NextResponse } from "next/server"

import { pluginBundleRegistry } from "@/lib/plugin-bundle-registry"
import { getPluginInstallation } from "@/lib/plugins"

async function resolvePublicPluginApi(pluginId: string) {
  const installed = await getPluginInstallation(pluginId)
  if (!installed || !installed.enabled) {
    return null
  }

  return pluginBundleRegistry[installed.pluginId] ?? pluginBundleRegistry[installed.slug]
}

export async function GET(request: Request, { params }: { params: { pluginId: string } }) {
  const bundle = await resolvePublicPluginApi(params.pluginId)
  const handler = bundle?.api?.GET
  if (!handler) {
    return NextResponse.json({ code: 404, message: "插件接口不存在" }, { status: 404 })
  }
  return handler(request, { pluginId: params.pluginId, admin: false })
}

export async function POST(request: Request, { params }: { params: { pluginId: string } }) {
  const bundle = await resolvePublicPluginApi(params.pluginId)
  const handler = bundle?.api?.POST
  if (!handler) {
    return NextResponse.json({ code: 404, message: "插件接口不存在" }, { status: 404 })
  }
  return handler(request, { pluginId: params.pluginId, admin: false })
}
