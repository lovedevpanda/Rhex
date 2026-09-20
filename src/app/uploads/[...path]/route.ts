import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { Readable } from "stream"

import { notFound } from "next/navigation"

import { getSiteSettings } from "@/lib/site-settings"
import { buildUploadStoragePath } from "@/lib/upload-path"
import { getUploadMimeType, isPrivateUploadFolder, isSafeUploadPathSegments } from "@/lib/upload-rules"

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
  return {
    "Content-Type": getUploadMimeType(fileName),
    "Content-Length": String(fileSize),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Last-Modified": lastModified.toUTCString(),
  }
}

/**
 * 公开静态读取的准入判断。
 *
 * 这个路由**没有任何鉴权**（设计如此：头像、帖子图等本来就要公开）。
 * 但私有目录（私信附件）必须挡掉 —— 否则带 ACL 的
 * `/api/messages/files/...` 代理形同虚设，猜到文件名即可无鉴权下载。
 * 用 404 而不是 403，避免暴露"这个目录存在"。
 */
function assertPubliclyReadable(pathSegments: readonly string[]) {
  if (!isSafeUploadPathSegments(pathSegments)) {
    notFound()
  }

  if (isPrivateUploadFolder(pathSegments[0]!)) {
    notFound()
  }
}

async function readUploadResponse(pathSegments: readonly string[]) {
  assertPubliclyReadable(pathSegments)

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
  assertPubliclyReadable(params.path)

  const resolvedFilePath = await resolveUploadFilePath(params.path)

  if (!resolvedFilePath) {
    notFound()
  }

  const fileName = params.path[params.path.length - 1]!

  return new Response(null, {
    headers: buildUploadHeaders(fileName, resolvedFilePath.fileStat.size, resolvedFilePath.fileStat.mtime),
  })
}
