import type { ReactNode } from "react"

import { SettingsSidebarNav, type SettingsNavItem } from "@/components/settings-sidebar-nav"

interface SettingsShellProps {
  profile: {
    displayName: string
    username: string
    avatarPath?: string | null
    level: number
    levelName?: string
    points: number
    inviteCount: number
  }
  pointName: string
  children: ReactNode
}

export function SettingsShell({ children, pointName }: SettingsShellProps) {
  const navItems: SettingsNavItem[] = [
    { key: "profile", label: "资料设置", description: "维护基础资料、头像、邮箱与密码。" },
    { key: "invite", label: "邀请中心", description: "查看邀请数据并管理邀请入口。" },
    { key: "post-management", label: "帖子管理", description: "查看我的帖子、回复、收藏与点赞。" },
    { key: "level", label: "我的等级", description: "查看成长进度、升级条件与当前等级。" },
    { key: "badges", label: "勋章中心", description: "查看已达成状态并手动领取勋章。" },
    { key: "verifications", label: "账号认证", description: "提交个人认证、商家认证等身份申请。" },
    { key: "points", label: `${pointName}明细`, description: `查看当前${pointName}余额与全部变动记录。` },
    { key: "follows", label: "关注节点", description: "查看你已关注的节点列表。" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[220px,minmax(0,1fr)] xl:grid-cols-[236px,minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SettingsSidebarNav items={navItems} />
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  )
}
