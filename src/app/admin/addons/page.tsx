import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AddonsHostAdminPage } from "@/components/admin/addons-host-admin-page"
import { AdminShell } from "@/components/admin/admin-shell"
import { getAddonsAdminData } from "@/addons-host/management"
import { requireAdminUser } from "@/lib/admin"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `插件宿主 - ${settings.siteName}`,
  }
}

export default async function AdminAddonsPage() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/addons")
  }

  const data = await getAddonsAdminData()

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription="查看已安装的插件、页面、API、Provider、Hook 和挂载状态。"
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "插件管理" },
      ]}
    >
      <AddonsHostAdminPage initialData={data} />
    </AdminShell>
  )
}
