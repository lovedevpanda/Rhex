import { promises as fs } from "node:fs"
import path from "node:path"

import { NextResponse } from "next/server"

import { fileExists, getAddonAssetsDirectory, isValidAddonId, resolveSafeAddonChildPath } from "@/addons-host/runtime/fs"

type RouteContext = {
  params: Promise<{
    addonId: string
    path?: string[]
  }>
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".cur": "application/octet-stream",
}

function resolveCacheControlHeader(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === ".js" || extension === ".mjs" || extension === ".css" || extension === ".json") {
    return "public, no-cache, must-revalidate"
  }

  return "public, max-age=3600"
}

async function handleAssetRequest(context: RouteContext) {
  const params = await context.params
  if (!isValidAddonId(params.addonId)) {
    return NextResponse.json({ code: 400, message: "非法插件标识" }, { status: 400 })
  }

  const assetRoot = getAddonAssetsDirectory(params.addonId)
  if (!(await fileExists(assetRoot))) {
    return NextResponse.json({ code: 404, message: "插件资源目录不存在" }, { status: 404 })
  }

  const requestedRelativePath = (params.path ?? []).join("/")
  if (!requestedRelativePath) {
    return NextResponse.json({ code: 404, message: "资源不存在" }, { status: 404 })
  }

  let filePath: string

  try {
    filePath = await resolveSafeAddonChildPath(assetRoot, requestedRelativePath)
  } catch {
    return NextResponse.json({ code: 400, message: "非法资源路径" }, { status: 400 })
  }

  if (!(await fileExists(filePath))) {
    return NextResponse.json({ code: 404, message: "资源不存在" }, { status: 404 })
  }

  const stat = await fs.stat(filePath)
  if (!stat.isFile()) {
    return NextResponse.json({ code: 404, message: "资源不存在" }, { status: 404 })
  }

  const contentType = CONTENT_TYPE_MAP[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
  const buffer = await fs.readFile(filePath)

  return new Response(buffer, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(buffer.byteLength),
      "cache-control": resolveCacheControlHeader(filePath),
    },
  })
}

export function GET(_request: Request, context: RouteContext) {
  return handleAssetRequest(context)
}

export function HEAD(_request: Request, context: RouteContext) {
  return handleAssetRequest(context)
}
