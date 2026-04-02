"use client"

import { createContext, useContext, useMemo } from "react"

import { DEFAULT_MARKDOWN_EMOJI_ITEMS, type MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { DEFAULT_VIP_LEVEL_ICONS, normalizeVipLevelIcons, type VipLevelIcons } from "@/lib/vip-level-icons"

interface SiteSettingsContextValue {
  markdownEmojiMap: MarkdownEmojiItem[]
  markdownImageUploadEnabled: boolean
  vipLevelIcons: VipLevelIcons
}

const defaultSiteSettingsContextValue: SiteSettingsContextValue = {
  markdownEmojiMap: DEFAULT_MARKDOWN_EMOJI_ITEMS,
  markdownImageUploadEnabled: true,
  vipLevelIcons: DEFAULT_VIP_LEVEL_ICONS,
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>(defaultSiteSettingsContextValue)

interface SiteSettingsProviderProps {
  children: React.ReactNode
  markdownEmojiMap?: MarkdownEmojiItem[]
  markdownImageUploadEnabled?: boolean
  vipLevelIcons?: VipLevelIcons
}

export function SiteSettingsProvider({ children, markdownEmojiMap, markdownImageUploadEnabled = true, vipLevelIcons }: SiteSettingsProviderProps) {
  const value = useMemo<SiteSettingsContextValue>(() => ({
    markdownEmojiMap: markdownEmojiMap && markdownEmojiMap.length > 0 ? markdownEmojiMap : DEFAULT_MARKDOWN_EMOJI_ITEMS,
    markdownImageUploadEnabled,
    vipLevelIcons: normalizeVipLevelIcons(vipLevelIcons),
  }), [markdownEmojiMap, markdownImageUploadEnabled, vipLevelIcons])

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
}

export function useSiteSettingsContext() {
  return useContext(SiteSettingsContext)
}

export function useMarkdownEmojiMap(override?: MarkdownEmojiItem[]) {
  const context = useSiteSettingsContext()
  if (override && override.length > 0) {
    return override
  }
  return context.markdownEmojiMap
}

export function useMarkdownImageUploadEnabled(override?: boolean) {
  const context = useSiteSettingsContext()
  if (typeof override === "boolean") {
    return override
  }
  return context.markdownImageUploadEnabled
}

export function useVipLevelIcons(override?: VipLevelIcons) {
  const context = useSiteSettingsContext()
  if (override) {
    return normalizeVipLevelIcons(override)
  }
  return context.vipLevelIcons
}
