import type { LucideIcon } from "lucide-react"
import {
  AppWindow,
  BookText,
  Files,
  FileCode2,
  Flag,
  LayoutGrid,
  Logs,
  Megaphone,
  MessageSquare,
  Settings,
  Settings2,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react"

import { getAdminSettingsHref } from "@/lib/admin-settings-navigation"

export type AdminTabKey =
  | "overview"
  | "users"
  | "posts"
  | "comments"
  | "structure"
  | "board-applications"
  | "levels"
  | "badges"
  | "verifications"
  | "announcements"
  | "custom-pages"
  | "reports"
  | "attachments"
  | "logs"
  | "security"
  | "settings"

export type AdminNavKey = AdminTabKey | "apps"

export type AdminSettingsSectionKey =
  | "profile"
  | "markdown-emoji"
  | "footer-links"
  | "apps"
  | "registration"
  | "board-applications"
  | "interaction"
  | "friend-links"
  | "invite-codes"
  | "redeem-codes"
  | "vip"
  | "upload"

export type AdminVerificationSubTabKey = "types" | "reviews"

type AdminNavigationGroupKey =
  | "overview"
  | "community"
  | "operations"
  | "system"

export interface AdminNavigationItem {
  key: AdminNavKey
  href: string
  label: string
  description: string
  icon: LucideIcon
  group: AdminNavigationGroupKey
  adminOnly?: boolean
  hiddenInNavigation?: boolean
}

export interface AdminNavigationGroup {
  key: AdminNavigationGroupKey
  label: string
  items: AdminNavigationItem[]
}

export const adminTabs: AdminTabKey[] = [
  "overview",
  "users",
  "posts",
  "comments",
  "structure",
  "board-applications",
  "levels",
  "badges",
  "verifications",
  "announcements",
  "custom-pages",
  "reports",
  "attachments",
  "logs",
  "security",
  "settings",
]

export const adminSettingsSections: AdminSettingsSectionKey[] = [
  "profile",
  "markdown-emoji",
  "footer-links",
  "apps",
  "registration",
  "board-applications",
  "interaction",
  "friend-links",
  "invite-codes",
  "redeem-codes",
  "vip",
  "upload",
]

export const sectionsRequiringSiteSettings = new Set<AdminSettingsSectionKey>([
  "profile",
  "markdown-emoji",
  "footer-links",
  "apps",
  "registration",
  "board-applications",
  "interaction",
  "vip",
  "upload",
])

export const adminTabLabels: Record<AdminTabKey, string> = {
  overview: "总览",
  users: "用户管理",
  posts: "帖子管理",
  comments: "评论管理",
  structure: "版块管理",
  "board-applications": "节点申请",
  levels: "等级系统",
  badges: "勋章系统",
  verifications: "认证系统",
  announcements: "站点文档",
  "custom-pages": "自定义页面",
  reports: "举报中心",
  attachments: "附件管理",
  logs: "日志中心",
  security: "内容安全",
  settings: "站点设置",
}

export const adminSettingsGroups = [
  {
    key: "site",
    label: "站点展示",
    defaultSection: "profile",
    sections: [
      { key: "profile", label: "基础信息" },
      { key: "markdown-emoji", label: "Markdown 表情" },
      { key: "footer-links", label: "页脚导航" },
      { key: "apps", label: "应用导航" },
    ],
  },
  {
    key: "registration",
    label: "注册邀请",
    defaultSection: "registration",
    sections: [{ key: "registration", label: "注册与邀请" }],
  },
  {
    key: "community",
    label: "社区互动",
    defaultSection: "interaction",
    sections: [
      { key: "interaction", label: "互动与热度" },
      { key: "board-applications", label: "节点申请" },
      { key: "friend-links", label: "友情链接" },
    ],
  },
  {
    key: "vip",
    label: "积分与VIP",
    defaultSection: "vip",
    sections: [{ key: "vip", label: "积分与VIP" }],
  },
  {
    key: "upload",
    label: "上传",
    defaultSection: "upload",
    sections: [{ key: "upload", label: "上传" }],
  },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  defaultSection: AdminSettingsSectionKey
  sections: ReadonlyArray<{
    key: AdminSettingsSectionKey
    label: string
  }>
}>

const adminNavigationGroupLabels: Record<AdminNavigationGroupKey, string> = {
  overview: "控制台",
  community: "社区与内容",
  operations: "运营与风控",
  system: "系统与扩展",
}

const moderatorNavigationKeys = new Set<AdminNavKey>([
  "posts",
  "comments",
  "structure",
])

export const adminNavigation: AdminNavigationItem[] = [
  {
    key: "overview",
    href: "/admin",
    label: "总览",
    description: "站点核心指标和运营待办。",
    icon: LayoutGrid,
    group: "overview",
  },
  {
    key: "users",
    href: "/admin?tab=users",
    label: "用户管理",
    description: "用户资料、状态与行为管理。",
    icon: Users,
    group: "community",
    adminOnly: true,
  },
  {
    key: "posts",
    href: "/admin?tab=posts",
    label: "帖子管理",
    description: "帖子审核、上下线与推荐。",
    icon: BookText,
    group: "community",
  },
  {
    key: "comments",
    href: "/admin?tab=comments",
    label: "评论管理",
    description: "评论审核、隐藏与恢复。",
    icon: MessageSquare,
    group: "community",
  },
  {
    key: "structure",
    href: "/admin?tab=structure",
    label: "版块管理",
    description: "分区、节点和发帖权限。",
    icon: Settings2,
    group: "community",
  },
  {
    key: "board-applications",
    href: "/admin?tab=board-applications",
    label: "节点申请",
    description: "处理节点申请和审核流转。",
    icon: Settings2,
    group: "operations",
    adminOnly: true,
    hiddenInNavigation: true,
  },
  {
    key: "levels",
    href: "/admin?tab=levels",
    label: "等级系统",
    description: "经验值和等级规则。",
    icon: Sparkles,
    group: "system",
    adminOnly: true,
  },
  {
    key: "badges",
    href: "/admin?tab=badges",
    label: "勋章系统",
    description: "勋章规则、展示与效果。",
    icon: Sparkles,
    group: "system",
    adminOnly: true,
  },
  {
    key: "verifications",
    href: "/admin?tab=verifications",
    label: "认证系统",
    description: "认证类型和审核流程。",
    icon: ShieldAlert,
    group: "operations",
    adminOnly: true,
  },
  {
    key: "announcements",
    href: "/admin?tab=announcements",
    label: "站点文档",
    description: "公告和帮助文档。",
    icon: Megaphone,
    group: "operations",
    adminOnly: true,
  },
  {
    key: "custom-pages",
    href: "/admin?tab=custom-pages",
    label: "自定义页面",
    description: "独立 HTML 页面和自定义路由。",
    icon: FileCode2,
    group: "operations",
    adminOnly: true,
  },
  {
    key: "reports",
    href: "/admin?tab=reports",
    label: "举报中心",
    description: "举报处置和风险流转。",
    icon: Flag,
    group: "operations",
    adminOnly: true,
  },
  {
    key: "attachments",
    href: "/admin?tab=attachments",
    label: "附件管理",
    description: "上传资源、引用状态和无引用清理。",
    icon: Files,
    group: "operations",
    adminOnly: true,
  },
  {
    key: "logs",
    href: "/admin?tab=logs",
    label: "日志中心",
    description: "后台、登录、积分与上传日志。",
    icon: Logs,
    group: "operations",
    adminOnly: true,
  },
  {
    key: "security",
    href: "/admin?tab=security",
    label: "内容安全",
    description: "敏感词和内容风控。",
    icon: ShieldAlert,
    group: "operations",
    adminOnly: true,
  },
   {
    key: "apps",
    href: "/admin/apps",
    label: "应用中心",
    description: "内置应用与独立后台入口。",
    icon: AppWindow,
    group: "system",
    adminOnly: true,
  },
  {
    key: "settings",
    href: getAdminSettingsHref("profile"),
    label: "站点设置",
    description: "展示、注册、互动和上传配置。",
    icon: Settings,
    group: "system",
    adminOnly: true,
  },
 
]

export function getAllowedAdminTabs(role: "ADMIN" | "MODERATOR") {
  return role === "ADMIN"
    ? adminTabs
    : (["posts", "comments", "structure"] satisfies AdminTabKey[])
}

export function getAdminNavigation(
  role: "ADMIN" | "MODERATOR",
  items = adminNavigation
) {
  const visibleItems = items.filter((item) => !item.hiddenInNavigation)

  if (role === "ADMIN") {
    return visibleItems
  }

  return visibleItems.filter((item) => moderatorNavigationKeys.has(item.key))
}

export function getAdminNavigationGroups(
  role: "ADMIN" | "MODERATOR",
  items = adminNavigation
): AdminNavigationGroup[] {
  const resolvedItems = getAdminNavigation(role, items)

  return (Object.keys(adminNavigationGroupLabels) as AdminNavigationGroupKey[])
    .map((key) => ({
      key,
      label: adminNavigationGroupLabels[key],
      items: resolvedItems.filter((item) => item.group === key),
    }))
    .filter((group) => group.items.length > 0)
}

export function getAdminNavigationItem(key: AdminNavKey) {
  return adminNavigation.find((item) => item.key === key) ?? adminNavigation[0]
}

export function getAdminSettingsGroupForSection(section: string) {
  return (
    adminSettingsGroups.find((group) =>
      group.sections.some((item) => item.key === section)
    ) ?? adminSettingsGroups[0]
  )
}
