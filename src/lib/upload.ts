import { createHash } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { getSiteSettings } from "@/lib/site-settings"

export interface SavedUploadFile {
  fileName: string
  storagePath: string
  urlPath: string
  fileExt: string
  fileSize: number
  mimeType: string
  fileHash: string
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
])

/**
 * 通过文件头魔数（magic bytes）检测真实 MIME 类型。
 * 不信任客户端传入的 file.type，防止伪造 Content-Type 绕过类型限制。
 */
function detectMimeTypeFromBytes(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif"
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp"
  // AVIF / HEIF: ftyp box at offset 4 with brand avif/heic/hei
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif"
  }
  return null
}

/** 计算文件内容的 SHA-256 十六进制摘要 */
export async function computeFileHash(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex")
}

/**
 * 以哈希值命名文件，保证同内容不重复写盘。
 * 文件名格式：{folder}-{hash8}.{ext}
 */
async function saveToLocal(
  file: File,
  folder: string,
  localPath: string,
  baseUrl: string | null | undefined,
  fileHash: string,
  detectedMime: string,
): Promise<SavedUploadFile> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = path.extname(file.name) || ".bin"
  const shortHash = fileHash.slice(0, 16)
  const fileName = `${folder}-${shortHash}${ext}`
  const uploadRoot = path.join(process.cwd(), "public", localPath || "uploads", folder)

  await mkdir(uploadRoot, { recursive: true })
  await writeFile(path.join(uploadRoot, fileName), buffer)

  const resolvedBaseUrl = baseUrl?.trim() || `/${localPath || "uploads"}`
  const urlPath = `${resolvedBaseUrl}/${folder}/${fileName}`.replace(/\\/g, "/")

  return {
    fileName,
    storagePath: path.join(uploadRoot, fileName),
    urlPath,
    fileExt: ext,
    fileSize: buffer.byteLength,
    mimeType: detectedMime,
    fileHash,
  }
}

function validateOssSettings(settings: Awaited<ReturnType<typeof getSiteSettings>>) {
  if (!settings.uploadOssBucket || !settings.uploadOssRegion || !settings.uploadOssEndpoint) {
    throw new Error("OSS 配置不完整，请先在后台上传设置中填写 Bucket、Region 和 Endpoint")
  }
}

async function saveToOss(
  file: File,
  folder: string,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
  fileHash: string,
): Promise<SavedUploadFile> {
  validateOssSettings(settings)
  void file
  void folder
  void fileHash
  throw new Error("当前版本已支持 OSS 配置校验，但尚未集成具体云厂商 SDK，请先使用本地上传或明确目标 OSS 服务后继续接入")
}

export async function saveUploadedFile(file: File, folder = "avatars", fileHash: string): Promise<SavedUploadFile> {
  const settings = await getSiteSettings()

  // 读取文件头以检测真实 MIME 类型，不信任客户端传入的 file.type
  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const detectedMime = detectMimeTypeFromBytes(headerBytes)

  if (!detectedMime || !IMAGE_MIME_TYPES.has(detectedMime)) {
    throw new Error("仅支持上传常见图片格式文件")
  }

  if (settings.uploadProvider === "local") {
    return saveToLocal(file, folder, settings.uploadLocalPath || "uploads", settings.uploadBaseUrl, fileHash, detectedMime)
  }

  if (settings.uploadProvider === "oss") {
    return saveToOss(file, folder, settings, fileHash)
  }

  throw new Error(`不支持的上传策略：${settings.uploadProvider}`)
}
