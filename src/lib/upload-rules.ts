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

/**
 * 不允许被公开 `/uploads/<folder>/<file>` 直接读取的目录。
 *
 * `message-files`（私信附件）在代码里被当作私有资源：有专门的
 * `/api/messages/files/<uploadId>/<filename>` 代理做聊天参与者校验，
 * 并且用 404 而不是 403 防探测。但同一份文件也以**可预测的名字**
 * （内容 sha256 前 16 位）落在公开静态目录里，任何人猜到文件名即可无鉴权下载，
 * 绕过整条 ACL。因此公开路由直接拒绝这个目录，读取一律走带鉴权的代理。
 */
export const PRIVATE_UPLOAD_FOLDERS = ["message-files"] as const

const PRIVATE_UPLOAD_FOLDER_SET = new Set<string>(PRIVATE_UPLOAD_FOLDERS)

/** 该目录下的文件是否必须经鉴权代理读取 */
export function isPrivateUploadFolder(folder: string) {
  return PRIVATE_UPLOAD_FOLDER_SET.has(folder)
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

export function isAllowedUploadMimeType(mimeType: string, allowedExtensions: readonly string[]) {
  const normalizedAllowedExtensions = new Set(
    allowedExtensions.map((item) => item.trim().toLowerCase()).filter(Boolean),
  )

  return getUploadExtensionsForMimeType(mimeType)
    .some((extension) => normalizedAllowedExtensions.has(extension))
}
