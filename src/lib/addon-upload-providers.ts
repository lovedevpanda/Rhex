import "server-only"

import path from "node:path"

import type {
  AddonUploadActor,
  AddonUploadPreparedFile,
  AddonUploadProviderRuntimeHooks,
  AddonUploadProviderTransformResult,
} from "@/addons-host/upload-types"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"
import type { SavedUploadFile } from "@/lib/upload"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeTransformBuffer(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const buffer = value.buffer
  if (buffer instanceof Uint8Array && buffer.byteLength > 0) {
    return buffer
  }

  return null
}

export async function transformWithAddonUploadProviders(input: {
  request?: Request
  actor?: AddonUploadActor | null
  file: File
  preparedFile: AddonUploadPreparedFile
  folder: string
  normalizeTransformedFile: (
    result: AddonUploadProviderTransformResult,
  ) => AddonUploadPreparedFile | Promise<AddonUploadPreparedFile>
}): Promise<AddonUploadPreparedFile> {
  const providers = await listAddonProviderRuntimeItems<AddonUploadProviderRuntimeHooks>(
    "upload",
    input.request ? { request: input.request } : undefined,
  )
  let preparedFile = input.preparedFile

  for (const item of providers) {
    const runtime = item.runtime
    if (typeof runtime?.transformFile !== "function") {
      continue
    }

    const output = await invokeAddonProviderRuntime(
      item,
      "transformFile",
      () => ({
        addon: item.addon,
        provider: item.provider,
        context: item.context,
        request: input.request,
        actor: input.actor,
        file: input.file,
        preparedFile,
        folder: input.folder,
      }),
    )

    if (typeof output === "undefined" || output === null) {
      continue
    }

    const buffer = normalizeTransformBuffer(output)
    if (!buffer) {
      throw new Error(
        `addon upload provider "${item.provider.code}" returned an invalid transform result`,
      )
    }

    preparedFile = await input.normalizeTransformedFile({ buffer })
  }

  return preparedFile
}

function resolveFallbackFileName(urlPath: string, folder: string, preparedFile: AddonUploadPreparedFile, originalName: string) {
  const normalizedUrlPath = urlPath.replace(/\\/g, "/")
  const fromUrl = (() => {
    try {
      return path.posix.basename(new URL(normalizedUrlPath).pathname)
    } catch {
      return path.posix.basename(normalizedUrlPath)
    }
  })()
  const extension = path.extname(fromUrl || originalName || "") || ".bin"
  return fromUrl || `${folder}-${preparedFile.fileHash.slice(0, 16)}${extension}`
}

function normalizeAddonUploadResult(input: {
  value: unknown
  folder: string
  file: File
  preparedFile: AddonUploadPreparedFile
}): SavedUploadFile | null {
  if (!isRecord(input.value)) {
    return null
  }

  const urlPath = normalizeOptionalString(input.value.urlPath)
  if (!urlPath) {
    return null
  }

  const fileName = normalizeOptionalString(input.value.fileName)
    || resolveFallbackFileName(urlPath, input.folder, input.preparedFile, input.file.name)
  const fileExt = normalizeOptionalString(input.value.fileExt)
    || path.extname(fileName || input.file.name || "")
    || ".bin"

  return {
    fileName,
    storagePath: normalizeOptionalString(input.value.storagePath) || `remote:${urlPath}`,
    urlPath,
    fileExt,
    fileSize:
      typeof input.value.fileSize === "number" && Number.isFinite(input.value.fileSize) && input.value.fileSize > 0
        ? input.value.fileSize
        : input.preparedFile.fileSize,
    mimeType: normalizeOptionalString(input.value.mimeType) || input.preparedFile.detectedMime,
    fileHash: normalizeOptionalString(input.value.fileHash) || input.preparedFile.fileHash,
  }
}

export async function saveWithAddonUploadProvider(input: {
  request?: Request
  actor?: AddonUploadActor | null
  file: File
  preparedFile: AddonUploadPreparedFile
  folder: string
}): Promise<SavedUploadFile | null> {
  const providers = await listAddonProviderRuntimeItems<AddonUploadProviderRuntimeHooks>(
    "upload",
    input.request ? { request: input.request } : undefined,
  )

  for (const item of providers) {
    const runtime = item.runtime
    if (typeof runtime?.uploadFile !== "function") {
      continue
    }

    const output = await invokeAddonProviderRuntime(
      item,
      "uploadFile",
      () => ({
        addon: item.addon,
        provider: item.provider,
        context: item.context,
        request: input.request,
        actor: input.actor,
        file: input.file,
        preparedFile: input.preparedFile,
        folder: input.folder,
      }),
    )

    if (typeof output === "undefined" || output === null) {
      continue
    }

    const normalized = normalizeAddonUploadResult({
      value: output,
      folder: input.folder,
      file: input.file,
      preparedFile: input.preparedFile,
    })

    if (!normalized) {
      throw new Error(
        `addon upload provider "${item.provider.code}" returned an invalid upload result`,
      )
    }

    return normalized
  }

  return null
}
