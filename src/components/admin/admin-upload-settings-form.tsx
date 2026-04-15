"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useDeferredValue, useEffect, useState, useTransition } from "react"

import { AccessThresholdSelectGroup } from "@/components/access-threshold-select-group"
import {
  SettingsInputField,
  SettingsSection,
  SettingsSelectField,
  SettingsToggleField,
} from "@/components/admin/admin-settings-fields"
import { AdminSettingsSubTabs } from "@/components/admin/admin-settings-sub-tabs"
import { ColorPicker, normalizeHexColor } from "@/components/ui/color-picker"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import { saveAdminSiteSettings } from "@/lib/admin-site-settings-client"
import { getAdminSettingsHref } from "@/lib/admin-settings-navigation"
import type { AdminSettingsSectionKey } from "@/lib/admin-navigation"
import type { UploadProvider } from "@/lib/upload-provider"
import type { ImageWatermarkPosition } from "@/lib/site-settings-app-state"

interface AdminUploadSettingsFormProps {
  initialSettings: {
    uploadProvider: UploadProvider
    uploadLocalPath: string
    uploadBaseUrl?: string | null
    uploadOssBucket?: string | null
    uploadOssRegion?: string | null
    uploadOssEndpoint?: string | null
    uploadS3CredentialsConfigured: boolean
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
    attachmentUploadEnabled: boolean
    attachmentDownloadEnabled: boolean
    attachmentMinUploadLevel: number
    attachmentMinUploadVipLevel: number
    attachmentAllowedExtensions: string[]
    attachmentMaxFileSizeMb: number
  }
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  initialSubTab?: string
  tabRouteSection?: AdminSettingsSectionKey
}

function normalizeStringList(value: string[] | undefined, fallback: string[]) {
  return Array.isArray(value) && value.length > 0 ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeSliderNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return clamp(Number.isFinite(parsed) ? Math.round(parsed) : fallback, min, max)
}

type UploadSettingsTabKey = "storage" | "watermark" | "attachment"
type WatermarkFontPresetKey = "default" | "zhimangxing" | "yahei" | "pingfang" | "noto-sans" | "simhei" | "kaiti" | "custom"

const UPLOAD_TABS = [
  { key: "storage", label: "上传配置" },
  { key: "watermark", label: "水印配置" },
  { key: "attachment", label: "附件配置" },
] as const

const WATERMARK_FONT_PRESETS: Array<{
  key: Exclude<WatermarkFontPresetKey, "custom">
  label: string
  value: string
}> = [
  { key: "default", label: "默认字体栈", value: "" },
  { key: "zhimangxing", label: "芝麻行草", value: '"Zhi Mang Xing", cursive' },
  { key: "yahei", label: "微软雅黑", value: '"Microsoft YaHei", sans-serif' },
  { key: "pingfang", label: "苹方", value: '"PingFang SC", "Hiragino Sans GB", sans-serif' },
  { key: "noto-sans", label: "思源黑体", value: '"Noto Sans SC", "Source Han Sans SC", sans-serif' },
  { key: "simhei", label: "黑体", value: '"SimHei", sans-serif' },
  { key: "kaiti", label: "楷体", value: '"KaiTi", serif' },
]

