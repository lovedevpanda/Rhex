import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import { mergeAttachmentFeatureSettings, mergeImageWatermarkSettings, mergeMarkdownImageUploadSettings, mergeMessageMediaSettings, mergeUploadObjectStorageSettings, resolveAttachmentFeatureSettings, resolveImageWatermarkSettings, resolveMarkdownImageUploadSettings, resolveMessageMediaSettings, resolveUploadObjectStorageSettings, type ImageWatermarkPosition } from "@/lib/site-settings-app-state"
import { normalizeNonNegativeInteger, normalizePositiveInteger } from "@/lib/shared/normalizers"
import { mergeUploadStorageSensitiveConfig, resolveUploadStorageSensitiveConfig } from "@/lib/site-settings-sensitive-state"
import { normalizeUploadLocalPath } from "@/lib/upload-path"
import { normalizeUploadProvider } from "@/lib/upload-provider"
import { WATERMARK_TEXT_MAX_LENGTH } from "@/lib/watermark-lib"

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
  const existingImageWatermarkSettings = resolveImageWatermarkSettings({
    appStateJson: existing.appStateJson,
    enabledFallback: false,
    textFallback: "",
    positionFallback: "BOTTOM_RIGHT",
    tiledFallback: false,
    opacityFallback: 22,
    fontSizeFallback: 24,
    fontFamilyFallback: "",
    marginFallback: 24,
    colorFallback: "#FFFFFF",
    logoPathFallback: "",
    logoScalePercentFallback: 16,
  })
  const existingAttachmentFeatureSettings = resolveAttachmentFeatureSettings({
    appStateJson: existing.appStateJson,
    uploadEnabledFallback: false,
    downloadEnabledFallback: false,
    minUploadLevelFallback: 0,
    minUploadVipLevelFallback: 0,
    allowedExtensionsFallback: ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"],
    maxFileSizeMbFallback: 20,
  })
  const existingMessageMediaSettings = resolveMessageMediaSettings({
    appStateJson: existing.appStateJson,
    imageUploadEnabledFallback: false,
    fileUploadEnabledFallback: false,
  })
  const existingUploadObjectStorageSettings = resolveUploadObjectStorageSettings({
    appStateJson: existing.appStateJson,
    forcePathStyleFallback: true,
  })
  const markdownImageUploadEnabled = body.markdownImageUploadEnabled === undefined
    ? existingMarkdownImageUploadSettings.enabled
    : Boolean(body.markdownImageUploadEnabled)
  const imageWatermarkEnabled = body.imageWatermarkEnabled === undefined
    ? existingImageWatermarkSettings.enabled
    : Boolean(body.imageWatermarkEnabled)
  const imageWatermarkText = readOptionalStringField(body, "imageWatermarkText") || existingImageWatermarkSettings.text
  const imageWatermarkPosition = (readOptionalStringField(body, "imageWatermarkPosition") || existingImageWatermarkSettings.position) as ImageWatermarkPosition
  const imageWatermarkTiled = body.imageWatermarkTiled === undefined
    ? existingImageWatermarkSettings.tiled
    : Boolean(body.imageWatermarkTiled)
  const imageWatermarkOpacity = normalizeNonNegativeInteger(body.imageWatermarkOpacity, existingImageWatermarkSettings.opacity)
  const imageWatermarkFontSize = normalizePositiveInteger(body.imageWatermarkFontSize, existingImageWatermarkSettings.fontSize)
  const imageWatermarkFontFamily = body.imageWatermarkFontFamily === undefined
    ? existingImageWatermarkSettings.fontFamily
    : readOptionalStringField(body, "imageWatermarkFontFamily")
  const imageWatermarkMargin = normalizeNonNegativeInteger(body.imageWatermarkMargin, existingImageWatermarkSettings.margin)
  const imageWatermarkColor = readOptionalStringField(body, "imageWatermarkColor") || existingImageWatermarkSettings.color
  const imageWatermarkLogoPath = readOptionalStringField(body, "imageWatermarkLogoPath") || existingImageWatermarkSettings.logoPath
  const imageWatermarkLogoScalePercent = normalizePositiveInteger(body.imageWatermarkLogoScalePercent, existingImageWatermarkSettings.logoScalePercent)
  const attachmentUploadEnabled = body.attachmentUploadEnabled === undefined
    ? existingAttachmentFeatureSettings.uploadEnabled
    : Boolean(body.attachmentUploadEnabled)
  const attachmentDownloadEnabled = body.attachmentDownloadEnabled === undefined
    ? existingAttachmentFeatureSettings.downloadEnabled
    : Boolean(body.attachmentDownloadEnabled)
  const attachmentMinUploadLevel = normalizeNonNegativeInteger(body.attachmentMinUploadLevel, existingAttachmentFeatureSettings.minUploadLevel)
  const attachmentMinUploadVipLevel = normalizeNonNegativeInteger(body.attachmentMinUploadVipLevel, existingAttachmentFeatureSettings.minUploadVipLevel)
  const attachmentAllowedExtensions = Array.from(new Set(readOptionalStringField(body, "attachmentAllowedExtensions").split(/[，,\s]+/).map((item) => item.trim().toLowerCase().replace(/^\./, "")).filter(Boolean)))
  const attachmentMaxFileSizeMb = normalizePositiveInteger(body.attachmentMaxFileSizeMb, existingAttachmentFeatureSettings.maxFileSizeMb)
  const messageImageUploadEnabled = body.messageImageUploadEnabled === undefined
    ? existingMessageMediaSettings.imageUploadEnabled
    : Boolean(body.messageImageUploadEnabled)
  const messageFileUploadEnabled = body.messageFileUploadEnabled === undefined
    ? existingMessageMediaSettings.fileUploadEnabled
    : Boolean(body.messageFileUploadEnabled)
  const uploadS3ForcePathStyle = body.uploadS3ForcePathStyle === undefined
    ? existingUploadObjectStorageSettings.forcePathStyle
    : Boolean(body.uploadS3ForcePathStyle)

  if (uploadAllowedImageTypes.length === 0) {
    apiError(400, "请至少配置一种允许上传的图片格式")
  }

  if (uploadAvatarMaxFileSizeMb > uploadMaxFileSizeMb) {
    apiError(400, "头像上传大小限制不能大于通用上传大小限制")
  }

  if (attachmentAllowedExtensions.length === 0) {
    apiError(400, "请至少配置一种允许上传的附件格式")
  }

  if (imageWatermarkEnabled && !imageWatermarkText.trim()) {
    apiError(400, "启用图片水印时请填写水印文字")
  }

  if (imageWatermarkText.length > WATERMARK_TEXT_MAX_LENGTH) {
    apiError(400, `水印文字长度不能超过 ${WATERMARK_TEXT_MAX_LENGTH} 个字符`)
  }

  const appStateWithMarkdownImageUpload = mergeMarkdownImageUploadSettings(existing.appStateJson, {
    enabled: markdownImageUploadEnabled,
  })
  const appStateWithImageWatermark = mergeImageWatermarkSettings(appStateWithMarkdownImageUpload, {
    enabled: imageWatermarkEnabled,
    text: imageWatermarkText,
    position: imageWatermarkPosition,
    tiled: imageWatermarkTiled,
    opacity: imageWatermarkOpacity,
    fontSize: imageWatermarkFontSize,
    fontFamily: imageWatermarkFontFamily,
    margin: imageWatermarkMargin,
    color: imageWatermarkColor,
    logoPath: imageWatermarkLogoPath,
    logoScalePercent: imageWatermarkLogoScalePercent,
  })
  const appStateWithAttachmentFeature = mergeAttachmentFeatureSettings(appStateWithImageWatermark, {
    uploadEnabled: attachmentUploadEnabled,
    downloadEnabled: attachmentDownloadEnabled,
    minUploadLevel: attachmentMinUploadLevel,
    minUploadVipLevel: attachmentMinUploadVipLevel,
    allowedExtensions: attachmentAllowedExtensions,
    maxFileSizeMb: attachmentMaxFileSizeMb,
  })
  const appStateWithMessageMedia = mergeMessageMediaSettings(appStateWithAttachmentFeature, {
    imageUploadEnabled: messageImageUploadEnabled,
    fileUploadEnabled: messageFileUploadEnabled,
  })
  const appStateJson = mergeUploadObjectStorageSettings(appStateWithMessageMedia, {
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
