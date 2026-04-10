import { createHash } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { getServerSiteSettings } from "@/lib/site-settings"
import { normalizeUploadProvider } from "@/lib/upload-provider"
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

type UploadSettings = Awaited<ReturnType<typeof getServerSiteSettings>>

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
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

function detectSvgMimeType(buffer: Buffer): string | null {
  const text = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()

  if (!text) {
    return null
  }

  if (/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype\s+svg[\s\S]*?>\s*)*<svg\b/i.test(text)) {
    return "image/svg+xml"
  }

  return null
}

/**
 * 单次读取整文件，复用同一块 Buffer 完成哈希计算、类型检测和后续写盘。
 */
export async function prepareUploadedFile(file: File): Promise<PreparedUploadFile> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedMime = detectMimeTypeFromBytes(buffer.subarray(0, 12)) ?? detectSvgMimeType(buffer)

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

function resolveS3ObjectKey(folder: string, fileName: string) {
  return `${folder}/${fileName}`.replace(/^\/+|\/+$/g, "")
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, "")
}

function resolveS3PublicUrl(settings: UploadSettings, objectKey: string) {
  const normalizedObjectKey = objectKey.replace(/^\/+/, "")
  if (settings.uploadBaseUrl?.trim()) {
    return `${trimTrailingSlash(settings.uploadBaseUrl.trim())}/${normalizedObjectKey}`
  }

  const endpoint = settings.uploadOssEndpoint?.trim()
  const bucket = settings.uploadOssBucket?.trim()
  if (!endpoint || !bucket) {
    throw new Error("对象存储访问地址无法生成，请补充资源访问基础 URL")
  }

  const parsedEndpoint = new URL(endpoint)
  if (settings.uploadS3ForcePathStyle) {
    return `${trimTrailingSlash(parsedEndpoint.toString())}/${bucket}/${normalizedObjectKey}`
  }

  parsedEndpoint.hostname = `${bucket}.${parsedEndpoint.hostname}`
  parsedEndpoint.pathname = `/${normalizedObjectKey}`
  parsedEndpoint.search = ""
  parsedEndpoint.hash = ""
  return parsedEndpoint.toString()
}

function validateOssSettings(settings: UploadSettings) {
  if (!settings.uploadOssBucket || !settings.uploadOssRegion || !settings.uploadOssEndpoint) {
    throw new Error("对象存储配置不完整，请先在后台上传设置中填写 Bucket、Region 和 Endpoint")
  }

  if (!settings.uploadS3AccessKeyId || !settings.uploadS3SecretAccessKey) {
    throw new Error("对象存储密钥不完整，请先在后台上传设置中填写 Access Key ID 和 Secret Access Key")
  }
}

async function saveToOss(
  file: File,
  preparedFile: PreparedUploadFile,
  folder: string,
  settings: UploadSettings,
): Promise<SavedUploadFile> {
  validateOssSettings(settings)
  const ext = path.extname(file.name) || ".bin"
  const shortHash = preparedFile.fileHash.slice(0, 16)
  const fileName = `${folder}-${shortHash}${ext}`
  const objectKey = resolveS3ObjectKey(folder, fileName)
  const client = new S3Client({
    region: settings.uploadOssRegion ?? "auto",
    endpoint: settings.uploadOssEndpoint ?? undefined,
    forcePathStyle: settings.uploadS3ForcePathStyle,
    credentials: {
      accessKeyId: settings.uploadS3AccessKeyId ?? "",
      secretAccessKey: settings.uploadS3SecretAccessKey ?? "",
    },
  })

  await client.send(new PutObjectCommand({
    Bucket: settings.uploadOssBucket ?? undefined,
    Key: objectKey,
    Body: preparedFile.buffer,
    ContentType: preparedFile.detectedMime,
    CacheControl: "public, max-age=31536000, immutable",
  }))

  return {
    fileName,
    storagePath: `s3://${settings.uploadOssBucket}/${objectKey}`,
    urlPath: resolveS3PublicUrl(settings, objectKey),
    fileExt: ext,
    fileSize: preparedFile.buffer.byteLength,
    mimeType: preparedFile.detectedMime,
    fileHash: preparedFile.fileHash,
  }
}

export async function saveUploadedFile(file: File, preparedFile: PreparedUploadFile, folder = "avatars"): Promise<SavedUploadFile> {
  const settings = await getServerSiteSettings()
  const uploadProvider = normalizeUploadProvider(settings.uploadProvider)

  if (uploadProvider === "local") {
    return saveToLocal(file, preparedFile, folder, settings.uploadLocalPath || "uploads", settings.uploadBaseUrl)
  }

  if (uploadProvider === "s3") {
    return saveToOss(file, preparedFile, folder, settings)
  }

  throw new Error(`不支持的上传策略：${settings.uploadProvider}`)
}
