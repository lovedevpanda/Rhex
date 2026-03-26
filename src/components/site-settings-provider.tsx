"use client"

import { createContext, useContext, useMemo } from "react"

import { DEFAULT_MARKDOWN_EMOJI_ITEMS, type MarkdownEmojiItem } from "@/lib/markdown-emoji"

interface SiteSettingsContextValue {
  markdownEmojiMap: MarkdownEmojiItem[]
}

const defaultSiteSettingsContextValue: SiteSettingsContextValue = {
  markdownEmojiMap: DEFAULT_MARKDOWN_EMOJI_ITEMS,
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>(defaultSiteSettingsContextValue)

interface SiteSettingsProviderProps {
  children: React.ReactNode
  markdownEmojiMap?: MarkdownEmojiItem[]
}

export function SiteSettingsProvider({ children, markdownEmojiMap }: SiteSettingsProviderProps) {
  const value = useMemo<SiteSettingsContextValue>(() => ({
    markdownEmojiMap: markdownEmojiMap && markdownEmojiMap.length > 0 ? markdownEmojiMap : DEFAULT_MARKDOWN_EMOJI_ITEMS,
  }), [markdownEmojiMap])

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