function normalizeFontFamilyValue(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function resolveWatermarkFontPresetKey(value: string): WatermarkFontPresetKey {
  const normalizedValue = normalizeFontFamilyValue(value)
  const matchedPreset = WATERMARK_FONT_PRESETS.find((preset) => normalizeFontFamilyValue(preset.value) === normalizedValue)
  return matchedPreset?.key ?? "custom"
}

function resolveUploadTab(initialSubTab?: string): UploadSettingsTabKey {
  return UPLOAD_TABS.some((item) => item.key === initialSubTab)
    ? (initialSubTab as UploadSettingsTabKey)
    : "storage"
}

export function AdminUploadSettingsForm({
  initialSettings,
  levelOptions,
  vipLevelOptions,
  initialSubTab,
  tabRouteSection,
}: AdminUploadSettingsFormProps) {
  const router = useRouter()
  const normalizedUploadAllowedImageTypes = normalizeStringList(initialSettings.uploadAllowedImageTypes, ["jpg", "jpeg", "png", "gif", "webp"])
  const normalizedAttachmentAllowedExtensions = normalizeStringList(initialSettings.attachmentAllowedExtensions, ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"])
  const normalizedAttachmentUploadEnabled = Boolean(initialSettings.attachmentUploadEnabled)
  const normalizedAttachmentDownloadEnabled = Boolean(initialSettings.attachmentDownloadEnabled)
  const normalizedAttachmentMinUploadLevel = Number.isInteger(initialSettings.attachmentMinUploadLevel) && initialSettings.attachmentMinUploadLevel >= 0
    ? initialSettings.attachmentMinUploadLevel
    : 0
  const normalizedAttachmentMinUploadVipLevel = Number.isInteger(initialSettings.attachmentMinUploadVipLevel) && initialSettings.attachmentMinUploadVipLevel >= 0
    ? initialSettings.attachmentMinUploadVipLevel
    : 0
  const normalizedAttachmentMaxFileSizeMb = Number.isFinite(initialSettings.attachmentMaxFileSizeMb) && initialSettings.attachmentMaxFileSizeMb > 0
    ? initialSettings.attachmentMaxFileSizeMb
    : 20
  const [uploadProvider, setUploadProvider] = useState(initialSettings.uploadProvider)
  const [uploadLocalPath, setUploadLocalPath] = useState(initialSettings.uploadLocalPath)
  const [uploadBaseUrl, setUploadBaseUrl] = useState(initialSettings.uploadBaseUrl ?? "")
  const [uploadOssBucket, setUploadOssBucket] = useState(initialSettings.uploadOssBucket ?? "")
  const [uploadOssRegion, setUploadOssRegion] = useState(initialSettings.uploadOssRegion ?? "")
  const [uploadOssEndpoint, setUploadOssEndpoint] = useState(initialSettings.uploadOssEndpoint ?? "")
  const [uploadS3AccessKeyId, setUploadS3AccessKeyId] = useState("")
  const [uploadS3SecretAccessKey, setUploadS3SecretAccessKey] = useState("")
  const [uploadS3ForcePathStyle, setUploadS3ForcePathStyle] = useState(initialSettings.uploadS3ForcePathStyle)
  const [uploadRequireLogin, setUploadRequireLogin] = useState(initialSettings.uploadRequireLogin)
  const [uploadAllowedImageTypes, setUploadAllowedImageTypes] = useState(normalizedUploadAllowedImageTypes.join(", "))
  const [uploadMaxFileSizeMb, setUploadMaxFileSizeMb] = useState(String(initialSettings.uploadMaxFileSizeMb))
  const [uploadAvatarMaxFileSizeMb, setUploadAvatarMaxFileSizeMb] = useState(String(initialSettings.uploadAvatarMaxFileSizeMb))
  const [markdownImageUploadEnabled, setMarkdownImageUploadEnabled] = useState(initialSettings.markdownImageUploadEnabled)
  const [imageWatermarkEnabled, setImageWatermarkEnabled] = useState(Boolean(initialSettings.imageWatermarkEnabled))
  const [imageWatermarkText, setImageWatermarkText] = useState(initialSettings.imageWatermarkText ?? "")
  const [imageWatermarkPosition, setImageWatermarkPosition] = useState<ImageWatermarkPosition>(initialSettings.imageWatermarkPosition ?? "BOTTOM_RIGHT")
  const [imageWatermarkTiled, setImageWatermarkTiled] = useState(Boolean(initialSettings.imageWatermarkTiled))
  const [imageWatermarkOpacity, setImageWatermarkOpacity] = useState(String(initialSettings.imageWatermarkOpacity ?? 22))
  const [imageWatermarkFontSize, setImageWatermarkFontSize] = useState(String(initialSettings.imageWatermarkFontSize ?? 24))
  const [imageWatermarkFontFamily, setImageWatermarkFontFamily] = useState(initialSettings.imageWatermarkFontFamily ?? "")
  const [imageWatermarkFontPresetKey, setImageWatermarkFontPresetKey] = useState<WatermarkFontPresetKey>(() => resolveWatermarkFontPresetKey(initialSettings.imageWatermarkFontFamily ?? ""))
  const [customImageWatermarkFontFamily, setCustomImageWatermarkFontFamily] = useState(() => resolveWatermarkFontPresetKey(initialSettings.imageWatermarkFontFamily ?? "") === "custom" ? (initialSettings.imageWatermarkFontFamily ?? "") : "")
  const [imageWatermarkMargin, setImageWatermarkMargin] = useState(String(initialSettings.imageWatermarkMargin ?? 24))
  const [imageWatermarkColor, setImageWatermarkColor] = useState(initialSettings.imageWatermarkColor ?? "#FFFFFF")
  const [attachmentUploadEnabled, setAttachmentUploadEnabled] = useState(normalizedAttachmentUploadEnabled)
  const [attachmentDownloadEnabled, setAttachmentDownloadEnabled] = useState(normalizedAttachmentDownloadEnabled)
  const [attachmentMinUploadLevel, setAttachmentMinUploadLevel] = useState(String(normalizedAttachmentMinUploadLevel))
  const [attachmentMinUploadVipLevel, setAttachmentMinUploadVipLevel] = useState(String(normalizedAttachmentMinUploadVipLevel))
  const [attachmentAllowedExtensions, setAttachmentAllowedExtensions] = useState(normalizedAttachmentAllowedExtensions.join(", "))
  const [attachmentMaxFileSizeMb, setAttachmentMaxFileSizeMb] = useState(String(normalizedAttachmentMaxFileSizeMb))
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<UploadSettingsTabKey>(() => resolveUploadTab(initialSubTab))
  const normalizedImageWatermarkOpacity = normalizeSliderNumber(imageWatermarkOpacity, initialSettings.imageWatermarkOpacity ?? 22, 0, 100)
  const normalizedImageWatermarkFontSize = normalizeSliderNumber(imageWatermarkFontSize, initialSettings.imageWatermarkFontSize ?? 24, 8, 160)
  const normalizedImageWatermarkMargin = normalizeSliderNumber(imageWatermarkMargin, initialSettings.imageWatermarkMargin ?? 24, 0, 200)
  const isCustomWatermarkFontFamily = imageWatermarkFontPresetKey === "custom"
  const useRemoteStorage = uploadProvider === "s3"
  const currentTabSaveLabel = activeTab === "storage"
    ? "保存上传配置"
    : activeTab === "watermark"
      ? "保存水印配置"
      : "保存附件配置"

  useEffect(() => {
    setActiveTab(resolveUploadTab(initialSubTab))
  }, [initialSubTab])

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const result = await saveAdminSiteSettings({
            uploadProvider,
            uploadLocalPath,
            uploadBaseUrl,
            uploadOssBucket,
            uploadOssRegion,
            uploadOssEndpoint,
            uploadS3AccessKeyId,
            uploadS3SecretAccessKey,
            uploadS3ForcePathStyle,
            uploadRequireLogin,
            uploadAllowedImageTypes,
            uploadMaxFileSizeMb: Number(uploadMaxFileSizeMb),
            uploadAvatarMaxFileSizeMb: Number(uploadAvatarMaxFileSizeMb),
            markdownImageUploadEnabled,
            imageWatermarkEnabled,
            imageWatermarkText,
            imageWatermarkPosition,
            imageWatermarkTiled,
            imageWatermarkOpacity: normalizedImageWatermarkOpacity,
            imageWatermarkFontSize: normalizedImageWatermarkFontSize,
            imageWatermarkFontFamily,
            imageWatermarkMargin: normalizedImageWatermarkMargin,
            imageWatermarkColor,
            attachmentUploadEnabled,
            attachmentDownloadEnabled,
            attachmentMinUploadLevel: Number(attachmentMinUploadLevel),
            attachmentMinUploadVipLevel: Number(attachmentMinUploadVipLevel),
            attachmentAllowedExtensions,
            attachmentMaxFileSizeMb: Number(attachmentMaxFileSizeMb),
            section: "upload",
          })
          setFeedback(result.message)
          if (result.ok) {
            router.refresh()
          }
        })
      }}
    >
      <SettingsSection
        title="上传系统配置"
        description="将上传链路拆分为存储、水印、附件三块配置，减少单页信息密度。"
        className="border-none shadow-none ring-0"
      >
        {!tabRouteSection ? (
          <AdminSettingsSubTabs
            items={UPLOAD_TABS.map((item) => ({
              key: item.key,
              label: item.label,
              ...(tabRouteSection
                ? { href: getAdminSettingsHref(tabRouteSection, item.key) }
                : { onSelect: () => setActiveTab(item.key) }),
            }))}
            activeKey={activeTab}
          />
        ) : null}

        {activeTab === "storage" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsSelectField label="存储策略" value={uploadProvider} onChange={(value) => setUploadProvider(value as UploadProvider)} options={[{ value: "local", label: "本地存储" }, { value: "s3", label: "S3 兼容对象存储" }]} />
              <SettingsInputField label="本地上传目录" value={uploadLocalPath} onChange={setUploadLocalPath} placeholder="如 uploads" />
              <SettingsInputField label="资源访问基础 URL" value={uploadBaseUrl} onChange={setUploadBaseUrl} placeholder={useRemoteStorage ? "如 https://cdn.example.com 或 https://pub-xxx.r2.dev" : "留空则自动使用 /uploads"} />
              {useRemoteStorage ? <SettingsInputField label="Bucket" value={uploadOssBucket} onChange={setUploadOssBucket} placeholder="如 my-bucket" /> : null}
              {useRemoteStorage ? <SettingsInputField label="Region" value={uploadOssRegion} onChange={setUploadOssRegion} placeholder="R2 可填 auto" /> : null}
              {useRemoteStorage ? <SettingsInputField label="Endpoint" value={uploadOssEndpoint} onChange={setUploadOssEndpoint} placeholder="如 https://<accountid>.r2.cloudflarestorage.com" /> : null}
              {useRemoteStorage ? <SettingsInputField label="Access Key ID" value={uploadS3AccessKeyId} onChange={setUploadS3AccessKeyId} placeholder={initialSettings.uploadS3CredentialsConfigured ? "留空则保持当前 Access Key ID" : "填写对象存储 Access Key ID"} /> : null}
              {useRemoteStorage ? <SettingsInputField label="Secret Access Key" type="password" value={uploadS3SecretAccessKey} onChange={setUploadS3SecretAccessKey} placeholder={initialSettings.uploadS3CredentialsConfigured ? "留空则保持当前 Secret Access Key" : "填写对象存储 Secret Access Key"} /> : null}
              {useRemoteStorage ? <SettingsToggleField label="强制 Path-Style" checked={uploadS3ForcePathStyle} onChange={setUploadS3ForcePathStyle} description="R2、MinIO 等自定义 endpoint 通常建议开启；若使用原生 AWS S3 虚拟主机风格，可关闭。" /> : null}
              <SettingsToggleField label="必须登录后上传" checked={uploadRequireLogin} onChange={setUploadRequireLogin} description="关闭后游客也能调用上传接口，但当前上传记录仍依赖用户归属，通常建议保持开启。" />
              <SettingsToggleField label="Markdown 图片上传" checked={markdownImageUploadEnabled} onChange={setMarkdownImageUploadEnabled} description="关闭后，Markdown 编辑器中的图片按钮会改为手动插入远程图片 URL，不再触发本地图片上传。" />
              <SettingsInputField label="允许图片格式" value={uploadAllowedImageTypes} onChange={setUploadAllowedImageTypes} placeholder="如 jpg, jpeg, png, gif, webp" />
              <SettingsInputField label="通用图片大小上限（MB）" type="number" value={uploadMaxFileSizeMb} onChange={setUploadMaxFileSizeMb} />
              <SettingsInputField label="头像大小上限（MB）" type="number" value={uploadAvatarMaxFileSizeMb} onChange={setUploadAvatarMaxFileSizeMb} />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              {useRemoteStorage
                ? `对象存储模式下会直接上传到 S3 兼容接口；图片最终访问地址优先使用“资源访问基础 URL”，未填写时会尝试用 endpoint 自动拼接。${initialSettings.uploadS3CredentialsConfigured ? "当前已保存对象存储密钥，留空提交将继续沿用。" : "当前尚未保存对象存储密钥。"}`
                : "本地存储模式下，文件会写入站点服务器的本地上传目录；资源访问基础 URL 留空时默认使用 /uploads。"}
            </p>
          </div>
        ) : null}

        {activeTab === "watermark" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsToggleField label="启用图片水印" checked={imageWatermarkEnabled} onChange={setImageWatermarkEnabled} description="开启后会在服务端保存前写入文字水印。" />
              <SettingsInputField label="水印文字" value={imageWatermarkText} onChange={setImageWatermarkText} placeholder="如 @站点名称 / 禁止转载" />
              <SettingsSelectField
                label="水印位置"
                value={imageWatermarkPosition}
                onChange={(value) => setImageWatermarkPosition(value as ImageWatermarkPosition)}
                description="单点水印决定角落位置；铺满模式下则作为平铺纹理的起始偏移锚点。"
                options={[
                  { value: "TOP_LEFT", label: "左上角" },
                  { value: "TOP_RIGHT", label: "右上角" },
                  { value: "BOTTOM_LEFT", label: "左下角" },
                  { value: "BOTTOM_RIGHT", label: "右下角" },
                  { value: "CENTER", label: "居中" },
                ]}
              />
              <SettingsToggleField label="铺满整张图片" checked={imageWatermarkTiled} onChange={setImageWatermarkTiled} description="开启后会以倾斜网格重复铺设整张图，边距会被当作平铺间距使用。" />
              <SettingsSelectField
                label="字体预设"
                value={imageWatermarkFontPresetKey}
                onChange={(value) => {
                  const nextKey = value as WatermarkFontPresetKey
                  setImageWatermarkFontPresetKey(nextKey)

                  if (nextKey === "custom") {
                    setImageWatermarkFontFamily(customImageWatermarkFontFamily)
                    return
                  }

                  const preset = WATERMARK_FONT_PRESETS.find((item) => item.key === nextKey)
                  setImageWatermarkFontFamily(preset?.value ?? "")
                }}
                options={[
                  ...WATERMARK_FONT_PRESETS.map((preset) => ({ value: preset.key, label: preset.label })),
                  { value: "custom", label: "自定义字体栈" },
                ]}
                description="先从常用中文字体里挑一个；如果部署环境有自己的字体，再切到自定义输入完整 font-family。"
              />
              {isCustomWatermarkFontFamily ? (
                <SettingsInputField
                  label="自定义字体族"
                  value={imageWatermarkFontFamily}
                  onChange={(value) => {
                    setImageWatermarkFontPresetKey("custom")
                    setCustomImageWatermarkFontFamily(value)
                    setImageWatermarkFontFamily(value)
                  }}
                  placeholder={'如 "Microsoft YaHei", "PingFang SC", sans-serif'}
                  description="填写完整 CSS font-family 栈。留空时会回退到默认内置字体链。"
                  className="md:col-span-2 xl:col-span-2"
                />
              ) : null}
              <ColorPicker
                label="文字颜色"
                value={imageWatermarkColor}
                onChange={setImageWatermarkColor}
                presets={WATERMARK_COLOR_PRESETS}
                fallbackColor="#FFFFFF"
                placeholder="#FFFFFF"
                popoverTitle="选择文字颜色"
              />
              <WatermarkSliderField
                label="透明度"
                value={normalizedImageWatermarkOpacity}
                min={0}
                max={100}
                suffix="%"
                onChange={(nextValue) => setImageWatermarkOpacity(String(nextValue))}
                description="数值越低越隐蔽，数值越高越醒目。"
              />
              <WatermarkSliderField
                label="字号"
                value={normalizedImageWatermarkFontSize}
                min={8}
                max={160}
                suffix="px"
                onChange={(nextValue) => setImageWatermarkFontSize(String(nextValue))}
                description="服务端会按这个字号测量、换行并绘制水印文本。"
              />
              <WatermarkSliderField
                label="边距 / 间距"
                value={normalizedImageWatermarkMargin}
                min={0}
                max={200}
                suffix="px"
                onChange={(nextValue) => setImageWatermarkMargin(String(nextValue))}
                description="单点模式表示离边缘的距离，铺满模式表示相邻水印之间的间距。"
              />
            </div>
            <WatermarkPreview
              enabled={imageWatermarkEnabled}
              text={imageWatermarkText}
              position={imageWatermarkPosition}
              tiled={imageWatermarkTiled}
              opacity={normalizedImageWatermarkOpacity}
              fontSize={normalizedImageWatermarkFontSize}
              fontFamily={imageWatermarkFontFamily}
              margin={normalizedImageWatermarkMargin}
              color={imageWatermarkColor}
            />
          </div>
        ) : null}

        {activeTab === "attachment" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsToggleField label="启用附件上传" checked={attachmentUploadEnabled} onChange={setAttachmentUploadEnabled} description="关闭后不再允许上传站内附件，但仍可继续添加网盘链接附件。" />
              <SettingsToggleField label="启用附件下载" checked={attachmentDownloadEnabled} onChange={setAttachmentDownloadEnabled} description="关闭后仅拦截站内附件的下载与购买入口，网盘附件的信息查看不受影响。" />
              <div className="md:col-span-2 xl:col-span-2">
                <AccessThresholdSelectGroup
                  levelValue={attachmentMinUploadLevel}
                  vipLevelValue={attachmentMinUploadVipLevel}
                  levelOptions={levelOptions}
                  vipLevelOptions={vipLevelOptions}
                  onLevelChange={setAttachmentMinUploadLevel}
                  onVipLevelChange={setAttachmentMinUploadVipLevel}
                  levelLabel="附件添加最低用户等级"
                  vipLevelLabel="附件添加最低 VIP 等级"
                  levelDescriptionBuilder={(option) => option?.value === "0" ? "不限制用户等级，任何满足发帖权限的用户都可以添加附件。" : `至少达到 ${option?.label ?? "当前等级"} 才能在发帖时添加站内附件或网盘附件。`}
                  vipLevelDescriptionBuilder={(option) => option?.value === "0" ? "不限制 VIP 等级。" : `至少达到 ${option?.label ?? "当前 VIP"} 才能在发帖时添加站内附件或网盘附件。`}
                />
              </div>
              <SettingsInputField label="允许附件格式" value={attachmentAllowedExtensions} onChange={setAttachmentAllowedExtensions} placeholder="如 zip, rar, 7z, pdf, docx, xlsx" />
              <SettingsInputField label="附件大小上限（MB）" type="number" value={attachmentMaxFileSizeMb} onChange={setAttachmentMaxFileSizeMb} />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              上传型附件会复用现有存储策略写入本地或对象存储；下载时统一走站内接口完成权限校验与下载次数统计。网盘附件不占用站内存储，且不受站内上传/下载开关影响，但仍受各附件自身的等级、积分和回复权限控制。
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending} size="lg" className="rounded-full px-4 text-xs">{isPending ? "保存中..." : currentTabSaveLabel}</Button>
          {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
        </div>
      </SettingsSection>
    </form>
  )
}

