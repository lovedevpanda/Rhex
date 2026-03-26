"use client"

import Link from "next/link"

const settingSections = [
  { key: "profile", label: "基础信息" },
  { key: "markdown-emoji", label: "Markdown 表情" },
  { key: "footer-links", label: "页脚导航" },

  { key: "registration", label: "注册与邀请" },
  { key: "interaction", label: "互动与热度" },
  { key: "friend-links", label: "友情链接" },

  { key: "invite-codes", label: "邀请码" },

  { key: "redeem-codes", label: "兑换码" },
  { key: "vip", label: "VIP" },
  { key: "upload", label: "上传" },
] as const



interface AdminSettingsTabsProps {
  currentSection: string
}

export function AdminSettingsTabs({ currentSection }: AdminSettingsTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[22px] border border-border bg-card p-3">
      {settingSections.map((item) => {
        const active = currentSection === item.key
        return (
          <Link
            key={item.key}
            href={`/admin?tab=settings&section=${item.key}`}
            className={active ? "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background" : "rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
