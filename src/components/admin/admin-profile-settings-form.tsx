"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { IconPicker } from "@/components/ui/icon-picker"
import {
  SettingsInputField as TextField,
  SettingsSection,
  SettingsSelectField,
  SettingsTextareaField,
  SettingsToggleField,
} from "@/components/admin/admin-settings-fields"
import {
  SiteIconUploadCard,
  SiteLogoUploadCard,
  resolveHomeFeedPostListDisplayMode,
  uploadSiteIconFile,
  uploadSiteLogoFile,
} from "@/components/admin/admin-site-settings.shared"
import type { AdminProfileSettingsFormProps } from "@/components/admin/admin-basic-settings.types"
import {
  PROFILE_HOME_FEED_DISPLAY_MODE_OPTIONS,
  PROFILE_HOME_FEED_LOAD_MODE_OPTIONS,
  PROFILE_LEFT_SIDEBAR_DISPLAY_MODE_OPTIONS,
  PROFILE_LEFT_SIDEBAR_NAVIGATION_MODE_OPTIONS,
  PROFILE_POST_LINK_DISPLAY_MODE_OPTIONS,
  PROFILE_POST_SLUG_GENERATION_MODE_OPTIONS,
} from "@/components/admin/admin-basic-settings.constants"
import { toast } from "@/components/ui/toast"
import {
  POST_LIST_LOAD_MODE_INFINITE,
  POST_LIST_LOAD_MODE_PAGINATION,
} from "@/lib/post-list-load-mode"
import type { BuiltInThemePreset, CustomThemeModeConfig, FontSizePreset, PostContentImageMode, ThemePreference } from "@/lib/theme"

const themePresetKeys: BuiltInThemePreset[] = ["default", "sea", "jade", "amber", "graphite"]
const fontSizePresetKeys: FontSizePreset[] = ["compact", "normal", "relaxed"]
const themeModeKeys = ["light", "dark"] as const
const themeColorKeys: Array<keyof CustomThemeModeConfig> = ["primary", "background", "card", "accent", "border"]
const interfaceModeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "白天模式" },
  { value: "dark", label: "黑夜模式" },
  { value: "system", label: "跟随系统" },
]
const postContentImageModeOptions: Array<{ value: PostContentImageMode; label: string }> = [
  { value: "large", label: "大图模式" },
  { value: "small", label: "小图模式" },
  { value: "auto", label: "自动模式" },
]
const fontSizeFallbackLabels: Record<FontSizePreset, string> = {
  compact: "Small",
  normal: "Medium",
  relaxed: "Large",
}
const themeModeLabels: Record<(typeof themeModeKeys)[number], string> = {
  light: "Light",
  dark: "Dark",
}
const themeColorLabels: Record<keyof CustomThemeModeConfig, string> = {
  primary: "Primary",
  background: "Background",
  card: "Card",
  accent: "Accent",
  border: "Border",
}

