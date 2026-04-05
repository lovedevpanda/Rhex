import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import { mergeMarkdownImageUploadSettings, resolveMarkdownImageUploadSettings } from "@/lib/site-settings-app-state"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { normalizeUploadLocalPath } from "@/lib/upload-path"

export async function updateUploadSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "upload") {
    return null
  }

  const uploadProvider = readOptionalStringField(body, "uploadProvider") || "local"
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
  const uploadRequireLogin = Boolean(body.uploadRequireLogin)
  const uploadAllowedImageTypes = Array.from(new Set(readOptionalStringField(body, "uploadAllowedImageTypes").split(/[，,\s]+/).map((item) => item.trim().toLowerCase().replace(/^\./, "")).filter(Boolean)))
  const uploadMaxFileSizeMb = normalizePositiveInteger(body.uploadMaxFileSizeMb, 5)
  const uploadAvatarMaxFileSizeMb = normalizePositiveInteger(body.uploadAvatarMaxFileSizeMb, 2)
  const existingMarkdownImageUploadSettings = resolveMarkdownImageUploadSettings({
    appStateJson: existing.appStateJson,
    enabledFallback: true,
  })
  const markdownImageUploadEnabled = body.markdownImageUploadEnabled === undefined
    ? existingMarkdownImageUploadSettings.enabled
    : Boolean(body.markdownImageUploadEnabled)

  if (uploadAllowedImageTypes.length === 0) {
    apiError(400, "请至少配置一种允许上传的图片格式")
  }

  if (uploadAvatarMaxFileSizeMb > uploadMaxFileSizeMb) {
    apiError(400, "头像上传大小限制不能大于通用上传大小限制")
  }

  const appStateJson = mergeMarkdownImageUploadSettings(existing.appStateJson, {
    enabled: markdownImageUploadEnabled,
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
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "上传设置已保存",
  })
}

