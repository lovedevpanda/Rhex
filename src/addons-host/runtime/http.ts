import { NextResponse } from "next/server"

import { executeAddonApi, normalizeAddonApiResult } from "@/addons-host/runtime/execute"
import { requireAdminUser } from "@/lib/admin"
import type { AddonApiScope, AddonHttpMethod } from "@/addons-host/types"

interface AddonApiRouteContext {
  params: Promise<{
    addonId: string
    slug?: string[]
  }>
}

function normalizeHttpMethod(method: string): AddonHttpMethod {
  switch (method.toUpperCase()) {
    case "GET":
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
    case "OPTIONS":
    case "HEAD":
      return method.toUpperCase() as AddonHttpMethod
    default:
      return "GET"
  }
}

export async function handleAddonApiRoute(scope: AddonApiScope, request: Request, routeContext: AddonApiRouteContext) {
  if (scope === "admin") {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ code: 403, message: "无权访问插件后台 API" }, { status: 403 })
    }
  }

  const params = await routeContext.params
  const resolved = await executeAddonApi(
    scope,
    params.addonId,
    params.slug,
    normalizeHttpMethod(request.method),
    request,
  )

  if (!resolved) {
    return NextResponse.json({ code: 404, message: "插件 API 不存在" }, { status: 404 })
  }

  try {
    return normalizeAddonApiResult(resolved.result)
  } catch (error) {
    console.error(`[addons-host:${scope}-api] unexpected error`, error)
    return NextResponse.json({ code: 500, message: "插件 API 执行失败" }, { status: 500 })
  }
}
