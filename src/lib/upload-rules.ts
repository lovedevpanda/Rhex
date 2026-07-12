import path from "path"

export const ALLOWED_UPLOAD_FOLDERS = ["avatars", "posts", "comments", "post-covers", "friend-links", "site-logo", "icon", "emoji", "message-images", "message-files", "watermark"] as const

export type UploadFolder = (typeof ALLOWED_UPLOAD_FOLDERS)[number]

const ALLOWED_UPLOAD_FOLDER_SET = new Set<string>(ALLOWED_UPLOAD_FOLDERS)
const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
}
const EXTENSIONS_BY_MIME_TYPE = Object.entries(MIME_TYPE_BY_EXTENSION).reduce<Record<string, string[]>>((accumulator, [extension, mimeType]) => {
  const normalizedMimeType = mimeType.toLowerCase()
  const existing = accumulator[normalizedMimeType]

  if (existing) {
    existing.push(extension)
  } else {
    accumulator[normalizedMimeType] = [extension]
  }

  return accumulator
}, {})

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

export function isSafeUploadPathSegments(value: readonly string[]) {
  return value.length > 0
    && value.every((segment) => segment !== "." && segment !== ".." && isSafeUploadSegment(segment))
}

export function getUploadMimeType(fileName: string) {
  return MIME_TYPE_BY_EXTENSION[normalizeUploadExtension(fileName)] ?? "application/octet-stream"
}

export function getUploadExtensionsForMimeType(mimeType: string) {
  return EXTENSIONS_BY_MIME_TYPE[mimeType.trim().toLowerCase()] ?? []
}

export function getPrimaryUploadExtensionForMimeType(mimeType: string) {
  return getUploadExtensionsForMimeType(mimeType)[0] ?? null
}

const UNSAFE_UNTRUSTED_IMAGE_EXTENSIONS = new Set(["svg"])
const UNSAFE_UNTRUSTED_IMAGE_MIME_TYPES = new Set(["image/svg+xml"])

export function getSafeUntrustedImageExtensions(extensions: readonly string[]) {
  return Array.from(new Set(
    extensions
      .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
      .filter((item) => item && !UNSAFE_UNTRUSTED_IMAGE_EXTENSIONS.has(item)),
  ))
}

export function isSafeUntrustedImageMimeType(mimeType: string) {
  return !UNSAFE_UNTRUSTED_IMAGE_MIME_TYPES.has(mimeType.trim().toLowerCase())
}

export function isAllowedUploadMimeType(mimeType: string, allowedExtensions: readonly string[]) {
  const normalizedAllowedExtensions = new Set(
    allowedExtensions.map((item) => item.trim().toLowerCase()).filter(Boolean),
  )

  return getUploadExtensionsForMimeType(mimeType)
    .some((extension) => normalizedAllowedExtensions.has(extension))
}
