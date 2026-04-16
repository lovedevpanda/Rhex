"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { useConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { AddonAdminItem, AddonsAdminData, AddonManagementAction } from "@/addons-host/admin-types"

interface AddonManagementActionButtonsProps {
  addon: AddonAdminItem
  compact?: boolean
  onUpdated?: (data: AddonsAdminData) => void
  refreshOnComplete?: boolean
}

interface AdminApiPayload<TData> {
  code: number
  message?: string
  data?: TData
}

async function postAddonAction(action: AddonManagementAction, addonId?: string) {
  const response = await fetch("/api/admin/addons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      addonId,
    }),
  })

  const result = await response.json() as AdminApiPayload<AddonsAdminData>
  if (!response.ok || result.code !== 0 || !result.data) {
    throw new Error(result.message ?? "插件操作失败")
  }

  return result
}

export function AddonManagementActionButtons({
  addon,
  compact = false,
  onUpdated,
  refreshOnComplete = false,
}: AddonManagementActionButtonsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<AddonManagementAction | null>(null)

  function runAction(action: AddonManagementAction) {
    startTransition(() => {
      void (async () => {
        try {
          if (action === "disable") {
            const confirmed = await confirm({
              title: "禁用插件",
              description: `确认禁用插件“${addon.name}”吗？禁用后它的插槽、页面和 API 都会停止生效。`,
              confirmText: "禁用",
              cancelText: "取消",
              variant: "danger",
            })

            if (!confirmed) {
              return
            }
          }

          if (action === "remove") {
            const confirmed = await confirm({
              title: "物理卸载插件",
              description: `确认物理卸载插件“${addon.name}”吗？插件目录会移动到 addons/.trash 中，前台和后台入口都会消失，注册状态和配置也会清除。`,
              confirmText: "物理卸载",
              cancelText: "取消",
              variant: "danger",
            })

            if (!confirmed) {
              return
            }
          }

          setPendingAction(action)
          const result = await postAddonAction(action, addon.id)
          onUpdated?.(result.data!)

          const successMessage = result.message ?? "插件状态已更新"
          const shouldRedirectToAddonsList = action === "remove"
            && typeof pathname === "string"
            && pathname.startsWith(`/admin/addons/${addon.id}`)

          if (shouldRedirectToAddonsList) {
            toast.success(successMessage, "操作成功")
            router.replace("/admin/addons")
            router.refresh()
            return
          }

          if (refreshOnComplete) {
            router.refresh()
          }

          toast.success(successMessage, "操作成功")
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "插件操作失败", "操作失败")
        } finally {
          setPendingAction(null)
        }
      })()
    })
  }

  const buttonSize = compact ? "sm" : "default"

  return (
    <div className="flex flex-wrap gap-2">
      {addon.canEnable ? (
        <Button size={buttonSize} disabled={isPending} onClick={() => runAction("enable")}>
          {pendingAction === "enable" ? "启用中..." : "启用"}
        </Button>
      ) : null}
      {addon.canDisable ? (
        <Button size={buttonSize} variant="outline" disabled={isPending} onClick={() => runAction("disable")}>
          {pendingAction === "disable" ? "禁用中..." : "禁用"}
        </Button>
      ) : null}
      {addon.canRemove ? (
        <Button size={buttonSize} variant="destructive" disabled={isPending} onClick={() => runAction("remove")}>
          {pendingAction === "remove" ? "卸载中..." : "物理卸载"}
        </Button>
      ) : null}
    </div>
  )
}
