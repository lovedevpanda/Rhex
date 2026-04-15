import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"
import type { UploadProvider } from "@/lib/upload-provider"

export interface SiteSettingsMarkdownEmojiItem {
  shortcode: string
  label: string
  icon: string
}

export interface SiteSettingsUploadData {
  uploadProvider: UploadProvider
  uploadLocalPath: string
  uploadBaseUrl?: string | null
  uploadOssBucket?: string | null
  uploadOssRegion?: string | null
  uploadOssEndpoint?: string | null
  uploadS3ForcePathStyle: boolean
  uploadRequireLogin: boolean
  uploadAllowedImageTypes: string[]
  uploadMaxFileSizeMb: number
  uploadAvatarMaxFileSizeMb: number
  markdownImageUploadEnabled: boolean
  imageWatermarkEnabled: boolean
  imageWatermarkText: string
  imageWatermarkPosition: ImageWatermarkPosition
  imageWatermarkTiled: boolean
  imageWatermarkOpacity: number
  imageWatermarkFontSize: number
  imageWatermarkFontFamily: string
  imageWatermarkMargin: number
  imageWatermarkColor: string
  imageWatermarkLogoPath: string
  imageWatermarkLogoScalePercent: number
  attachmentUploadEnabled: boolean
  attachmentDownloadEnabled: boolean
  attachmentMinUploadLevel: number
  attachmentMinUploadVipLevel: number
  attachmentAllowedExtensions: string[]
  attachmentMaxFileSizeMb: number
  markdownEmojiMapJson?: string | null
  markdownEmojiMap: SiteSettingsMarkdownEmojiItem[]
  appStateJson?: string | null
}
