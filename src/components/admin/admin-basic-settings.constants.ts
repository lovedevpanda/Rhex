import type { AdminBasicSettingsMode } from "@/components/admin/admin-basic-settings.types"
import {
  POST_LIST_LOAD_MODE_INFINITE,
  POST_LIST_LOAD_MODE_PAGINATION,
} from "@/lib/post-list-load-mode"
import {
  POST_LIST_DISPLAY_MODE_DEFAULT,
  POST_LIST_DISPLAY_MODE_GALLERY,
} from "@/lib/post-list-display"

export const HEAT_COLOR_PRESETS = [
  "#4A4A4A",
  "#808080",
  "#9B8F7F",
  "#B87333",
  "#C4A777",
  "#E8C547",
  "#FFA500",
  "#D96C3B",
  "#C41E3A",
  "#6B7280",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#10B981",
]

export const PROFILE_POST_LINK_DISPLAY_MODE_OPTIONS = [
  { value: "SLUG", label: "slug 模式（/posts/标题-id）" },
  { value: "ID", label: "id 模式（/posts/id）" },
] as const

export const PROFILE_POST_SLUG_GENERATION_MODE_OPTIONS = [
  { value: "TITLE_TIMESTAMP", label: "标题 + 毫秒时间戳" },
  { value: "TIME36", label: "Date.now().toString(36)" },
  { value: "PINYIN_TIME36", label: "拼音 + 秒级 36 进制" },
  { value: "TITLE_TIME36", label: "标题 + 秒级 36 进制" },
] as const

export const PROFILE_HOME_FEED_DISPLAY_MODE_OPTIONS = [
  { value: POST_LIST_DISPLAY_MODE_DEFAULT, label: "普通列表" },
  { value: POST_LIST_DISPLAY_MODE_GALLERY, label: "画廊模式" },
] as const

export const PROFILE_HOME_FEED_LOAD_MODE_OPTIONS = [
  { value: POST_LIST_LOAD_MODE_PAGINATION, label: "分页加载" },
  { value: POST_LIST_LOAD_MODE_INFINITE, label: "无限下拉" },
] as const

export const PROFILE_LEFT_SIDEBAR_DISPLAY_MODE_OPTIONS = [
  { value: "DEFAULT", label: "默认展示（当前样式）" },
  { value: "HIDDEN", label: "隐藏左侧导航" },
  { value: "DOCKED", label: "吸附左侧并默认隐藏" },
] as const

export const INTERNAL_SETTING_TABS: Record<
  AdminBasicSettingsMode,
  Array<{ key: string; label: string }>
> = {
  profile: [
    { key: "branding", label: "品牌基础" },
    { key: "homepage", label: "首页展示" },
    { key: "seo", label: "SEO 与统计" },
  ],
  registration: [
    { key: "invite", label: "注册与邀请码" },
    { key: "invite-codes", label: "邀请码管理" },
    { key: "captcha", label: "验证码" },
    { key: "fields", label: "表单字段" },
    { key: "security", label: "安全" },
    { key: "email-templates", label: "邮件模板" },
    { key: "auth", label: "第三方登录" },
    { key: "smtp", label: "SMTP 邮件" },
  ],
  interaction: [
    { key: "comments", label: "评论展示" },
    { key: "content-limits", label: "内容限制" },
    { key: "anonymous-post", label: "匿名发帖" },
    { key: "tipping", label: "打赏送礼" },
    { key: "gates", label: "发布门槛" },
    { key: "reward-pool", label: "红包与聚宝盆" },
    { key: "heat", label: "热度算法" },
    { key: "preview", label: "热度预览" },
  ],
  "board-applications": [
    { key: "general", label: "基础设置" },
  ],
}

const INTERNAL_SETTING_TAB_DEFAULT: Record<AdminBasicSettingsMode, string> = {
  profile: "branding",
  registration: "invite",
  interaction: "comments",
  "board-applications": "general",
}

export function resolveInternalSettingTab(
  mode: AdminBasicSettingsMode,
  initialSubTab?: string,
) {
  if (mode === "interaction" && initialSubTab === "comment-tip") {
    return "comments"
  }

  const availableTabs = INTERNAL_SETTING_TABS[mode]

  return availableTabs.some((tab) => tab.key === initialSubTab)
    ? initialSubTab!
    : INTERNAL_SETTING_TAB_DEFAULT[mode]
}
