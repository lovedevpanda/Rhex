"use client"

import { Compass, ExternalLink, EyeOff, type LucideIcon } from "lucide-react"
import { useSyncExternalStore } from "react"

import {
  DEFAULT_BROWSING_PREFERENCES,
  readBrowsingPreferencesSnapshot,
  subscribeBrowsingPreferences,
  updateBrowsingPreferences,
} from "@/lib/browsing-preferences"
import { cn } from "@/lib/utils"

export function BrowsingSettingsPanel() {
  const preferences = useSyncExternalStore(
    subscribeBrowsingPreferences,
    readBrowsingPreferencesSnapshot,
    () => DEFAULT_BROWSING_PREFERENCES,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
          <Compass className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">浏览设置</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">以下偏好只保存在当前浏览器本地，不会同步到服务器。</p>
        </div>
      </div>

      <div className="space-y-3">
        <PreferenceRow
          icon={EyeOff}
          title="已读链接标识"
          description="开启后，已访问的帖子标题会变暗，仅对帖子列表标题生效。"
          checked={preferences.dimReadPostTitles}
          onChange={(checked) => updateBrowsingPreferences({ dimReadPostTitles: checked })}
        />
        <PreferenceRow
          icon={ExternalLink}
          title="新标签页打开帖子"
          description="若开启，点击帖子链接时，将在新标签页中打开帖子页面。"
          checked={preferences.openPostLinksInNewTab}
          onChange={(checked) => updateBrowsingPreferences({ openPostLinksInNewTab: checked })}
        />
      </div>
    </div>
  )
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[20px] border border-border bg-secondary/20 px-4 py-3 transition-colors hover:bg-accent/40">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(event) => {
          event.preventDefault()
          onChange(!checked)
        }}
        className={cn(
          "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors",
          checked
            ? "bg-foreground text-background"
            : "border border-border bg-background text-muted-foreground",
        )}
      >
        {checked ? "已开启" : "已关闭"}
      </button>
    </label>
  )
}
