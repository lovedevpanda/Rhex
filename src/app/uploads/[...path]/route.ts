import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { Readable } from "stream"

import { notFound } from "next/navigation"

import { getSiteSettings } from "@/lib/site-settings"
import { buildUploadStoragePath } from "@/lib/upload-path"
import { getUploadMimeType, isSafeUploadPathSegments, normalizeUploadExtension } from "@/lib/upload-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

async function resolveUploadFilePath(pathSegments: readonly string[]) {
  const settings = await getSiteSettings()

  try {
    const filePath = buildUploadStoragePath(settings.uploadLocalPath, ...pathSegments)
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      return null
    }

    return {
      filePath,
      fileStat,
    }
  } catch {
    return null
  }
}

function buildUploadHeaders(fileName: string, fileSize: number, lastModified: Date) {
  const headers: Record<string, string> = {
    "Content-Type": getUploadMimeType(fileName),
    "Content-Length": String(fileSize),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Last-Modified": lastModified.toUTCString(),
  }

  // 用户上传的 SVG 绝不能在执行上下文中被渲染为顶层文档（存储型 XSS）。
  // 通过 Content-Disposition 促使用户代理下载，并以严格 CSP 禁用脚本执行。
  // 上传时已在 src/lib/upload.ts 对 SVG 内容做消毒处理（纵深防御）。
  if (normalizeUploadExtension(fileName) === "svg") {
    const safeFileName = fileName.replace(/["\\\r\n]+/g, "_")
    headers["Content-Disposition"] = `attachment; filename="${safeFileName}"`
    headers["Content-Security-Policy"] = "default-src 'none'; script-src 'none'; style-src 'none'; img-src 'self' data:; sandbox"
    headers["X-Content-Type-Options"] = "nosniff"
  }

  return headers
}

async function readUploadResponse(pathSegments: readonly string[]) {
  if (!isSafeUploadPathSegments(pathSegments)) {
    notFound()
  }

  const resolvedFilePath = await resolveUploadFilePath(pathSegments)

  if (!resolvedFilePath) {
    notFound()
  }

  const fileName = pathSegments[pathSegments.length - 1]!

  return new Response(Readable.toWeb(createReadStream(resolvedFilePath.filePath)) as ReadableStream<Uint8Array>, {
    headers: buildUploadHeaders(fileName, resolvedFilePath.fileStat.size, resolvedFilePath.fileStat.mtime),
  })
}

interface UploadRouteProps {
  params: Promise<{
    path: string[]
  }>
}

export async function GET(_request: Request, props: UploadRouteProps) {
  const params = await props.params
  return readUploadResponse(params.path)
}

export async function HEAD(_request: Request, props: UploadRouteProps) {
  const params = await props.params
  if (!isSafeUploadPathSegments(params.path)) {
    notFound()
  }

  const resolvedFilePath = await resolveUploadFilePath(params.path)

  if (!resolvedFilePath) {
    notFound()
  }

  const fileName = params.path[params.path.length - 1]!

  return new Response(null, {
    headers: buildUploadHeaders(fileName, resolvedFilePath.fileStat.size, resolvedFilePath.fileStat.mtime),
  })
}
