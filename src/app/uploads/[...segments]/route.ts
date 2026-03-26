import { access, readFile } from "fs/promises"
import path from "path"

import { NextResponse } from "next/server"

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
}

function buildNotFoundResponse() {
  return NextResponse.json({ code: 404, message: "文件不存在" }, { status: 404 })
}

function resolveUploadFilePath(segments: string[]) {
  const relativePath = segments.join("/")
  const normalizedPath = path.posix.normalize(`/${relativePath}`)

  if (normalizedPath.includes("..")) {
    return null
  }

  return path.join(process.cwd(), "public", "uploads", ...segments)
}

export async function GET(_request: Request, context: { params: { segments?: string[] } }) {
  const segments = context.params.segments ?? []
  if (segments.length === 0) {
    return buildNotFoundResponse()
  }

  const filePath = resolveUploadFilePath(segments)
  if (!filePath) {
    return buildNotFoundResponse()
  }

  const extension = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPE_BY_EXTENSION[extension]
  if (!contentType) {
    return buildNotFoundResponse()
  }

  try {
    await access(filePath)
    const buffer = await readFile(filePath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return buildNotFoundResponse()
  }
}
