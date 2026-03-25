"use client"

import { useMemo, useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { PluginLifecycleRecord, PluginManifest } from "@/lib/plugin-types"

type PluginViewItem = PluginManifest & PluginLifecycleRecord

interface AdminPluginManagerProps {
  initialPlugins: PluginViewItem[]
  pointName: string
}

const statusLabelMap: Record<string, string> = {
  discovered: "已发现",
  active: "运行中",
  disabled: "已停用",
  error: "故障熔断",
}

export function AdminPluginManager({ initialPlugins, pointName }: AdminPluginManagerProps) {
  const [plugins, setPlugins] = useState(initialPlugins)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const installedCount = useMemo(() => plugins.filter((item) => item.enabled).length, [plugins])

  async function refreshPlugins() {
    const response = await fetch("/api/admin/plugins")
    const result = await response.json()
    if (response.ok) {
      setPlugins(result.data)
    }
  }

  function handleAction(pluginId: string, action: "install" | "disable" | "uninstall", options?: { mode?: "clean-db" | "delete-files" }) {
    startTransition(async () => {
      const response = await fetch("/api/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, action, mode: options?.mode ?? "clean-db" }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "操作失败", "插件操作失败")
        return
      }

      toast.success(result.message ?? "操作成功", "插件操作成功")
      await refreshPlugins()
    })
  }

  function handleImportManifest(file: File) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/admin/plugins/import", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "导入失败", "插件导入失败")
        return
      }

      toast.success(result.message ?? "导入成功", "插件导入成功")
      await refreshPlugins()
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-border p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-sm font-semibold">插件中心</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">开发期只维护 <code>plugins</code> 目录，支持激活、停用、清库卸载和彻底卸载。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json,.zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  handleImportManifest(file)
                }
                event.currentTarget.value = ""
              }}
            />
            <Button type="button" variant="outline" disabled={isPending} onClick={() => fileInputRef.current?.click()}>导入插件包</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MetricCard label="插件总数" value={String(plugins.length)} />
          <MetricCard label="运行中" value={String(installedCount)} />
          <MetricCard label="积分货币" value={pointName} />
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1.4fr)_120px_140px_minmax(320px,420px)] gap-4 border-b border-border px-5 py-4 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <div>插件</div>
          <div>版本</div>
          <div>状态</div>
          <div>操作</div>
        </div>
        {plugins.map((plugin) => (
          <div key={plugin.pluginId} className="grid grid-cols-[minmax(0,1.4fr)_120px_140px_minmax(320px,420px)] gap-4 border-b border-border/70 px-5 py-4 last:border-b-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{plugin.displayName}</p>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{plugin.scope}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">{plugin.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">包名：{plugin.packageName}</p>
              {plugin.lastErrorMessage ? <p className="mt-1 text-[11px] text-red-500">最近错误：{plugin.lastErrorMessage}</p> : null}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">{plugin.version}</div>
            <div className="flex items-center">
              <span className={plugin.status === "active" ? "rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700" : plugin.status === "error" ? "rounded-full bg-red-100 px-3 py-1 text-xs text-red-700" : "rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"}>
                {statusLabelMap[plugin.status] ?? plugin.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {plugin.status === "active" ? (
                <>
                  <a href={`/funs/${plugin.slug}`} className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                    {String(plugin.config?.matchLabel ?? plugin.displayName)}
                  </a>
                  <a href={`/admin/plugins/${plugin.slug}`} className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">插件后台</a>
                  <Button type="button" variant="outline" disabled={isPending} onClick={() => handleAction(plugin.pluginId, "disable")}>停用</Button>
                  <Button type="button" variant="outline" disabled={isPending} onClick={() => handleAction(plugin.pluginId, "uninstall", { mode: "clean-db" })}>清库卸载</Button>
                  <Button type="button" variant="outline" disabled={isPending} onClick={() => {
                    const confirmed = window.confirm(`将彻底卸载 ${plugin.displayName}：停用插件、清理插件数据并删除 plugins 目录文件。该操作不可恢复，是否继续？`)
                    if (confirmed) {
                      handleAction(plugin.pluginId, "uninstall", { mode: "delete-files" })
                    }
                  }}>彻底卸载</Button>
                </>
              ) : (
                <>
                  <Button type="button" disabled={isPending} onClick={() => handleAction(plugin.pluginId, "install")}>激活</Button>
                  {(plugin.status === "disabled" || plugin.status === "error") ? <Button type="button" variant="outline" disabled={isPending} onClick={() => handleAction(plugin.pluginId, "uninstall", { mode: "clean-db" })}>清库卸载</Button> : null}
                  {(plugin.status === "disabled" || plugin.status === "error") ? <Button type="button" variant="outline" disabled={isPending} onClick={() => {
                    const confirmed = window.confirm(`将彻底卸载 ${plugin.displayName}：停用插件、清理插件数据并删除 plugins 目录文件。该操作不可恢复，是否继续？`)
                    if (confirmed) {
                      handleAction(plugin.pluginId, "uninstall", { mode: "delete-files" })
                    }
                  }}>彻底卸载</Button> : null}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-dashed border-border bg-secondary/10 p-4 text-xs leading-6 text-muted-foreground">
        说明：清库卸载 = 停用插件 + 清理插件数据；彻底卸载 = 停用插件 + 清理插件数据 + 删除 <code>plugins</code> 下的插件目录文件。
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-secondary/20 px-4 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