export function AdminProfileSettingsForm({
  activeSubTab,
  draft,
  updateDraftField,
}: AdminProfileSettingsFormProps) {
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const themePresetOptions = themePresetKeys.map((value) => ({
    value,
    label: draft.themePresets[value]?.label || value,
  }))
  const fontSizePresetOptions = fontSizePresetKeys.map((value) => ({
    value,
    label: draft.fontSizePresets[value]?.label || fontSizeFallbackLabels[value],
  }))

  function updateFontSizePresetField(preset: FontSizePreset, field: "label" | "size", value: string) {
    updateDraftField("fontSizePresets", {
      ...draft.fontSizePresets,
      [preset]: {
        ...draft.fontSizePresets[preset],
        [field]: value,
      },
    })
  }

  function updateThemePresetField(preset: BuiltInThemePreset, field: "label" | "description", value: string) {
    updateDraftField("themePresets", {
      ...draft.themePresets,
      [preset]: {
        ...draft.themePresets[preset],
        [field]: value,
      },
    })
  }

  function updateThemePresetColor(
    preset: BuiltInThemePreset,
    mode: "light" | "dark",
    field: keyof CustomThemeModeConfig,
    value: string,
  ) {
    updateDraftField("themePresets", {
      ...draft.themePresets,
      [preset]: {
        ...draft.themePresets[preset],
        [mode]: {
          ...draft.themePresets[preset][mode],
          [field]: value,
        },
      },
    })
  }

  const themeAppearanceSettings = (
    <div className="grid gap-4">
      <SettingsSection
        title={"\u4e3b\u9898\u4e0e\u5b57\u53f7\u9884\u8bbe"}
        description={"\u5355\u72ec\u7ba1\u7406\u524d\u53f0\u4e3b\u9898\u9884\u8bbe\u3001\u684c\u9762\u7aef\u548c\u79fb\u52a8\u7aef\u9ed8\u8ba4\u4e3b\u9898\u4e0e\u5b57\u53f7\u6863\u4f4d\u3002"}
        action={<Badge variant="outline">Appearance</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SettingsSelectField
            label={"\u684c\u9762\u7aef\u9ed8\u8ba4\u4e3b\u9898\u9884\u8bbe"}
            value={draft.defaultThemePreset}
            onChange={(value) =>
              updateDraftField(
                "defaultThemePreset",
                value as typeof draft.defaultThemePreset,
              )}
            options={themePresetOptions}
            description={"\u684c\u9762\u7aef\u65b0\u8bbf\u5ba2\u548c\u672a\u8bbe\u7f6e\u672c\u5730\u4e3b\u9898\u7684\u7528\u6237\u9ed8\u8ba4\u4f7f\u7528\u8fd9\u4e2a\u9884\u8bbe\u3002"}
          />
          <SettingsSelectField
            label={"\u684c\u9762\u7aef\u9ed8\u8ba4\u5b57\u53f7\u9884\u8bbe"}
            value={draft.defaultFontSizePreset}
            onChange={(value) =>
              updateDraftField(
                "defaultFontSizePreset",
                value as typeof draft.defaultFontSizePreset,
              )}
            options={fontSizePresetOptions}
            description={"\u684c\u9762\u7aef\u672a\u8bbe\u7f6e\u672c\u5730\u5b57\u53f7\u65f6\u4f7f\u7528\uff0c\u4e0b\u65b9\u53ef\u81ea\u5b9a\u4e49\u5404\u6863\u4f4d px \u503c\u3002"}
          />
          <SettingsSelectField
            label={"\u79fb\u52a8\u7aef\u9ed8\u8ba4\u4e3b\u9898\u9884\u8bbe"}
            value={draft.defaultMobileThemePreset}
            onChange={(value) =>
              updateDraftField(
                "defaultMobileThemePreset",
                value as typeof draft.defaultMobileThemePreset,
              )}
            options={themePresetOptions}
            description={"\u79fb\u52a8\u7aef\u65b0\u8bbf\u5ba2\u548c\u672a\u8bbe\u7f6e\u672c\u5730\u4e3b\u9898\u7684\u7528\u6237\u4f1a\u9ed8\u8ba4\u4f7f\u7528\u8fd9\u4e2a\u9884\u8bbe\u3002"}
          />
          <SettingsSelectField
            label={"\u79fb\u52a8\u7aef\u9ed8\u8ba4\u5b57\u53f7\u9884\u8bbe"}
            value={draft.defaultMobileFontSizePreset}
            onChange={(value) =>
              updateDraftField(
                "defaultMobileFontSizePreset",
                value as typeof draft.defaultMobileFontSizePreset,
              )}
            options={fontSizePresetOptions}
            description={"\u79fb\u52a8\u7aef\u672a\u8bbe\u7f6e\u672c\u5730\u5b57\u53f7\u65f6\u4f7f\u7528\uff0c\u9002\u5408\u5355\u72ec\u8c03\u6574\u5c0f\u5c4f\u9605\u8bfb\u5bc6\u5ea6\u3002"}
          />
          <SettingsSelectField
            label="默认界面模式"
            value={draft.defaultPreference}
            onChange={(value) =>
              updateDraftField(
                "defaultPreference",
                value as typeof draft.defaultPreference,
              )}
            options={interfaceModeOptions}
            description="新访客和未设置本地界面模式的用户默认使用这个模式。"
          />
          <SettingsSelectField
            label="默认贴内图片模式"
            value={draft.postContentImageMode}
            onChange={(value) =>
              updateDraftField(
                "postContentImageMode",
                value as typeof draft.postContentImageMode,
              )}
            options={postContentImageModeOptions}
            description="自动模式会在图文混排时使用小图，纯图片内容使用大图。"
          />
        </div>
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">{"\u5b57\u53f7\u9884\u8bbe"}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{"\u7ba1\u7406\u5458\u53ef\u81ea\u5b9a\u4e49\u540d\u79f0\u548c\u5b57\u53f7\uff0c\u4f8b\u5982\u5c0f\u53f7 10\u3001\u4e2d\u53f7 15\u3001\u5927\u53f7 20\u3002"}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {fontSizePresetKeys.map((presetKey) => (
              <div key={presetKey} className="grid gap-3 rounded-xl border border-border bg-background p-3">
                <TextField
                  label={"\u540d\u79f0"}
                  value={draft.fontSizePresets[presetKey].label}
                  onChange={(value) => updateFontSizePresetField(presetKey, "label", value)}
                  placeholder={fontSizeFallbackLabels[presetKey]}
                />
                <TextField
                  label={"\u5b57\u53f7 px"}
                  value={draft.fontSizePresets[presetKey].size.replace(/px$/i, "")}
                  onChange={(value) => updateFontSizePresetField(presetKey, "size", value)}
                  placeholder="15"
                  type="number"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">{"\u4e3b\u9898\u9884\u8bbe"}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{"\u4e94\u4e2a\u524d\u53f0\u4e3b\u9898\u9884\u8bbe\u7684\u540d\u79f0\u548c\u914d\u8272\u90fd\u53ef\u5728\u8fd9\u91cc\u81ea\u5b9a\u4e49\u3002"}</p>
          </div>
          <div className="grid gap-4">
            {themePresetKeys.map((presetKey) => (
              <div key={presetKey} className="rounded-xl border border-border bg-background p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <TextField
                    label={"\u9884\u8bbe\u540d\u79f0"}
                    value={draft.themePresets[presetKey].label}
                    onChange={(value) => updateThemePresetField(presetKey, "label", value)}
                    placeholder={presetKey}
                  />
                  <TextField
                    label={"\u9884\u8bbe\u8bf4\u660e"}
                    value={draft.themePresets[presetKey].description}
                    onChange={(value) => updateThemePresetField(presetKey, "description", value)}
                    placeholder="Theme description"
                  />
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {themeModeKeys.map((mode) => (
                    <div key={`${presetKey}-${mode}`} className="rounded-xl bg-muted/30 p-3">
                      <div className="mb-2 text-xs font-semibold text-muted-foreground">{themeModeLabels[mode]}</div>
                      <div className="grid gap-2 sm:grid-cols-5">
                        {themeColorKeys.map((colorKey) => (
                          <TextField
                            key={`${presetKey}-${mode}-${colorKey}`}
                            label={themeColorLabels[colorKey]}
                            value={draft.themePresets[presetKey][mode][colorKey]}
                            onChange={(value) => updateThemePresetColor(presetKey, mode, colorKey, value)}
                            type="color"
                            inputClassName="px-2"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>
    </div>
  )

  async function uploadSiteLogo(file: File) {
    setIsUploadingLogo(true)

    try {
      updateDraftField("siteLogoPath", await uploadSiteLogoFile(file))
      toast.success("站点 Logo 上传成功", "上传成功")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "站点 Logo 上传失败，请稍后再试",
        "上传失败",
      )
    } finally {
      setIsUploadingLogo(false)
    }
  }

  async function uploadSiteIcon(file: File) {
    setIsUploadingIcon(true)

    try {
      updateDraftField("siteIconPath", await uploadSiteIconFile(file))
      toast.success("站点图标上传成功", "上传成功")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "站点图标上传失败，请稍后再试",
        "上传失败",
      )
    } finally {
      setIsUploadingIcon(false)
    }
  }

  return (
    <>
      {activeSubTab === "branding" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
            <SettingsSection
              title="品牌文本"
              description="维护站点名称、Logo 文案和 Slogan，让首页、登录页、系统邮件保持统一识别。"
              action={<Badge variant="outline">基础识别</Badge>}
              className="h-full"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="站点名称"
                  value={draft.siteName}
                  onChange={(value) => updateDraftField("siteName", value)}
                  placeholder="如 兴趣论坛"
                  description="显示在浏览器标题、分享卡片、后台标题和系统邮件中。"
                />
                <TextField
                  label="Logo 文案"
                  value={draft.siteLogoText}
                  onChange={(value) => updateDraftField("siteLogoText", value)}
                  placeholder="如 兴趣论坛"
                  description="未上传图片 Logo 时，站点头部会优先使用这段文案。"
                />
              </div>
              <TextField
                label="站点 Slogan"
                value={draft.siteSlogan}
                onChange={(value) => updateDraftField("siteSlogan", value)}
                placeholder="如 Waste your time on things you love"
                description="作为品牌副标题显示在首页和部分认证、登录场景。"
              />
            </SettingsSection>

            <SettingsSection
              title="当前预览"
              description="快速检查文字品牌在前台常见位置的组合效果。"
              action={<Badge variant="secondary">只读</Badge>}
              className="h-full"
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    导航品牌
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-sm font-semibold">
                      {(draft.siteLogoText || draft.siteName || "站").slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {draft.siteLogoText || "未设置 Logo 文案"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {draft.siteName || "未设置站点名称"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    品牌副标题
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    {draft.siteSlogan
                      || "未填写 Slogan 时，前台会保持更简洁的品牌展示。"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      图片 Logo
                    </p>
                    <p className="mt-2 text-sm">
                      {draft.siteLogoPath
                        ? "已设置图片 Logo"
                        : "未设置，回退到文字品牌"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      站点 Icon
                    </p>
                    <p className="mt-2 text-sm">
                      {draft.siteIconPath
                        ? "已设置浏览器标签图标"
                        : "未设置，将使用默认图标"}
                    </p>
                  </div>
                </div>
              </div>
            </SettingsSection>
          </div>

          <SettingsSection
            title="品牌资源"
            description="支持上传图片或直接填写地址，适合分别维护站点头部 Logo 与浏览器标签页图标。"
            action={<Badge variant="outline">图片资源</Badge>}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <SiteLogoUploadCard
                value={draft.siteLogoPath}
                uploading={isUploadingLogo}
                onValueChange={(value) => updateDraftField("siteLogoPath", value)}
                onUpload={uploadSiteLogo}
                onClear={() => updateDraftField("siteLogoPath", "")}
              />
              <SiteIconUploadCard
                value={draft.siteIconPath}
                uploading={isUploadingIcon}
                onValueChange={(value) => updateDraftField("siteIconPath", value)}
                onUpload={uploadSiteIcon}
                onClear={() => updateDraftField("siteIconPath", "")}
              />
            </div>
          </SettingsSection>
        </div>
      ) : null}

      {activeSubTab === "homepage" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <SettingsSection
              title="访问路径与 Feed 布局"
              description="统一控制帖子 URL 结构、首页帖子列表样式与加载方式。"
              action={<Badge variant="outline">内容分发</Badge>}
              className="h-full"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SettingsSelectField
                  label="帖子链接显示模式"
                  value={draft.postLinkDisplayMode}
                  onChange={(value) =>
                    updateDraftField("postLinkDisplayMode", value as "SLUG" | "ID")}
                  options={[...PROFILE_POST_LINK_DISPLAY_MODE_OPTIONS]}
                  description="slug 模式更利于可读性和 SEO；id 模式更短更稳定。"
                />
                <SettingsSelectField
                  label="帖子 slug 生成规则"
                  value={draft.postSlugGenerationMode}
                  onChange={(value) =>
                    updateDraftField(
                      "postSlugGenerationMode",
                      value as typeof draft.postSlugGenerationMode,
                    )}
                  options={[...PROFILE_POST_SLUG_GENERATION_MODE_OPTIONS]}
                  description="仅在 slug 模式下生效，决定新帖 URL 的可读性和唯一性。"
                />
                <SettingsSelectField
                  label="首页帖子列表形式"
                  value={draft.homeFeedPostListDisplayMode}
                  onChange={(value) =>
                    updateDraftField(
                      "homeFeedPostListDisplayMode",
                      resolveHomeFeedPostListDisplayMode(value),
                    )}
                  options={[...PROFILE_HOME_FEED_DISPLAY_MODE_OPTIONS]}
                  description="只影响首页 feed 的普通帖子列表；置顶帖仍保持原来的普通列表样式。"
                />
                <SettingsSelectField
                  label="首页帖子加载方式"
                  value={draft.homeFeedPostListLoadMode}
                  onChange={(value) =>
                    updateDraftField(
                      "homeFeedPostListLoadMode",
                      value as
                        | typeof POST_LIST_LOAD_MODE_PAGINATION
                        | typeof POST_LIST_LOAD_MODE_INFINITE,
                    )}
                  options={[...PROFILE_HOME_FEED_LOAD_MODE_OPTIONS]}
                  description="在传统分页和滚动到底部自动加载之间切换。"
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="侧栏与搜索入口"
              description="控制全局左侧导航、首页辅助信息模块，以及前台搜索入口是否走站内检索。"
              action={(
                <Badge variant={draft.searchEnabled ? "secondary" : "outline"}>
                  {draft.searchEnabled ? "搜索已开启" : "搜索已关闭"}
                </Badge>
              )}
              className="h-full"
            >
              <div className="grid gap-3">
                <SettingsSelectField
                  label="全局左侧导航模式"
                  value={draft.leftSidebarDisplayMode}
                  onChange={(value) =>
                    updateDraftField(
                      "leftSidebarDisplayMode",
                      value as typeof draft.leftSidebarDisplayMode,
                  )}
                  options={[...PROFILE_LEFT_SIDEBAR_DISPLAY_MODE_OPTIONS]}
                  description="控制左侧导航整体是否显示，以及是否吸附到页面最左侧。"
                />
                <SettingsSelectField
                  label="左侧导航显示模式"
                  value={draft.leftSidebarNavigationMode}
                  onChange={(value) =>
                    updateDraftField(
                      "leftSidebarNavigationMode",
                      value as typeof draft.leftSidebarNavigationMode,
                    )}
                  options={[...PROFILE_LEFT_SIDEBAR_NAVIGATION_MODE_OPTIONS]}
                  description="默认模式分开展示分区和节点；树状展示会按分区归类节点，并在各自分区内沿用节点排序。"
                />
                <SettingsToggleField
                  label="左侧导航首页入口"
                  checked={draft.leftSidebarHomeEnabled}
                  onChange={(value) =>
                    updateDraftField("leftSidebarHomeEnabled", value)}
                  description="关闭后左侧导航不再显示首页入口，只保留分区和节点列表。"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <TextField
                    label="首页入口名称"
                    value={draft.leftSidebarHomeName}
                    onChange={(value) => updateDraftField("leftSidebarHomeName", value)}
                    placeholder="首页"
                    description="显示在左侧导航第一项。"
                  />
                  <IconPicker
                    label="首页入口图标"
                    value={draft.leftSidebarHomeIcon}
                    onChange={(value) => updateDraftField("leftSidebarHomeIcon", value)}
                    popoverTitle="选择首页入口图标"
                    triggerMode="input"
                    textareaRows={5}
                    placeholder="输入 emoji、SVG、图片 URL，或上传后的本地路径"
                    displayText={draft.leftSidebarHomeIcon ? "已设置首页入口图标" : "选择首页入口图标"}
                    description="支持 emoji、内联 SVG、远程图片 URL 和上传后的本地资源路径。前台左侧导航会复用同一套图标组件渲染。"
                  />
                </div>
                <SettingsToggleField
                  label="首页右侧统计卡片"
                  checked={draft.homeSidebarStatsCardEnabled}
                  onChange={(value) =>
                    updateDraftField("homeSidebarStatsCardEnabled", value)}
                  description="展示站点用户、帖子、节点等总体概况。"
                />
                <SettingsToggleField
                  label="首页右侧站点公告"
                  checked={draft.homeSidebarAnnouncementsEnabled}
                  onChange={(value) =>
                    updateDraftField("homeSidebarAnnouncementsEnabled", value)}
                  description="关闭后首页右侧不再展示置顶公告摘要。"
                />
                <SettingsToggleField
                  label="用户主页 IP 归属地"
                  checked={draft.userProfileIpLocationEnabled}
                  onChange={(value) =>
                    updateDraftField("userProfileIpLocationEnabled", value)}
                  description="开启后在用户主页基础信息行显示最近登录 IP 的省份或国家/地区，不展示原始 IP。"
                />
                <SettingsToggleField
                  label="用户主页个人介绍"
                  checked={draft.userProfileIntroductionEnabled}
                  onChange={(value) =>
                    updateDraftField("userProfileIntroductionEnabled", value)}
                  description="关闭后用户主页不再显示“介绍”标签，设置中心也隐藏个人介绍修改入口。"
                />
                <SettingsToggleField
                  label="站内搜索"
                  checked={draft.searchEnabled}
                  onChange={(value) => updateDraftField("searchEnabled", value)}
                  description="关闭后前台搜索入口会改为提供 Google 和 Bing 外部搜索选项。"
                />
              </div>
            </SettingsSection>
          </div>

          <SettingsSection
            title="分页与列表密度"
            description="根据首页、分区、节点和侧栏的信息密度调整每次展示数量。"
            action={<Badge variant="outline">数量控制</Badge>}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TextField
                label="首页帖子显示数量"
                value={draft.homeFeedPostPageSize}
                onChange={(value) =>
                  updateDraftField("homeFeedPostPageSize", value)}
                placeholder="如 35"
                type="number"
                description="首页主 feed 单次展示的普通帖子数量。"
              />
              <TextField
                label="分区帖子显示数量"
                value={draft.zonePostPageSize}
                onChange={(value) => updateDraftField("zonePostPageSize", value)}
                placeholder="如 20"
                type="number"
                description="`/zones/[slug]` 页面每页帖子数量。"
              />
              <TextField
                label="节点帖子显示数量"
                value={draft.boardPostPageSize}
                onChange={(value) => updateDraftField("boardPostPageSize", value)}
                placeholder="如 20"
                type="number"
                description="节点详情页中帖子列表的分页大小。"
              />
              <TextField
                label="今日热帖显示数量"
                value={draft.homeSidebarHotTopicsCount}
                onChange={(value) =>
                  updateDraftField("homeSidebarHotTopicsCount", value)}
                placeholder="如 5"
                type="number"
                description="首页右侧热帖模块一次显示的主题数量。"
              />
              <TextField
                label="帖子相关主题显示数量"
                value={draft.postSidebarRelatedTopicsCount}
                onChange={(value) =>
                  updateDraftField("postSidebarRelatedTopicsCount", value)}
                placeholder="如 5"
                type="number"
                description="帖子详情页相关主题推荐数量。"
              />
            </div>
          </SettingsSection>
        </div>
      ) : null}

      {activeSubTab === "appearance" ? themeAppearanceSettings : null}

      {activeSubTab === "seo" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <SettingsSection
              title="站点元信息"
              description="用于首页和默认页面的描述、关键字等基础 SEO 元数据。"
              action={<Badge variant="outline">Metadata</Badge>}
              className="h-full"
            >
              <SettingsTextareaField
                label="站点描述"
                value={draft.siteDescription}
                onChange={(value) => updateDraftField("siteDescription", value)}
                rows={6}
                placeholder="概括你的站点定位、核心内容和面向人群"
                description="会写入通用页面 metadata description，并作为分享摘要的重要来源。"
              />
              <SettingsTextareaField
                label="站点 SEO 关键字"
                value={draft.siteSeoKeywords}
                onChange={(value) => updateDraftField("siteSeoKeywords", value)}
                rows={5}
                placeholder="多个关键字请用英文逗号、中文逗号或换行分隔"
                description="这些关键字会写入站点页面的 metadata keywords，用于 SEO 基础配置。"
              />
            </SettingsSection>

            <SettingsSection
              title="页脚版权"
              description="自定义页脚版权文案，并单独控制是否显示 Powered by 与外部链接。"
              action={(
                <Badge
                  variant={draft.footerBrandingVisible ? "secondary" : "outline"}
                >
                  {draft.footerBrandingVisible
                    ? "附加信息显示中"
                    : "仅展示版权文案"}
                </Badge>
              )}
              className="h-full"
            >
              <TextField
                label="版权文案"
                value={draft.footerCopyrightText}
                onChange={(value) =>
                  updateDraftField("footerCopyrightText", value)}
                placeholder={'如 兴趣论坛 2026 · <a href="https://beian.miit.gov.cn/">ICP备案号</a>'}
                description="例如公司名、品牌名、备案提示或年度版权说明；支持安全的 a 标签超链接。"
              />
              <SettingsToggleField
                label="显示版权附加信息"
                checked={draft.footerBrandingVisible}
                onChange={(value) =>
                  updateDraftField("footerBrandingVisible", value)}
                description="关闭后隐藏 Powered by Rhex、官网、GitHub、Gitee，但自定义版权文案仍会保留。"
              />
            </SettingsSection>
          </div>

          <SettingsSection
            title="统计代码与脚本注入"
            description="页脚统计 Hook 容器，适合放站长统计、埋点脚本或自定义监测代码。"
            action={<Badge variant="destructive">仅限可信脚本</Badge>}
          >
            <SettingsTextareaField
              label="页脚统计代码"
              value={draft.analyticsCode}
              onChange={(value) => updateDraftField("analyticsCode", value)}
              rows={8}
              placeholder="可粘贴统计脚本、站长统计或自定义 hook 代码"
              description="这段代码会插入到全站页脚底部的统计 Hook 容器中，请仅粘贴你信任的统计脚本。"
              textareaClassName="font-mono text-xs sm:text-sm"
            />
          </SettingsSection>
        </div>
      ) : null}
    </>
  )
}
