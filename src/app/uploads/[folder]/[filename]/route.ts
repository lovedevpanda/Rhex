import { access, readFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { notFound } from "next/navigation"

import { getSiteSettings } from "@/lib/site-settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const uploadRouteFilePath = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(path.dirname(uploadRouteFilePath), "../../../../../..")
const publicRoot = path.join(projectRoot, "public")
const ALLOWED_UPLOAD_FOLDERS = new Set(["avatars", "posts", "comments", "friend-links", "site-logo"])

function getMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase()

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".gif":
      return "image/gif"
    case ".webp":
      return "image/webp"
    case ".avif":
      return "image/avif"
    default:
      return "application/octet-stream"
  }
}

function isSafeSegment(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes("..")
}

async function resolveUploadFilePath(folder: string, fileName: string) {
  const settings = await getSiteSettings()
  const configuredLocalPath = settings.uploadLocalPath?.trim() || "uploads"
  const candidatePaths = [
    path.join(publicRoot, configuredLocalPath, folder, fileName),
  ]

  if (configuredLocalPath !== "uploads") {
    candidatePaths.push(path.join(publicRoot, "uploads", folder, fileName))
  }

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath)
      return candidatePath
    } catch {
      continue
    }
  }

  return null
}

async function readUploadResponse(folder: string, fileName: string) {
  if (!ALLOWED_UPLOAD_FOLDERS.has(folder) || !isSafeSegment(fileName)) {
    notFound()
  }

  const resolvedFilePath = await resolveUploadFilePath(folder, fileName)

  if (!resolvedFilePath) {
    notFound()
  }

  const buffer = await readFile(resolvedFilePath)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": getMimeType(fileName),
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    },
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
  const response = await readUploadResponse(params.folder, params.filename)

  return new Response(null, {
    headers: response.headers,
  })
}
