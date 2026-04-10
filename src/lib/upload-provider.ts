export type UploadProvider = "local" | "s3"

export function normalizeUploadProvider(value: unknown): UploadProvider {
  if (value === "s3" || value === "oss") {
    return "s3"
  }

  return "local"
}

export function isRemoteUploadProvider(value: unknown) {
  return normalizeUploadProvider(value) === "s3"
}
