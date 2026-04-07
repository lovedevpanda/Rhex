"use client"

import type { ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, Settings2 } from "lucide-react"

import { SettingsSidebarNav, type SettingsNavItem } from "@/components/settings-sidebar-nav"
import { Button } from "@/components/ui/button"

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
  boardApplicationEnabled: boolean
  children: ReactNode
}

export function SettingsShell({ children, pointName, boardApplicationEnabled }: SettingsShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab") ?? "profile"
  const mobileView = searchParams.get("mobile")
  const showMobileDetail = mobileView === "detail"
  const navItems: SettingsNavItem[] = [
    { key: "profile", label: "基础设置", description: "维护基础资料、头像、邮箱与密码。" },
    { key: "invite", label: "邀请中心", description: "查看邀请数据并管理邀请入口。" },
    { key: "post-management", label: "帖子管理", description: "查看我的帖子、回复、收藏与点赞。" },
    ...(boardApplicationEnabled ? [{ key: "board-applications", label: "节点申请", description: "申请新建节点并查看自己的审核记录。" }] : []),
    { key: "level", label: "我的等级", description: "查看成长进度、升级条件与当前等级。" },
    { key: "badges", label: "勋章中心", description: "查看已达成状态并手动领取勋章。" },
    { key: "verifications", label: "账号认证", description: "提交个人认证、商家认证等身份申请。" },
    { key: "points", label: `${pointName}明细`, description: `查看当前${pointName}余额与全部变动记录。` },
    { key: "follows", label: "我的关注", description: "查看你关注的节点、用户、标签与帖子。" },
  ] satisfies SettingsNavItem[]
  const currentItem = navItems.find((item) => item.key === currentTab) ?? navItems[0]

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        {showMobileDetail ? (
          <div className="space-y-4">
            <div className="sticky top-16 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-3"
                  onClick={() => router.push(`/settings?tab=${currentItem.key}`)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  设置
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{currentItem.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentItem.description}</p>
                </div>
              </div>
            </div>

            <section className="min-w-0">{children}</section>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[28px] border border-border bg-[linear-gradient(160deg,rgba(15,23,42,0.06),rgba(15,23,42,0.02),transparent)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold">设置中心</p>
                </div>
              </div>
            </div>

            <SettingsSidebarNav
              items={navItems}
              title="Settings"
              showDescriptions
              buildHref={(item) => `/settings?tab=${item.key}&mobile=detail`}
              className="p-3"
            />
          </div>
        )}
      </div>

      <div className="hidden gap-5 lg:grid lg:grid-cols-[220px,minmax(0,1fr)] xl:grid-cols-[236px,minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SettingsSidebarNav items={navItems} />
        </aside>

        <section className="min-w-0 lg:min-h-[720px]">{children}</section>
      </div>
    </div>
  )
}
