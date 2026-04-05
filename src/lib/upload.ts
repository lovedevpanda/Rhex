import { createHash } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { getSiteSettings } from "@/lib/site-settings"
import { buildUploadStoragePath, resolveUploadBaseUrl } from "@/lib/upload-path"

export interface SavedUploadFile {
  fileName: string
  storagePath: string
  urlPath: string
  fileExt: string
  fileSize: number
  mimeType: string
  fileHash: string
}

export interface PreparedUploadFile {
  buffer: Buffer
  fileHash: string
  detectedMime: string
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

/**
 * 单次读取整文件，复用同一块 Buffer 完成哈希计算、类型检测和后续写盘。
 */
export async function prepareUploadedFile(file: File): Promise<PreparedUploadFile> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedMime = detectMimeTypeFromBytes(buffer.subarray(0, 12))

  if (!detectedMime || !IMAGE_MIME_TYPES.has(detectedMime)) {
    throw new Error("仅支持上传常见图片格式文件")
  }

  return {
    buffer,
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    detectedMime,
  }
}

/**
 * 以哈希值命名文件，保证同内容不重复写盘。
 * 文件名格式：{folder}-{hash8}.{ext}
 */
async function saveToLocal(
  file: File,
  preparedFile: PreparedUploadFile,
  folder: string,
  localPath: string,
  baseUrl: string | null | undefined,
): Promise<SavedUploadFile> {
  const ext = path.extname(file.name) || ".bin"
  const shortHash = preparedFile.fileHash.slice(0, 16)
  const fileName = `${folder}-${shortHash}${ext}`
  const uploadRoot = buildUploadStoragePath(localPath, folder)

  await mkdir(uploadRoot, { recursive: true })
  await writeFile(path.join(uploadRoot, fileName), preparedFile.buffer)

  const resolvedBaseUrl = resolveUploadBaseUrl(baseUrl)
  const urlPath = `${resolvedBaseUrl}/${folder}/${fileName}`.replace(/\\/g, "/")

  return {
    fileName,
    storagePath: path.join(uploadRoot, fileName),
    urlPath,
    fileExt: ext,
    fileSize: preparedFile.buffer.byteLength,
    mimeType: preparedFile.detectedMime,
    fileHash: preparedFile.fileHash,
  }
}

function validateOssSettings(settings: Awaited<ReturnType<typeof getSiteSettings>>) {
  if (!settings.uploadOssBucket || !settings.uploadOssRegion || !settings.uploadOssEndpoint) {
    throw new Error("OSS 配置不完整，请先在后台上传设置中填写 Bucket、Region 和 Endpoint")
  }
}

async function saveToOss(
  file: File,
  preparedFile: PreparedUploadFile,
  folder: string,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
): Promise<SavedUploadFile> {
  validateOssSettings(settings)
  void file
  void preparedFile
  void folder
  throw new Error("当前版本已支持 OSS 配置校验，但尚未集成具体云厂商 SDK，请先使用本地上传或明确目标 OSS 服务后继续接入")
}

export async function saveUploadedFile(file: File, preparedFile: PreparedUploadFile, folder = "avatars"): Promise<SavedUploadFile> {
  const settings = await getSiteSettings()

  if (settings.uploadProvider === "local") {
    return saveToLocal(file, preparedFile, folder, settings.uploadLocalPath || "uploads", settings.uploadBaseUrl)
  }

  if (settings.uploadProvider === "oss") {
    return saveToOss(file, preparedFile, folder, settings)
  }

  throw new Error(`不支持的上传策略：${settings.uploadProvider}`)
}
