import path from "path"

const UPLOAD_PATH_FALLBACK = "uploads"
const UPLOAD_ROUTE_BASE_PATH = "/uploads"
const DEFAULT_UPLOAD_ROOT = path.join(process.cwd(), "uploads")
const DEFAULT_PUBLIC_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads")

function hasUnsafeUploadPathSegments(value: string) {
  return value
    .split("/")
    .some((segment) => segment === "." || segment === "..")
}

export function normalizeUploadLocalPath(value?: string | null, fallback = UPLOAD_PATH_FALLBACK) {
  const trimmedValue = value?.trim().replace(/\\/g, "/") ?? ""
  if (!trimmedValue) {
    return fallback
  }

  const normalizedValue = trimmedValue
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")

  if (!normalizedValue) {
    return fallback
  }

  if (hasUnsafeUploadPathSegments(normalizedValue)) {
    throw new Error("本地上传目录不允许包含 . 或 .. 路径段")
  }

  return normalizedValue
}

function trimKnownUploadRoot(value: string, rootPrefix: string) {
  if (value === rootPrefix) {
    return ""
  }

  if (value.startsWith(`${rootPrefix}/`)) {
    return value.slice(rootPrefix.length + 1)
  }

  return null
}

export function resolveUploadLocalRoot(value?: string | null) {
  const normalizedValue = normalizeUploadLocalPath(value)
  const legacyPublicRelativePath = trimKnownUploadRoot(normalizedValue, "public/uploads")

  if (legacyPublicRelativePath !== null) {
    return path.join(DEFAULT_PUBLIC_UPLOAD_ROOT, legacyPublicRelativePath)
  }

  const legacyRootRelativePath = trimKnownUploadRoot(normalizedValue, "uploads")

  if (legacyRootRelativePath !== null) {
    return path.join(DEFAULT_UPLOAD_ROOT, legacyRootRelativePath)
  }

  return path.join(DEFAULT_UPLOAD_ROOT, normalizedValue)
}

export function buildUploadStoragePath(value?: string | null, ...segments: string[]) {
  return path.join(resolveUploadLocalRoot(value), ...segments)
}

export function resolveUploadBaseUrl(value?: string | null) {
  const normalizedValue = value?.trim().replace(/\/+$/g, "") ?? ""
  return normalizedValue || UPLOAD_ROUTE_BASE_PATH
}
