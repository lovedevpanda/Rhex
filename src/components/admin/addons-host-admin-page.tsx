"use client"

import Link from "next/link"
import { useRef, useState, useTransition } from "react"

import { AddonManagementActionButtons } from "@/components/admin/addon-management-action-buttons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import type { AddonAdminItem, AddonsAdminData } from "@/addons-host/admin-types"

interface AddonsHostAdminPageProps {
  initialData: AddonsAdminData
}

interface AdminApiPayload<TData> {
  code: number
  message?: string
  data?: TData
}

async function postAddonsHostAction(action: "sync" | "clear-cache") {
  const response = await fetch("/api/admin/addons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
    }),
  })

  const result = await response.json() as AdminApiPayload<AddonsAdminData>
  if (!response.ok || result.code !== 0 || !result.data) {
    throw new Error(
      result.message
        ?? (action === "sync" ? "同步插件宿主失败" : "清除插件宿主缓存失败"),
    )
  }

  return result
}

function getStateBadgeVariant(stateLabel: "enabled" | "disabled") {
  switch (stateLabel) {
    case "enabled":
      return "default"
    case "disabled":
      return "secondary"
    default:
      return "secondary"
  }
}

function getStateLabel(stateLabel: "enabled" | "disabled") {
  switch (stateLabel) {
    case "enabled":
      return "已启用"
    case "disabled":
      return "已禁用"
    default:
      return "未知"
  }
}

function getAddonIssueText(addon: AddonAdminItem) {
  if (addon.loadError) {
    return addon.loadError
  }

  if (addon.lastErrorMessage) {
    return addon.lastErrorMessage
  }

  if (addon.warnings.length > 0) {
    return addon.warnings.join("；")
  }

  return "无"
}

export function AddonsHostAdminPage({ initialData }: AddonsHostAdminPageProps) {
  const [data, setData] = useState(initialData)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [enableAfterInstall, setEnableAfterInstall] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [pendingOverviewAction, setPendingOverviewAction] = useState<"sync" | "clear-cache" | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function runOverviewAction(action: "sync" | "clear-cache") {
    startTransition(() => {
      void (async () => {
        try {
          setPendingOverviewAction(action)
          const result = await postAddonsHostAction(action)
          setData(result.data!)
          toast.success(
            result.message
              ?? (action === "sync" ? "插件宿主已同步" : "插件宿主缓存已清除"),
            action === "sync" ? "同步成功" : "清除成功",
          )
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : (action === "sync" ? "同步插件宿主失败" : "清除插件宿主缓存失败"),
            action === "sync" ? "同步失败" : "清除失败",
          )
        } finally {
          setPendingOverviewAction(null)
        }
      })()
    })
  }

  function installAddon() {
    if (!selectedFile) {
      toast.warning("请先选择一个 zip 插件包", "缺少文件")
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData()
          formData.set("file", selectedFile)
          formData.set("replaceExisting", String(replaceExisting))
          formData.set("enableAfterInstall", String(enableAfterInstall))

          const response = await fetch("/api/admin/addons/install", {
            method: "POST",
            body: formData,
          })

          const result = await response.json() as {
            code?: number
            message?: string
            data?: AddonsAdminData
          }

          if (!response.ok || result.code !== 0 || !result.data) {
            throw new Error(result.message ?? "插件安装失败")
          }

          setData(result.data)
          setSelectedFile(null)
          setReplaceExisting(false)
          setEnableAfterInstall(true)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
          toast.success(result.message ?? "插件已安装", "安装成功")
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "插件安装失败", "安装失败")
        }
      })()
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)] xl:items-start">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>安装插件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
              <div className="space-y-2">
                <p className="text-sm font-medium">插件 zip 包</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="block w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  支持 zip 根目录直接包含 `addon.json`，也支持单层插件目录包裹。
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">覆盖已有插件</p>
                    <p className="text-xs text-muted-foreground">如果插件目录已存在，则将旧目录移动到 `.trash` 后再安装新包。</p>
                  </div>
                  <Switch checked={replaceExisting} onCheckedChange={setReplaceExisting} />
                </label>

                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">安装后立即启用</p>
                    <p className="text-xs text-muted-foreground">关闭后仅完成安装，不加载插件页面、插槽和 API。</p>
                  </div>
                  <Switch checked={enableAfterInstall} onCheckedChange={setEnableAfterInstall} />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={installAddon} disabled={isPending || !selectedFile}>
                {isPending ? "安装中..." : "上传并安装"}
              </Button>
              {selectedFile ? (
                <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {selectedFile.name}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>概览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.storageMode === "database" ? "Prisma Registry" : "File Fallback"}</Badge>
              <Badge variant="outline">总数 {data.summary.total}</Badge>
              <Badge variant="default">启用 {data.summary.enabled}</Badge>
              <Badge variant="secondary">禁用 {data.summary.disabled}</Badge>
              <Badge variant="outline">异常 {data.summary.errored}</Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => runOverviewAction("sync")} disabled={isPending}>
                {pendingOverviewAction === "sync" ? "同步中..." : "同步扫描"}
              </Button>
              <Button variant="outline" onClick={() => runOverviewAction("clear-cache")} disabled={isPending}>
                {pendingOverviewAction === "clear-cache" ? "清除中..." : "清除缓存"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              清除缓存会刷新插件宿主运行时缓存，并清掉已经恢复正常插件的残留“最近错误”状态。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>插件列表</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>插件</TableHead>
                <TableHead className="w-[140px]">作者</TableHead>
                <TableHead className="w-[100px]">版本</TableHead>
                <TableHead className="w-[180px]">状态</TableHead>
                <TableHead className="w-[320px]">最近错误 / 警告</TableHead>
                <TableHead className="w-[180px]">快捷入口</TableHead>
                <TableHead className="w-[240px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-sm text-muted-foreground">
                    当前还没有扫描到任何插件目录。
                  </TableCell>
                </TableRow>
              ) : null}

              {data.items.map((addon) => (
                <TableRow key={addon.id}>
                  <TableCell className="align-top">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{addon.name}</span>
                        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{addon.id}</span>
                      </div>
                      <p className="max-w-xl text-sm leading-6 text-muted-foreground">{addon.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {addon.author ?? "未填写"}
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {addon.version}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getStateBadgeVariant(addon.stateLabel)}>{getStateLabel(addon.stateLabel)}</Badge>
                      {addon.loadError ? <Badge variant="destructive">加载失败</Badge> : null}
                      {addon.warnings.length > 0 ? <Badge variant="outline">警告 {addon.warnings.length}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <p className="text-sm leading-6 text-muted-foreground">{getAddonIssueText(addon)}</p>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Link href={`/admin/addons/${addon.id}`} className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 transition-colors hover:bg-accent hover:text-accent-foreground">
                        插件详情
                      </Link>
                      {addon.counts.publicPages > 0 ? (
                        <Link href={addon.paths.publicPage} className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 transition-colors hover:bg-accent hover:text-accent-foreground">
                          前台页
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end">
                      <AddonManagementActionButtons addon={addon} compact onUpdated={setData} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
