import "server-only"

import path from "node:path"

import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"
import { getServerSiteSettings } from "@/lib/site-settings"
import { prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { isAllowedUploadMimeType, normalizeUploadExtension } from "@/lib/upload-rules"
import type {
  AddonFileSaveInput,
  AddonFileSaveResult,
  LoadedAddonRuntime,
} from "@/addons-host/types"

const DEFAULT_ADDON_FILE_FOLDER = "addons"
const DEFAULT_ADDON_FILE_MIME_TYPE = "image/png"
const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/i

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeMimeType(value: unknown, fallback = DEFAULT_ADDON_FILE_MIME_TYPE) {
  const normalized = normalizeOptionalString(value, fallback)
    .split(";")[0]
    ?.trim()
    .toLowerCase()

  return normalized || fallback
}

function normalizePositiveInteger(value: unknown) {
  const parsed = typeof value === "number"
    ? value
    : Number.parseInt(String(value ?? ""), 10)

  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : null
}

function normalizeAddonFileFolder(value: unknown) {
  const normalized = normalizeOptionalString(value, DEFAULT_ADDON_FILE_FOLDER)
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")

  if (!normalized) {
    return DEFAULT_ADDON_FILE_FOLDER
  }

  if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("插件文件目录只能包含字母、数字、点、下划线和短横线")
  }

  return normalized
}

function normalizeAddonFileName(value: unknown, fallback: string) {
  const baseName = path.basename(normalizeOptionalString(value, fallback).replace(/\\/g, "/"))
  const sanitized = baseName
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return sanitized || fallback
}

async function blobToBuffer(blob: Blob) {
  return Buffer.from(await blob.arrayBuffer())
}

function bufferToArrayBuffer(buffer: Buffer) {
  const copy = new Uint8Array(buffer.byteLength)
  copy.set(buffer)
  return copy.buffer
}

async function resolveInputBuffer(input: AddonFileSaveInput) {
  const dataUrl = normalizeOptionalString(input.dataUrl)
  if (dataUrl) {
    const matched = dataUrl.match(DATA_URL_PATTERN)
    if (!matched) {
      throw new Error("插件文件 dataUrl 格式不正确")
    }

    return {
      buffer: Buffer.from(matched[2], "base64"),
      mimeType: matched[1],
    }
  }

  const base64 = normalizeOptionalString(input.base64)
  if (base64) {
    return {
      buffer: Buffer.from(base64, "base64"),
      mimeType: null,
    }
  }

  const content = input.content ?? input.buffer
  if (!content) {
    throw new Error("缺少插件文件内容")
  }

  if (content instanceof Blob) {
    return {
      buffer: await blobToBuffer(content),
      mimeType: normalizeOptionalString(content.type) || null,
    }
  }

  if (content instanceof ArrayBuffer) {
    return {
      buffer: Buffer.from(content),
      mimeType: null,
    }
  }

  if (ArrayBuffer.isView(content)) {
    return {
      buffer: Buffer.from(content.buffer, content.byteOffset, content.byteLength),
      mimeType: null,
    }
  }

  throw new Error("不支持的插件文件内容类型")
}

function ensureAllowedExtension(fileName: string, mimeType: string, allowedExtensions: readonly string[]) {
  const extension = normalizeUploadExtension(fileName)
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error(`插件文件仅支持 ${allowedExtensions.join(" / ")} 格式的图片`)
  }

  if (!isAllowedUploadMimeType(mimeType, allowedExtensions)) {
    throw new Error(`插件文件真实格式不在允许范围内：${allowedExtensions.join(" / ")}`)
  }
}

function serializeAddonSavedFile(params: {
  saved: AddonFileSaveResult
  uploadId?: string | null
}): AddonFileSaveResult {
  return {
    uploadId: params.uploadId ?? params.saved.uploadId ?? null,
    fileName: params.saved.fileName,
    storagePath: params.saved.storagePath,
    urlPath: params.saved.urlPath,
    fileExt: params.saved.fileExt,
    fileSize: params.saved.fileSize,
    mimeType: params.saved.mimeType,
    fileHash: params.saved.fileHash,
  }
}

export async function saveAddonFile(
  addon: LoadedAddonRuntime,
  input: AddonFileSaveInput,
  request?: Request,
): Promise<AddonFileSaveResult> {
  const settings = await getServerSiteSettings()
  const folder = normalizeAddonFileFolder(input.folder || addon.manifest.id)
  const bucketType = normalizeAddonFileFolder(input.bucketType || folder)
  const userId = normalizePositiveInteger(input.userId)
  const username = normalizeOptionalString(input.username)
  const resolvedContent = await resolveInputBuffer(input)
  const mimeType = normalizeMimeType(input.mimeType, resolvedContent.mimeType || DEFAULT_ADDON_FILE_MIME_TYPE)
  const fileName = normalizeAddonFileName(input.fileName, `addon-file-${Date.now()}.png`)
  const file = new File([bufferToArrayBuffer(resolvedContent.buffer)], fileName, { type: mimeType })

  if (file.size <= 0) {
    throw new Error("插件文件不能为空")
  }

  const maxSizeMb = Number.isFinite(settings.uploadMaxFileSizeMb) && settings.uploadMaxFileSizeMb > 0
    ? settings.uploadMaxFileSizeMb
    : 5
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`插件文件不能超过 ${maxSizeMb}MB`)
  }

  const allowedExtensions = Array.from(new Set(
    settings.uploadAllowedImageTypes
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ))
  ensureAllowedExtension(file.name, mimeType, allowedExtensions)

  const preparedFile = await prepareUploadedFile(file, {
    folder,
    maxFileSizeBytes: maxSizeMb * 1024 * 1024,
    settings,
  })
  ensureAllowedExtension(file.name, preparedFile.detectedMime, allowedExtensions)

  if (userId) {
    const existing = await findExistingUpload(userId, bucketType, preparedFile.fileHash)
    if (existing) {
      return serializeAddonSavedFile({
        saved: {
          uploadId: existing.id,
          fileName: existing.fileName,
          storagePath: existing.storagePath,
          urlPath: existing.urlPath,
          fileExt: existing.fileExt,
          fileSize: existing.fileSize,
          mimeType: existing.mimeType,
          fileHash: existing.fileHash ?? preparedFile.fileHash,
        },
        uploadId: existing.id,
      })
    }
  }

  const saved = await saveUploadedFile(file, preparedFile, folder, {
    request,
    actor: userId
      ? {
        id: userId,
        username: username || `user-${userId}`,
        kind: "user",
      }
      : null,
  })

  if (!userId) {
    return {
      uploadId: null,
      ...saved,
    }
  }

  const upload = await createUploadRecord({
    userId,
    bucketType,
    originalName: file.name,
    saved,
  })

  return {
    uploadId: upload.id,
    fileName: upload.fileName,
    storagePath: upload.storagePath,
    urlPath: upload.urlPath,
    fileExt: upload.fileExt,
    fileSize: upload.fileSize,
    mimeType: upload.mimeType,
    fileHash: upload.fileHash ?? saved.fileHash,
  }
}
