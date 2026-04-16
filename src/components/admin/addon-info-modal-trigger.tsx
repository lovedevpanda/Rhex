"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type { AddonAdminItem, AddonAdminDetailData, AddonExtensionPointItem } from "@/addons-host/admin-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"

function getStorageModeLabel(storageMode: AddonAdminDetailData["storageMode"]) {
  return storageMode === "database" ? "Prisma Registry" : "File Fallback"
}

export function AddonInfoModalTrigger({
  addon,
  storageMode,
  extensionPointSections = [],
}: {
  addon: AddonAdminItem
  storageMode: AddonAdminDetailData["storageMode"]
  extensionPointSections?: Array<{
    title: string
    items: AddonExtensionPointItem[]
  }>
}) {
  const [open, setOpen] = useState(false)
  const hasPublicPage = addon.counts.publicPages > 0
  const hasPublicApi = addon.counts.publicApis > 0

  const detailItems = useMemo(() => ([
    { label: "标识", value: addon.id },
    { label: "作者", value: addon.author ?? "未填写" },
    { label: "版本", value: addon.version },
    { label: "公开页", value: String(addon.counts.publicPages) },
    { label: "后台页", value: String(addon.counts.adminPages) },
    { label: "公开 API", value: String(addon.counts.publicApis) },
    { label: "后台 API", value: String(addon.counts.adminApis) },
    { label: "Slots", value: String(addon.counts.slots) },
    { label: "Surfaces", value: String(addon.counts.surfaces) },
    { label: "Providers", value: String(addon.counts.providers) },
    { label: "Hooks", value: String(addon.counts.hooks) },
  ]), [addon])

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        查看插件信息
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${addon.name} · 插件信息`}
        description={addon.description}
        size={extensionPointSections.length > 0 ? "xl" : "lg"}
        footer={(
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{getStorageModeLabel(storageMode)}</Badge>
            <Badge variant="outline">{addon.enabled ? "已启用" : "已禁用"}</Badge>
            {addon.loadError ? <Badge variant="destructive">加载失败</Badge> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {detailItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 break-all text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>

          {hasPublicPage || hasPublicApi ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">相关入口</p>
              <div className="flex flex-wrap gap-2">
                {hasPublicPage ? (
                  <Link href={addon.paths.publicPage} className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                    打开前台页
                  </Link>
                ) : null}
                {hasPublicApi ? (
                  <Link href={addon.paths.publicApiBase} className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                    公开 API 根路径
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-medium">权限声明</p>
            {addon.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {addon.permissions.map((permission) => (
                  <Badge key={permission} variant="outline">{permission}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">当前没有声明权限项。</p>
            )}
          </div>

          {extensionPointSections.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium">已注册扩展点</p>
              <div className="grid gap-4 xl:grid-cols-3">
                {extensionPointSections.map((section) => (
                  <div key={section.title} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{section.title}</p>
                      <Badge variant="outline">{section.items.length}</Badge>
                    </div>
                    {section.items.length > 0 ? (
                      <div className="space-y-2">
                        {section.items.map((item) => (
                          <div key={`${section.title}:${item.label}:${item.meta}`} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                            {item.description ? (
                              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                        当前没有注册这类扩展点。
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
