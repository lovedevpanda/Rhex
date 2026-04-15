import {
  isRecord,
  normalizeFileExtensionList,
  normalizeHexColor,
  normalizeImageWatermarkPosition,
  normalizeNonNegativeInteger,
  readSiteSettingsState,
  writeSiteSettingsState,
} from "@/lib/site-settings-app-state.types"
import type {
  AttachmentFeatureSettings,
  ImageWatermarkPosition,
  ImageWatermarkSettings,
  MarkdownImageUploadSettings,
  UploadObjectStorageSettings,
} from "@/lib/site-settings-app-state.types"

export function resolveMarkdownImageUploadSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): MarkdownImageUploadSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const markdownImageUpload = isRecord(siteSettingsState.markdownImageUpload)
    ? siteSettingsState.markdownImageUpload
    : {}

  return {
    enabled:
      typeof markdownImageUpload.enabled === "boolean"
        ? markdownImageUpload.enabled
        : options.enabledFallback ?? true,
  }
}

export function mergeMarkdownImageUploadSettings(
  appStateJson: string | null | undefined,
  input: MarkdownImageUploadSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    markdownImageUpload: {
      enabled: input.enabled,
    },
  })
}

export function resolveImageWatermarkSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  textFallback?: string
  positionFallback?: ImageWatermarkPosition
  tiledFallback?: boolean
  opacityFallback?: number
  fontSizeFallback?: number
  fontFamilyFallback?: string
  marginFallback?: number
  colorFallback?: string
  logoPathFallback?: string
  logoScalePercentFallback?: number
} = {}): ImageWatermarkSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const imageWatermark = isRecord(siteSettingsState.imageWatermark)
    ? siteSettingsState.imageWatermark
    : {}

  return {
    enabled:
      typeof imageWatermark.enabled === "boolean"
        ? imageWatermark.enabled
        : options.enabledFallback ?? false,
    text:
      typeof imageWatermark.text === "string"
        ? imageWatermark.text.trim().slice(0, 120)
        : (options.textFallback ?? "").trim().slice(0, 120),
    position: normalizeImageWatermarkPosition(
      imageWatermark.position,
      options.positionFallback ?? "BOTTOM_RIGHT",
    ),
    tiled:
      typeof imageWatermark.tiled === "boolean"
        ? imageWatermark.tiled
        : options.tiledFallback ?? false,
    opacity: Math.min(
      100,
      Math.max(
        0,
        normalizeNonNegativeInteger(
          imageWatermark.opacity,
          normalizeNonNegativeInteger(options.opacityFallback, 22),
        ),
      ),
    ),
    fontSize: Math.min(
      160,
      Math.max(
        8,
        normalizeNonNegativeInteger(
          imageWatermark.fontSize,
          normalizeNonNegativeInteger(options.fontSizeFallback, 24),
        ),
      ),
    ),
    fontFamily:
      typeof imageWatermark.fontFamily === "string"
        ? imageWatermark.fontFamily.replace(/\s+/g, " ").trim().slice(0, 240)
        : (options.fontFamilyFallback ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    margin: Math.min(
      200,
      Math.max(
        0,
        normalizeNonNegativeInteger(
          imageWatermark.margin,
          normalizeNonNegativeInteger(options.marginFallback, 24),
        ),
      ),
    ),
    color: normalizeHexColor(
      imageWatermark.color,
      normalizeHexColor(options.colorFallback, "#FFFFFF"),
    ),
    logoPath:
      typeof imageWatermark.logoPath === "string"
        ? imageWatermark.logoPath.trim().slice(0, 1000)
        : (options.logoPathFallback ?? "").trim().slice(0, 1000),
    logoScalePercent: Math.min(
      60,
      Math.max(
        1,
        normalizeNonNegativeInteger(
          imageWatermark.logoScalePercent,
          normalizeNonNegativeInteger(options.logoScalePercentFallback, 16),
        ),
      ),
    ),
  }
}

