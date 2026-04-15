import type { AdminSettingsSectionKey } from "@/lib/admin-navigation"

export interface AdminSettingsSubTabItem {
  key: string
  label: string
}

export interface ResolvedAdminSettingsRoute {
  section: AdminSettingsSectionKey
  sectionLabel: string
  subTab?: string
  subTabLabel?: string
  href: string
}

const adminSettingsSectionDetails: Record<
  Exclude<AdminSettingsSectionKey, "invite-codes" | "redeem-codes">,
  {
    label: string
    defaultSubTab?: string
    subTabs: readonly AdminSettingsSubTabItem[]
  }
> = {
  profile: {
    label: "基础信息",
    defaultSubTab: "branding",
    subTabs: [
      { key: "branding", label: "品牌基础" },
      { key: "homepage", label: "首页展示" },
      { key: "seo", label: "SEO 与统计" },
    ],
  },
  "markdown-emoji": {
    label: "Markdown 表情",
    subTabs: [],
  },
  "footer-links": {
    label: "页脚导航",
    subTabs: [],
  },
  apps: {
    label: "应用导航",
    subTabs: [],
  },
  registration: {
    label: "注册与邀请",
    defaultSubTab: "invite",
    subTabs: [
      { key: "invite", label: "注册与邀请码" },
      { key: "invite-codes", label: "邀请码管理" },
      { key: "captcha", label: "验证码" },
      { key: "fields", label: "表单字段" },
      { key: "security", label: "安全" },
      { key: "email-templates", label: "邮件模板" },
      { key: "auth", label: "第三方登录" },
      { key: "smtp", label: "SMTP 邮件" },
    ],
  },
  "board-applications": {
    label: "节点申请设置",
    defaultSubTab: "general",
    subTabs: [{ key: "general", label: "基础设置" }],
  },
  interaction: {
    label: "互动与热度",
    defaultSubTab: "comments",
    subTabs: [
      { key: "comments", label: "评论展示" },
      { key: "content-limits", label: "内容限制" },
      { key: "anonymous-post", label: "匿名发帖" },
      { key: "tipping", label: "打赏送礼" },
      { key: "gates", label: "发布门槛" },
      { key: "reward-pool", label: "红包与聚宝盆" },
      { key: "heat", label: "热度算法" },
      { key: "preview", label: "热度预览" },
    ],
  },
  "friend-links": {
    label: "友情链接",
    subTabs: [],
  },
  vip: {
    label: "积分与VIP",
    defaultSubTab: "points-vip",
    subTabs: [
      { key: "points-vip", label: "积分与VIP" },
      { key: "redeem-codes", label: "兑换码管理" },
    ],
  },
  upload: {
    label: "上传",
    defaultSubTab: "storage",
    subTabs: [
      { key: "storage", label: "上传配置" },
      { key: "watermark", label: "水印配置" },
      { key: "attachment", label: "附件配置" },
    ],
  },
}

const legacySectionAliases: Partial<Record<AdminSettingsSectionKey, { section: keyof typeof adminSettingsSectionDetails; subTab?: string }>> = {
  "invite-codes": { section: "registration", subTab: "invite-codes" },
  "redeem-codes": { section: "vip", subTab: "redeem-codes" },
}

const subTabAliases: Partial<Record<keyof typeof adminSettingsSectionDetails, Record<string, string>>> = {
  interaction: {
    "comment-tip": "comments",
  },
  upload: {
    upload: "storage",
  },
}

const DEFAULT_SECTION: keyof typeof adminSettingsSectionDetails = "profile"

export function getAdminSettingsSectionTabs(section: AdminSettingsSectionKey | keyof typeof adminSettingsSectionDetails) {
  const resolvedSection = normalizeAdminSettingsSection(section)
  if (!resolvedSection) {
    return []
  }
  return adminSettingsSectionDetails[resolvedSection].subTabs
}

export function getAdminSettingsHref(section: AdminSettingsSectionKey, subTab?: string): string {
  const resolvedSection = normalizeAdminSettingsSection(section)
  if (!resolvedSection) {
    return getDefaultAdminSettingsHref()
  }
  const resolvedSubTab = resolveSectionSubTab(resolvedSection, subTab)
  return resolvedSubTab
    ? `/admin/settings/${resolvedSection}/${resolvedSubTab}`
    : `/admin/settings/${resolvedSection}`
}

export function getDefaultAdminSettingsHref(): string {
  return getAdminSettingsHref(DEFAULT_SECTION)
}

export function resolveAdminSettingsRoute(input: {
  section?: string | null
  subTab?: string | null
}): ResolvedAdminSettingsRoute | null {
  const requestedSection = input.section?.trim() ?? ""
  const requestedSubTab = input.subTab?.trim() ?? ""

  if (!requestedSection) {
    return buildResolvedRoute(DEFAULT_SECTION)
  }

  const alias = legacySectionAliases[requestedSection as AdminSettingsSectionKey]
  if (alias) {
    return buildResolvedRoute(alias.section, alias.subTab ?? requestedSubTab)
  }

  const normalizedSection = normalizeAdminSettingsSection(requestedSection)
  if (!normalizedSection) {
    return null
  }

  return buildResolvedRoute(normalizedSection, requestedSubTab)
}

export function resolveAdminSettingsRouteFromSegments(segments?: string[] | null) {
  if (!segments || segments.length === 0) {
    return buildResolvedRoute(DEFAULT_SECTION)
  }

  if (segments.length > 2) {
    return null
  }

  return resolveAdminSettingsRoute({
    section: segments[0] ?? "",
    subTab: segments[1] ?? "",
  })
}

function buildResolvedRoute(
  section: keyof typeof adminSettingsSectionDetails,
  subTab?: string
): ResolvedAdminSettingsRoute {
  const details = adminSettingsSectionDetails[section]
  const resolvedSubTab = resolveSectionSubTab(section, subTab)
  const subTabItem = details.subTabs.find((item) => item.key === resolvedSubTab)

  return {
    section,
    sectionLabel: details.label,
    subTab: resolvedSubTab,
    subTabLabel: subTabItem?.label,
    href: resolvedSubTab ? `/admin/settings/${section}/${resolvedSubTab}` : `/admin/settings/${section}`,
  }
}

function normalizeAdminSettingsSection(section: string | AdminSettingsSectionKey | undefined | null) {
  if (!section) {
    return null
  }

  return Object.prototype.hasOwnProperty.call(adminSettingsSectionDetails, section)
    ? (section as keyof typeof adminSettingsSectionDetails)
    : null
}

function resolveSectionSubTab(
  section: keyof typeof adminSettingsSectionDetails,
  subTab?: string
) {
  const details = adminSettingsSectionDetails[section]

  if (details.subTabs.length === 0) {
    return undefined
  }

  const normalizedSubTab = subTab?.trim()
  const aliasedSubTab = normalizedSubTab ? subTabAliases[section]?.[normalizedSubTab] ?? normalizedSubTab : undefined
  if (aliasedSubTab && details.subTabs.some((item) => item.key === aliasedSubTab)) {
    return aliasedSubTab
  }

  return details.defaultSubTab ?? details.subTabs[0]?.key
}
