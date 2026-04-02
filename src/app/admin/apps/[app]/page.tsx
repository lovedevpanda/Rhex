import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AdminModuleSearch } from "@/components/admin-module-search"
import { AdminShell } from "@/components/admin-shell"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

import { requireAdminUser } from "@/lib/admin"
import { getHostAppBySlug } from "@/lib/apps"
import type { ComponentType } from "react"

import { getGobangAppConfig, getSelfServeAdsAppConfig, getYinYangContractAppConfig } from "@/lib/app-config"
import { GobangAdminPage } from "@/components/gobang-admin-page"
import { SelfServeAdsAdminPage } from "@/components/self-serve-ads-admin-page"
import { YinYangContractAdminPage } from "@/components/yinyang-contract-admin-page"
import { getSiteSettings } from "@/lib/site-settings"




export async function generateMetadata(props: PageProps<"/admin/apps/[app]">): Promise<Metadata> {
  const params = await props.params
  const [app, settings] = await Promise.all([Promise.resolve(getHostAppBySlug(params.app)), getSiteSettings()])

  return {
    title: `${app?.name ?? "应用后台"} - ${settings.siteName}`,
  }
}

export default async function AdminAppPage(props: PageProps<"/admin/apps/[app]">) {
  const params = await props.params;
  const admin = await requireAdminUser()
  if (!admin) {
    redirect(`/login?redirect=/admin/apps/${params.app}`)
  }

  const app = getHostAppBySlug(params.app)
  if (!app) {
    notFound()
  }

  if (app.slug === "gobang") {
    const config = await getGobangAppConfig()
    const AppAdminComponent = GobangAdminPage as ComponentType<{ AppId: string; config: Record<string, boolean | number | string> }>
    return (
      <AdminShell currentTab="/admin/apps" adminName={admin.nickname ?? admin.username}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-[24px] border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前模块</p>
              <h2 className="text-lg font-semibold">{app.name} · 应用后台</h2>
            </div>
            <AdminModuleSearch className="md:ml-auto" />
          </div>
   
          <AppAdminComponent AppId="gobang" config={config} />
        </div>
      </AdminShell>
    )
  }

  if (app.slug === "self-serve-ads") {
    const config = await getSelfServeAdsAppConfig()
    const AppAdminComponent = SelfServeAdsAdminPage as ComponentType<{ AppId: string; config: Record<string, boolean | number | string> }>
    return (
      <AdminShell currentTab="/admin/apps" adminName={admin.nickname ?? admin.username}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-[24px] border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前模块</p>
              <h2 className="text-lg font-semibold">{app.name} · 应用后台</h2>
            </div>
            <AdminModuleSearch className="md:ml-auto" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{app.name} · 应用后台</CardTitle>
            </CardHeader>
          </Card>
          <AppAdminComponent AppId="self-serve-ads" config={config} />
        </div>
      </AdminShell>
    )
  }

  if (app.slug === "yinyang-contract") {
    const config = await getYinYangContractAppConfig()
    const AppAdminComponent = YinYangContractAdminPage as ComponentType<{ AppId: string; config: Record<string, boolean | number | string> }>
    return (
      <AdminShell currentTab="/admin/apps" adminName={admin.nickname ?? admin.username}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-[24px] border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前模块</p>
              <h2 className="text-lg font-semibold">{app.name} · 应用后台</h2>
            </div>
            <AdminModuleSearch className="md:ml-auto" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{app.name} · 应用后台</CardTitle>
            </CardHeader>
          </Card>
          <AppAdminComponent AppId="yinyang-contract" config={config} />
        </div>
      </AdminShell>
    )
  }

  notFound()
}