const WATERMARK_COLOR_PRESETS = ["#FFFFFF", "#F8FAFC", "#E2E8F0", "#FDE68A", "#FCA5A5", "#93C5FD", "#A7F3D0", "#000000", "#111827"] as const

function WatermarkPreview({
  enabled,
  text,
  position,
  tiled,
  opacity,
  fontSize,
  fontFamily,
  margin,
  color,
}: {
  enabled: boolean
  text: string
  position: ImageWatermarkPosition
  tiled: boolean
  opacity: number
  fontSize: number
  fontFamily: string
  margin: number
  color: string
}) {
  const previewQuery = new URLSearchParams({
    enabled: enabled ? "1" : "0",
    text,
    position,
    tiled: tiled ? "1" : "0",
    opacity: String(opacity),
    fontSize: String(fontSize),
    fontFamily,
    margin: String(margin),
    color: normalizeHexColor(color || "#FFFFFF", "#FFFFFF"),
  }).toString()
  const previewUrl = useDeferredValue(`/api/admin/site-settings/watermark-preview?${previewQuery}`)

  return (
    <div className="space-y-3 rounded-[22px] border border-border bg-card p-4">
      <div>
        <h4 className="text-sm font-semibold">效果预览</h4>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">预览图由服务端实时生成，字体、换行、阴影和透明度与实际落盘水印完全复用同一套 canvas 渲染逻辑。</p>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-[24px] border border-border bg-[radial-gradient(circle_at_top_left,#fef3c7,transparent_32%),radial-gradient(circle_at_bottom_right,#bfdbfe,transparent_34%),linear-gradient(135deg,#0f172a,#1e293b_52%,#334155)]">
        <Image
          alt="水印服务端预览"
          className="object-cover"
          draggable={false}
          fill
          loading="eager"
          sizes="(max-width: 1024px) 100vw, 768px"
          src={previewUrl}
          unoptimized
        />
        {!enabled ? (
          <div className="absolute inset-x-0 bottom-0 bg-black/45 px-4 py-2 text-center text-xs text-white/80">
            当前水印功能关闭，以上仅为配置预览
          </div>
        ) : null}
      </div>
    </div>
  )
}

function WatermarkSliderField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  description,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
  description?: string
}) {
  return (
    <label className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground/80">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        className="px-1 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-foreground/10 dark:[&_[data-slot=slider-track]]:bg-white/12 [&_[data-slot=slider-range]]:bg-foreground dark:[&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-background [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(15,23,42,0.08)] dark:[&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(255,255,255,0.12)]"
        onValueChange={(nextValue) => {
          const resolvedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue
          onChange(typeof resolvedValue === "number" ? resolvedValue : min)
        }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {min}
          {suffix}
        </span>
        <span className="tabular-nums">
          {max}
          {suffix}
        </span>
      </div>
      {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </label>
  )
}
