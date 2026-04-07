"use client"

import { Palette, Settings2 } from "lucide-react"
import { Compass, ExternalLink, EyeOff, MessageSquareText, Sparkles, type LucideIcon } from "lucide-react"
import { useState, useSyncExternalStore } from "react"

import { CustomThemeModal } from "@/components/custom-theme-modal"
import {
  DEFAULT_BROWSING_PREFERENCES,
  readBrowsingPreferencesSnapshot,
  subscribeBrowsingPreferences,
  updateBrowsingPreferences,
} from "@/lib/browsing-preferences"
import { DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT, readThemeLocalSettingsSnapshot, subscribeThemeSettings } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function BrowsingSettingsPanel() {
  const preferences = useSyncExternalStore(
    subscribeBrowsingPreferences,
    readBrowsingPreferencesSnapshot,
    () => DEFAULT_BROWSING_PREFERENCES,
  )
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const themeSettings = useSyncExternalStore(
    subscribeThemeSettings,
    readThemeLocalSettingsSnapshot,
    () => DEFAULT_THEME_LOCAL_SETTINGS_SNAPSHOT,
  )
  const customTypography = themeSettings.customThemeConfig.typography
  const customFontLabel = customTypography.fontFamily.split(",")[0]?.replace(/["']/g, "").trim() || "默认字体"
  const customThemeSummary = themeSettings.preset === "custom"
    ? `已启用 · ${themeSettings.preference === "system" ? "跟随系统" : themeSettings.preference === "dark" ? "深色" : "浅色"} / ${customFontLabel} / ${customTypography.fontSize}`
    : "未启用"

  return (
    <>
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
          <ChoiceRow
            icon={MessageSquareText}
            title="评论区视图"
            description="控制帖子详情页评论区默认以树形嵌套还是平铺展开显示。"
            value={preferences.commentThreadDisplayMode}
            options={[
              { value: "tree", label: "树形" },
              { value: "flat", label: "平铺" },
            ]}
            onChange={(value) => updateBrowsingPreferences({ commentThreadDisplayMode: value })}
          />
          <ChoiceRow
            icon={Sparkles}
            title="红包 / 聚宝盆动画"
            description="控制帖子详情页首屏奖励池入场动画的播放策略。"
            value={preferences.rewardPoolIntroAnimationMode}
            options={[
              { value: "always", label: "每次播放" },
              { value: "once-per-tab", label: "仅当前标签页一次" },
              { value: "never", label: "不播放" },
            ]}
            onChange={(value) => updateBrowsingPreferences({ rewardPoolIntroAnimationMode: value })}
          />
          <ActionRow
            icon={Palette}
            title="自定义主题"
            description="可分别设置浅色 / 深色模式配色，并单独指定字体、字号，还能直接查看生成后的原始 CSS。"
            summary={customThemeSummary}
            actionLabel="打开设置"
            onAction={() => setThemeModalOpen(true)}
          />
        </div>
      </div>
      <CustomThemeModal open={themeModalOpen} onClose={() => setThemeModalOpen(false)} />
    </>
  )
}

function ChoiceRow<T extends string>({
  icon: Icon,
  title,
  description,
  value,
  options,
  onChange,
}: {
  icon: LucideIcon
  title: string
  description: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-border bg-secondary/20 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors",
              item.value === value
                ? "bg-foreground text-background"
                : "border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
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

function ActionRow({
  icon: Icon,
  title,
  description,
  summary,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon
  title: string
  description: string
  summary: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-border bg-secondary/20 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">{title}</div>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{summary}</span>
          </div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onAction}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Settings2 className="h-3.5 w-3.5" />
        <span>{actionLabel}</span>
      </button>
    </div>
  )
}
