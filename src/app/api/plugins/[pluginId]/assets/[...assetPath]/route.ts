import fs from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

import { discoverPlugins } from "@/lib/plugin-loader"

const CONTENT_TYPE_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
}

function isSafeRelativePath(assetPath: string) {
  if (!assetPath) return false
  const normalized = assetPath.replace(/\\/g, "/")
  return !normalized.startsWith("/") && !normalized.split("/").some((segment) => segment === ".." || !segment)
}

export async function GET(
  _request: Request,
  { params }: { params: { pluginId: string; assetPath: string[] } },
) {
  const pluginId = decodeURIComponent(params.pluginId)
  const assetPath = params.assetPath.join("/")

  if (!isSafeRelativePath(assetPath)) {
    return NextResponse.json({ code: 400, message: "非法资源路径" }, { status: 400 })
  }

  const plugins = await discoverPlugins()
  const plugin = plugins.find((item) => item.manifest.id === pluginId || item.manifest.slug === pluginId)
  if (!plugin) {
    return NextResponse.json({ code: 404, message: "插件不存在" }, { status: 404 })
  }

  const publicDir = plugin.manifest.publicDir?.trim()
  if (!publicDir) {
    return NextResponse.json({ code: 404, message: "插件未声明公开资源目录" }, { status: 404 })
  }

  const resolvedPublicDir = path.resolve(plugin.rootDir, publicDir)
  const targetFile = path.resolve(resolvedPublicDir, assetPath)

  if (!targetFile.startsWith(`${resolvedPublicDir}${path.sep}`) && targetFile !== resolvedPublicDir) {
    return NextResponse.json({ code: 400, message: "非法资源路径" }, { status: 400 })
  }

  try {
    const file = await fs.readFile(targetFile)
    const extension = path.extname(targetFile).toLowerCase()
    const contentType = CONTENT_TYPE_MAP[extension] ?? "application/octet-stream"
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ code: 404, message: "资源不存在" }, { status: 404 })
    }
    return NextResponse.json({ code: 500, message: "读取插件资源失败" }, { status: 500 })
  }
}
