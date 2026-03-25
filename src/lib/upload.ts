import { mkdir, writeFile } from "fs/promises"
import path from "path"

import { getSiteSettings } from "@/lib/site-settings"

interface SavedUploadFile {
  fileName: string
  storagePath: string
  urlPath: string
  fileExt: string
  fileSize: number
  mimeType: string
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
])


function normalizeFileName(fileName: string) {

  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-")
}

async function saveToLocal(file: File, folder: string, localPath: string, baseUrl?: string | null): Promise<SavedUploadFile> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = path.extname(file.name) || ".bin"
  const timestamp = Date.now()
  const fileName = `${folder}-${timestamp}-${normalizeFileName(file.name || "file")}`
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
    mimeType: file.type || "application/octet-stream",
  }
}

function validateOssSettings(settings: Awaited<ReturnType<typeof getSiteSettings>>) {
  if (!settings.uploadOssBucket || !settings.uploadOssRegion || !settings.uploadOssEndpoint) {
    throw new Error("OSS 配置不完整，请先在后台上传设置中填写 Bucket、Region 和 Endpoint")
  }
}

async function saveToOss(file: File, folder: string, settings: Awaited<ReturnType<typeof getSiteSettings>>): Promise<SavedUploadFile> {
  validateOssSettings(settings)
  void file
  void folder
  throw new Error("当前版本已支持 OSS 配置校验，但尚未集成具体云厂商 SDK，请先使用本地上传或明确目标 OSS 服务后继续接入")
}

export async function saveUploadedFile(file: File, folder = "avatars"): Promise<SavedUploadFile> {
  const settings = await getSiteSettings()

  if (!IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("仅支持上传常见图片格式文件")
  }

  if (settings.uploadProvider === "local") {
    return saveToLocal(file, folder, settings.uploadLocalPath || "uploads", settings.uploadBaseUrl)
  }

  if (settings.uploadProvider === "oss") {
    return saveToOss(file, folder, settings)
  }

  throw new Error(`不支持的上传策略：${settings.uploadProvider}`)
}


