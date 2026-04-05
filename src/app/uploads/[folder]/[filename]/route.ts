import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { Readable } from "stream"

import { notFound } from "next/navigation"

import { getSiteSettings } from "@/lib/site-settings"
import { buildUploadStoragePath } from "@/lib/upload-path"
import { getUploadMimeType, isAllowedUploadFolder, isSafeUploadSegment } from "@/lib/upload-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

async function resolveUploadFilePath(folder: string, fileName: string) {
  const settings = await getSiteSettings()

  try {
    const filePath = buildUploadStoragePath(settings.uploadLocalPath, folder, fileName)
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

async function readUploadResponse(folder: string, fileName: string) {
  if (!isAllowedUploadFolder(folder) || !isSafeUploadSegment(fileName)) {
    notFound()
  }

  const resolvedFilePath = await resolveUploadFilePath(folder, fileName)

  if (!resolvedFilePath) {
    notFound()
  }

  return new Response(Readable.toWeb(createReadStream(resolvedFilePath.filePath)) as ReadableStream<Uint8Array>, {
    headers: buildUploadHeaders(fileName, resolvedFilePath.fileStat.size, resolvedFilePath.fileStat.mtime),
  })
}

interface UploadRouteProps {
  params: Promise<{
    folder: string
    filename: string
  }>
}

export async function GET(_request: Request, props: UploadRouteProps) {
  const params = await props.params
  return readUploadResponse(params.folder, params.filename)
}

export async function HEAD(_request: Request, props: UploadRouteProps) {
  const params = await props.params
  if (!isAllowedUploadFolder(params.folder) || !isSafeUploadSegment(params.filename)) {
    notFound()
  }

  const resolvedFilePath = await resolveUploadFilePath(params.folder, params.filename)

  if (!resolvedFilePath) {
    notFound()
  }

  return new Response(null, {
    headers: buildUploadHeaders(params.filename, resolvedFilePath.fileStat.size, resolvedFilePath.fileStat.mtime),
  })
}
