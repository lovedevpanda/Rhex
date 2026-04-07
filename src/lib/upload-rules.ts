import path from "path"

export const ALLOWED_UPLOAD_FOLDERS = ["avatars", "posts", "comments", "friend-links", "site-logo", "icon"] as const

export type UploadFolder = (typeof ALLOWED_UPLOAD_FOLDERS)[number]

const ALLOWED_UPLOAD_FOLDER_SET = new Set<string>(ALLOWED_UPLOAD_FOLDERS)

export function isAllowedUploadFolder(value: string): value is UploadFolder {
  return ALLOWED_UPLOAD_FOLDER_SET.has(value)
}

export function normalizeUploadFolder(value: unknown, fallback: UploadFolder = "avatars"): UploadFolder {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return isAllowedUploadFolder(normalized) ? normalized : fallback
}

export function normalizeUploadExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase()
}

export function isSafeUploadSegment(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes("..")
}

export function getUploadMimeType(fileName: string) {
  switch (normalizeUploadExtension(fileName)) {
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "gif":
      return "image/gif"
    case "webp":
      return "image/webp"
    case "avif":
      return "image/avif"
    case "svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}
