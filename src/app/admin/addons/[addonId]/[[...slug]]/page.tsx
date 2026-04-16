import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import type { AddonExtensionPointItem } from "@/addons-host/admin-types"
import { AddonRenderBlock, executeAddonPage, findLoadedAddonById, isAddonRedirectResult } from "@/addons-host"
import { AddonInfoModalTrigger } from "@/components/admin/addon-info-modal-trigger"
import { AddonManagementActionButtons } from "@/components/admin/addon-management-action-buttons"
import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAddonAdminDetailData } from "@/addons-host/management"
import { requireAdminUser } from "@/lib/admin"
import { getSiteSettings } from "@/lib/site-settings"

interface AdminAddonPageProps {
  params: Promise<{
    addonId: string
    slug?: string[]
  }>
}

export async function generateMetadata({ params }: AdminAddonPageProps): Promise<Metadata> {
  const [{ addonId }, settings] = await Promise.all([params, getSiteSettings()])
  const addon = await findLoadedAddonById(addonId)

  return {
    title: `${addon?.manifest.name ?? "插件详情"} - ${settings.siteName}`,
  }
}

export default async function AdminAddonDetailPage({ params }: AdminAddonPageProps) {
  const admin = await requireAdminUser()
  if (!admin) {
    const resolved = await params
    redirect(`/login?redirect=/admin/addons/${resolved.addonId}`)
  }

  const { addonId, slug } = await params
  const addon = await findLoadedAddonById(addonId)
  if (!addon) {
    notFound()
  }
  const addonAdminDetail = await getAddonAdminDetailData(addonId)
  if (!addonAdminDetail) {
    notFound()
  }
  const addonAdminItem = addonAdminDetail.item
  const registeredHookItems: AddonExtensionPointItem[] = [
    ...addon.actionHooks.map((item) => ({
      label: item.hook,
      meta: `action · ${item.key} · order ${item.order ?? 0}${item.title ? ` · ${item.title}` : ""}`,
      description: item.description,
    })),
    ...addon.waterfallHooks.map((item) => ({
      label: item.hook,
      meta: `waterfall · ${item.key} · order ${item.order ?? 0}${item.title ? ` · ${item.title}` : ""}`,
      description: item.description,
    })),
    ...addon.asyncWaterfallHooks.map((item) => ({
      label: item.hook,
      meta: `asyncWaterfall · ${item.key} · order ${item.order ?? 0}${item.title ? ` · ${item.title}` : ""}`,
      description: item.description,
    })),
  ]
  const registeredSlotItems = addon.slots.map((item) => ({
    label: item.slot,
    meta: `${item.key} · order ${item.order ?? 0}${item.title ? ` · ${item.title}` : ""}`,
  }))
  const registeredSurfaceItems = addon.surfaces.map((item) => ({
    label: item.surface,
    meta: `${item.key} · priority ${item.priority ?? 0}${item.title ? ` · ${item.title}` : ""}`,
    description: item.description,
  }))
  const extensionPointSections = [
    { title: "Hooks", items: registeredHookItems },
    { title: "Slots", items: registeredSlotItems },
    { title: "Surfaces", items: registeredSurfaceItems },
  ]

  const resolvedPage = await executeAddonPage("admin", addonId, slug)

  if (resolvedPage && isAddonRedirectResult(resolvedPage.result)) {
    redirect(resolvedPage.result.redirectTo)
  }

  const renderResult = resolvedPage && !isAddonRedirectResult(resolvedPage.result)
    ? resolvedPage.result
    : null

  return (
    <AdminShell
      currentKey="apps"
      adminName={admin.nickname ?? admin.username}
      headerDescription={addon.manifest.description || "插件管理页面"}
      breadcrumbs={[
        { label: "后台控制台", href: "/admin" },
        { label: "插件管理", href: "/admin/addons" },
        { label: addon.manifest.name },
      ]}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{addon.manifest.name}</CardTitle>
              <Badge variant={addon.enabled && !addon.loadError ? "default" : "secondary"}>
                {addon.enabled ? (addon.loadError ? "加载失败" : "已启用") : "已禁用"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4 text-sm">
            <p className="text-muted-foreground">{addon.manifest.description || "暂无描述"}</p>
            <div className="flex flex-wrap gap-2">
              <AddonInfoModalTrigger
                addon={addonAdminItem}
                storageMode={addonAdminDetail.storageMode}
                extensionPointSections={extensionPointSections}
              />
            </div>
            <AddonManagementActionButtons addon={addonAdminItem} refreshOnComplete />
            {addon.loadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
                {addon.loadError}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {resolvedPage ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{resolvedPage.registration.title || "插件后台页"}</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              {renderResult ? (
                <AddonRenderBlock
                  addonId={resolvedPage.addon.manifest.id}
                  blockKey={`${resolvedPage.addon.manifest.id}:${resolvedPage.registration.key}:admin-page`}
                  result={renderResult}
                />
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  )
}
