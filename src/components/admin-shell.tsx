import { Settings, ShieldAlert, Flag, LayoutGrid, Settings2, Sparkles, Users, BookText, Logs, Megaphone, AppWindow } from "lucide-react"
import Link from "next/link"
import type { CSSProperties } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const adminNavigation = [
  { href: "/admin", label: "总览", icon: LayoutGrid },
  { href: "/admin?tab=users", label: "用户管理", icon: Users },
  { href: "/admin?tab=posts", label: "帖子管理", icon: BookText },
  { href: "/admin?tab=structure", label: "版块管理", icon: Settings2 },
  { href: "/admin?tab=levels", label: "等级系统", icon: Sparkles },
  { href: "/admin?tab=badges", label: "勋章系统", icon: Sparkles },
  { href: "/admin?tab=verifications", label: "认证系统", icon: ShieldAlert },
  { href: "/admin?tab=announcements", label: "站点文档", icon: Megaphone },
  { href: "/admin?tab=reports", label: "举报中心", icon: Flag },
  { href: "/admin?tab=logs", label: "日志中心", icon: Logs },
  { href: "/admin?tab=security", label: "内容安全", icon: ShieldAlert },
  { href: "/admin/apps", label: "应用", icon: AppWindow },
  { href: "/admin?tab=settings&section=profile", label: "站点设置", icon: Settings },
]

const adminThemeStyle: CSSProperties = {
  colorScheme: "light",
  ["--background" as string]: "35 33% 98%",
  ["--foreground" as string]: "222.2 47.4% 11.2%",
  ["--card" as string]: "0 0% 100%",
  ["--card-foreground" as string]: "222.2 47.4% 11.2%",
  ["--primary" as string]: "24 95% 53%",
  ["--primary-foreground" as string]: "210 40% 98%",
  ["--secondary" as string]: "32 57% 94%",
  ["--secondary-foreground" as string]: "222.2 47.4% 11.2%",
  ["--muted" as string]: "30 25% 94%",
  ["--muted-foreground" as string]: "215.4 16.3% 46.9%",
  ["--accent" as string]: "28 100% 95%",
  ["--accent-foreground" as string]: "24 95% 25%",
  ["--border" as string]: "28 20% 88%",
  ["--ring" as string]: "24 95% 53%",
}

interface AdminShellProps {
  currentTab: string
  adminName: string
  children: React.ReactNode
}

export function AdminShell({ currentTab, adminName, children }: AdminShellProps) {
  return (
    <div
      style={adminThemeStyle}
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_24%),linear-gradient(180deg,#fffdf8_0%,#f6efe5_100%)] text-foreground"
    >
      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <aside className="space-y-5">
          <Card className="overflow-hidden border-none bg-[#17120d] text-white shadow-soft">
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/60">Forum Console</p>
                  <h1 className="mt-1 text-xl font-semibold">后台管理中心</h1>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/70">欢迎回来，{adminName}。</p>
              <div className="mt-5 flex gap-3">
                <Link href="/">
                  <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    返回前台
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          <nav className="space-y-2">
            {adminNavigation.map((item) => {
              const Icon = item.icon
              const active = currentTab === item.href || (item.href.includes("tab=") && currentTab === new URL(`https://local${item.href}`).searchParams.get("tab"))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "flex items-center gap-3 rounded-[24px] bg-foreground px-4 py-3 text-sm font-medium text-background shadow-soft" : "flex items-center gap-3 rounded-[24px] border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  )
}

