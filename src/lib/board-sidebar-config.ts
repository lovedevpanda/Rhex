interface UnknownRecord {
  [key: string]: unknown
}

export interface BoardSidebarLinkItem {
  title: string
  url: string
  icon: string | null
  titleColor: string | null
}

export interface BoardSidebarConfig {
  links: BoardSidebarLinkItem[]
  rulesMarkdown: string | null
  moderatorsCanWithdrawTreasury: boolean
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

function normalizeRequiredText(value: unknown) {
  return normalizeOptionalText(value) ?? ""
}

function normalizeBoardSidebarLinkItem(value: unknown): BoardSidebarLinkItem | null {
  const item = isRecord(value) ? value : null
  const title = normalizeRequiredText(item?.title)
  const url = normalizeRequiredText(item?.url)

  if (!title || !url) {
    return null
  }

  return {
    title,
    url,
    icon: normalizeOptionalText(item?.icon),
    titleColor: normalizeOptionalText(item?.titleColor),
  }
}

export function normalizeBoardSidebarLinks(raw: unknown): BoardSidebarLinkItem[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => normalizeBoardSidebarLinkItem(item))
    .filter((item): item is BoardSidebarLinkItem => Boolean(item))
}

export function normalizeBoardSidebarConfig(value: unknown): BoardSidebarConfig {
  const config = isRecord(value) ? value : null
  const sidebar = isRecord(config?.sidebar) ? config.sidebar : null
  const boardTreasury = isRecord(config?.boardTreasury) ? config.boardTreasury : null
  const legacyLink = normalizeBoardSidebarLinkItem(isRecord(sidebar?.link) ? sidebar.link : null)
  const links = normalizeBoardSidebarLinks(sidebar?.links)

  return {
    links: links.length > 0 ? links : legacyLink ? [legacyLink] : [],
    rulesMarkdown: normalizeOptionalText(sidebar?.rulesMarkdown),
    moderatorsCanWithdrawTreasury: typeof boardTreasury?.moderatorsCanWithdrawTreasury === "boolean"
      ? boardTreasury.moderatorsCanWithdrawTreasury
      : false,
  }
}
