import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import { mergeMarkdownImageUploadSettings, mergeUploadObjectStorageSettings, resolveMarkdownImageUploadSettings, resolveUploadObjectStorageSettings } from "@/lib/site-settings-app-state"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { mergeUploadStorageSensitiveConfig, resolveUploadStorageSensitiveConfig } from "@/lib/site-settings-sensitive-state"
import { normalizeUploadLocalPath } from "@/lib/upload-path"
import { normalizeUploadProvider } from "@/lib/upload-provider"

export async function updateUploadSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "upload") {
    return null
  }

  const uploadProvider = normalizeUploadProvider(readOptionalStringField(body, "uploadProvider"))
  let uploadLocalPath = "uploads"
  try {
    uploadLocalPath = normalizeUploadLocalPath(readOptionalStringField(body, "uploadLocalPath"))
  } catch (error) {
    apiError(400, error instanceof Error ? error.message : "本地上传目录配置不合法")
  }
  const uploadBaseUrl = readOptionalStringField(body, "uploadBaseUrl") || null
  const uploadOssBucket = readOptionalStringField(body, "uploadOssBucket") || null
  const uploadOssRegion = readOptionalStringField(body, "uploadOssRegion") || null
  const uploadOssEndpoint = readOptionalStringField(body, "uploadOssEndpoint") || null
  const uploadS3AccessKeyId = readOptionalStringField(body, "uploadS3AccessKeyId") || null
  const uploadS3SecretAccessKey = readOptionalStringField(body, "uploadS3SecretAccessKey") || null
  const uploadRequireLogin = Boolean(body.uploadRequireLogin)
  const uploadAllowedImageTypes = Array.from(new Set(readOptionalStringField(body, "uploadAllowedImageTypes").split(/[，,\s]+/).map((item) => item.trim().toLowerCase().replace(/^\./, "")).filter(Boolean)))
  const uploadMaxFileSizeMb = normalizePositiveInteger(body.uploadMaxFileSizeMb, 5)
  const uploadAvatarMaxFileSizeMb = normalizePositiveInteger(body.uploadAvatarMaxFileSizeMb, 2)
  const existingMarkdownImageUploadSettings = resolveMarkdownImageUploadSettings({
    appStateJson: existing.appStateJson,
    enabledFallback: true,
  })
  const existingUploadObjectStorageSettings = resolveUploadObjectStorageSettings({
    appStateJson: existing.appStateJson,
    forcePathStyleFallback: true,
  })
  const markdownImageUploadEnabled = body.markdownImageUploadEnabled === undefined
    ? existingMarkdownImageUploadSettings.enabled
    : Boolean(body.markdownImageUploadEnabled)
  const uploadS3ForcePathStyle = body.uploadS3ForcePathStyle === undefined
    ? existingUploadObjectStorageSettings.forcePathStyle
    : Boolean(body.uploadS3ForcePathStyle)

  if (uploadAllowedImageTypes.length === 0) {
    apiError(400, "请至少配置一种允许上传的图片格式")
  }

  if (uploadAvatarMaxFileSizeMb > uploadMaxFileSizeMb) {
    apiError(400, "头像上传大小限制不能大于通用上传大小限制")
  }

  const appStateWithMarkdownImageUpload = mergeMarkdownImageUploadSettings(existing.appStateJson, {
    enabled: markdownImageUploadEnabled,
  })
  const appStateJson = mergeUploadObjectStorageSettings(appStateWithMarkdownImageUpload, {
    forcePathStyle: uploadS3ForcePathStyle,
  })
  const currentSensitiveStateJson = ("sensitiveStateJson" in existing ? existing.sensitiveStateJson : null) ?? null
  const existingUploadSensitiveConfig = resolveUploadStorageSensitiveConfig(currentSensitiveStateJson)
  const nextUploadS3AccessKeyId = uploadProvider === "s3"
    ? (uploadS3AccessKeyId || existingUploadSensitiveConfig.accessKeyId)
    : null
  const nextUploadS3SecretAccessKey = uploadProvider === "s3"
    ? (uploadS3SecretAccessKey || existingUploadSensitiveConfig.secretAccessKey)
    : null

  if (uploadProvider === "s3" && (!uploadOssBucket || !uploadOssRegion || !uploadOssEndpoint || !nextUploadS3AccessKeyId || !nextUploadS3SecretAccessKey)) {
    apiError(400, "对象存储模式下必须完整填写 Bucket、Region、Endpoint、Access Key ID 和 Secret Access Key")
  }

  const sensitiveStateJson = mergeUploadStorageSensitiveConfig(currentSensitiveStateJson, {
    accessKeyId: nextUploadS3AccessKeyId,
    secretAccessKey: nextUploadS3SecretAccessKey,
  })

  const settings = await updateSiteSettingsRecord(existing.id, {
    uploadProvider,
    uploadLocalPath,
    uploadBaseUrl,
    uploadOssBucket,
    uploadOssRegion,
    uploadOssEndpoint,
    uploadRequireLogin,
    uploadAllowedImageTypes: uploadAllowedImageTypes.join(","),
    uploadMaxFileSizeMb,
    uploadAvatarMaxFileSizeMb,
    appStateJson,
    sensitiveStateJson,
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "上传设置已保存",
  })
}
