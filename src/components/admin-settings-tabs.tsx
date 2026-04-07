"use client"

import { AdminPillTabs } from "@/components/admin-pill-tabs"

const settingGroups = [
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
    sections: [
      { key: "registration", label: "注册与邀请" },
    ],
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
    sections: [
      { key: "vip", label: "积分与VIP" },
    ],
  },
  {
    key: "upload",
    label: "上传",
    defaultSection: "upload",
    sections: [
      { key: "upload", label: "上传" },
    ],
  },
] as const

interface AdminSettingsTabsProps {
  currentSection: string
}

export function AdminSettingsTabs({ currentSection }: AdminSettingsTabsProps) {
  const activeGroup = settingGroups.find((group) => group.sections.some((section) => section.key === currentSection)) ?? settingGroups[0]

  return (
    <div className="space-y-3 rounded-[22px] border border-border bg-card p-3">
      <AdminPillTabs
        items={settingGroups.map((group) => ({
          key: group.key,
          label: group.label,
          href: `/admin?tab=settings&section=${group.defaultSection}`,
        }))}
        activeKey={activeGroup.key}
        inactiveStyle="outlined"
      />
      {activeGroup.sections.length > 1 ? (
        <AdminPillTabs
          items={activeGroup.sections.map((section) => ({
            key: section.key,
            label: section.label,
            href: `/admin?tab=settings&section=${section.key}`,
          }))}
          activeKey={currentSection}
        />
      ) : null}
    </div>
  )
}
