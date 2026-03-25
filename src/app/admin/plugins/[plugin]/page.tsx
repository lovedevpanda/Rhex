import { redirect, notFound } from "next/navigation"

import { AdminShell } from "@/components/admin-shell"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

import { requireAdminUser } from "@/lib/admin"
import { getPluginInstallation } from "@/lib/plugins"
import { loadPluginPage } from "@/lib/plugin-loader"

interface AdminPluginPageProps {
  params: {
    plugin: string
  }
}

export default async function AdminPluginPage({ params }: AdminPluginPageProps) {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect(`/login?redirect=/admin/plugins/${params.plugin}`)
  }

  const installed = await getPluginInstallation(params.plugin)
  if (!installed || !installed.enabled) {
    notFound()
  }

  const loaded = await loadPluginPage(installed.pluginId, "admin")
  if (!loaded) {
    notFound()
  }

  const PluginComponent = loaded.component as React.ComponentType<{ pluginId: string; config: Record<string, boolean | number | string> }>

  return (
    <AdminShell currentTab="settings" adminName={admin.nickname ?? admin.username}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{loaded.manifest.displayName} · 插件后台 · {loaded.manifest.packageName}</CardTitle>
          </CardHeader>

        </Card>
        <PluginComponent pluginId={installed.pluginId} config={installed.config} />
      </div>
    </AdminShell>
  )
}
