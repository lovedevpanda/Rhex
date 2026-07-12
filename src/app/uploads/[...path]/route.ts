import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { Readable } from "stream"

import { notFound } from "next/navigation"

import { getSiteSettings } from "@/lib/site-settings"
import { buildUploadStoragePath } from "@/lib/upload-path"
import { getUploadMimeType, isSafeUploadPathSegments } from "@/lib/upload-rules"

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
  const contentType = getUploadMimeType(fileName)

  return {
    "Content-Type": contentType,
    "Content-Length": String(fileSize),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Last-Modified": lastModified.toUTCString(),
    ...(contentType === "image/svg+xml" ? { "Content-Security-Policy": "sandbox" } : {}),
  }
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