export function mergeImageWatermarkSettings(
  appStateJson: string | null | undefined,
  input: ImageWatermarkSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    imageWatermark: {
      enabled: Boolean(input.enabled),
      text: String(input.text ?? "").trim().slice(0, 120),
      position: normalizeImageWatermarkPosition(input.position, "BOTTOM_RIGHT"),
      tiled: Boolean(input.tiled),
      opacity: Math.min(100, Math.max(0, normalizeNonNegativeInteger(input.opacity, 22))),
      fontSize: Math.min(160, Math.max(8, normalizeNonNegativeInteger(input.fontSize, 24))),
      fontFamily: String(input.fontFamily ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
      margin: Math.min(200, Math.max(0, normalizeNonNegativeInteger(input.margin, 24))),
      color: normalizeHexColor(input.color, "#FFFFFF"),
      logoPath: String(input.logoPath ?? "").trim().slice(0, 1000),
      logoScalePercent: Math.min(60, Math.max(1, normalizeNonNegativeInteger(input.logoScalePercent, 16))),
    },
  })
}

export function resolveAttachmentFeatureSettings(options: {
  appStateJson?: string | null
  uploadEnabledFallback?: boolean
  downloadEnabledFallback?: boolean
  minUploadLevelFallback?: number
  minUploadVipLevelFallback?: number
  allowedExtensionsFallback?: string[]
  maxFileSizeMbFallback?: number
} = {}): AttachmentFeatureSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const attachments = isRecord(siteSettingsState.attachments)
    ? siteSettingsState.attachments
    : {}
  const fallbackAllowedExtensions = Array.from(
    new Set(
      (options.allowedExtensionsFallback ?? [
        "zip",
        "rar",
        "7z",
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "txt",
      ])
        .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    ),
  )

  return {
    uploadEnabled:
      typeof attachments.uploadEnabled === "boolean"
        ? attachments.uploadEnabled
        : typeof attachments.enabled === "boolean"
          ? attachments.enabled
          : options.uploadEnabledFallback ?? false,
    downloadEnabled:
      typeof attachments.downloadEnabled === "boolean"
        ? attachments.downloadEnabled
        : typeof attachments.enabled === "boolean"
          ? attachments.enabled
          : options.downloadEnabledFallback ?? false,
    minUploadLevel: normalizeNonNegativeInteger(
      attachments.minUploadLevel,
      normalizeNonNegativeInteger(options.minUploadLevelFallback, 0),
    ),
    minUploadVipLevel: normalizeNonNegativeInteger(
      attachments.minUploadVipLevel,
      normalizeNonNegativeInteger(options.minUploadVipLevelFallback, 0),
    ),
    allowedExtensions: normalizeFileExtensionList(
      attachments.allowedExtensions,
      fallbackAllowedExtensions,
    ),
    maxFileSizeMb: Math.max(
      1,
      normalizeNonNegativeInteger(
        attachments.maxFileSizeMb,
        normalizeNonNegativeInteger(options.maxFileSizeMbFallback, 20),
      ),
    ),
  }
}

export function mergeAttachmentFeatureSettings(
  appStateJson: string | null | undefined,
  input: AttachmentFeatureSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const allowedExtensions = Array.from(
    new Set(
      input.allowedExtensions
        .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    ),
  )

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    attachments: {
      uploadEnabled: Boolean(input.uploadEnabled),
      downloadEnabled: Boolean(input.downloadEnabled),
      minUploadLevel: normalizeNonNegativeInteger(input.minUploadLevel, 0),
      minUploadVipLevel: normalizeNonNegativeInteger(input.minUploadVipLevel, 0),
      allowedExtensions:
        allowedExtensions.length > 0
          ? allowedExtensions
          : ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"],
      maxFileSizeMb: Math.max(1, normalizeNonNegativeInteger(input.maxFileSizeMb, 20)),
    },
  })
}

export function resolveUploadObjectStorageSettings(options: {
  appStateJson?: string | null
  forcePathStyleFallback?: boolean
} = {}): UploadObjectStorageSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const uploadObjectStorage = isRecord(siteSettingsState.uploadObjectStorage)
    ? siteSettingsState.uploadObjectStorage
    : {}

  return {
    forcePathStyle:
      typeof uploadObjectStorage.forcePathStyle === "boolean"
        ? uploadObjectStorage.forcePathStyle
        : options.forcePathStyleFallback ?? true,
  }
}

export function mergeUploadObjectStorageSettings(
  appStateJson: string | null | undefined,
  input: UploadObjectStorageSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    uploadObjectStorage: {
      forcePathStyle: input.forcePathStyle,
    },
  })
}
