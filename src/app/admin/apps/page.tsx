import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { HOST_APPS } from "@/lib/apps"
import { requireAdminUser } from "@/lib/admin"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `应用中心 - ${settings.siteName}`,
  }
}

export default async function AdminAppsPage() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps")
  }

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="统一管理站点内置应用和每个应用的独立后台入口。"
      headerSearch={<AdminModuleSearch className="w-full" />}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>插件</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="rounded-xl border border-border p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">System</p>
                <h3 className="mt-2 text-lg font-semibold">addons-host</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  管理 `addons/` 目录下的外部插件，查看宿主扫描结果、公开页面、后台页、API、Provider 和状态。
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link href="/admin/addons" className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 transition-colors hover:bg-accent hover:text-accent-foreground">打开插件</Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>应用</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 py-4 lg:grid-cols-4">
            {HOST_APPS.map((app) => (
              <div key={app.id} className="rounded-xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{app.category}</p>
                    <h3 className="mt-2 text-lg font-semibold">{app.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{app.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Link href={app.href} className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 transition-colors hover:bg-accent hover:text-accent-foreground">打开应用</Link>
                  <Link href={app.adminHref} className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 transition-colors hover:bg-accent hover:text-accent-foreground">应用后台</Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
