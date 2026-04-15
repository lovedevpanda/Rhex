"use client"

import { useState } from "react"

import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"

interface ProfileNotificationSettingsProps {
  initialExternalNotificationEnabled: boolean
  initialNotificationWebhookUrl: string
}

interface NotificationSettingsResponse {
  externalNotificationEnabled: boolean
  notificationWebhookUrl: string
}

export function ProfileNotificationSettings({
  initialExternalNotificationEnabled,
  initialNotificationWebhookUrl,
}: ProfileNotificationSettingsProps) {
  const [externalNotificationEnabled, setExternalNotificationEnabled] = useState(initialExternalNotificationEnabled)
  const [notificationWebhookUrl, setNotificationWebhookUrl] = useState(initialNotificationWebhookUrl)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  async function requestNotificationSettings(
    endpoint: string,
    successTitle: string,
    payload?: { externalNotificationEnabled: boolean; notificationWebhookUrl: string },
  ) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {
        externalNotificationEnabled,
        notificationWebhookUrl,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "请求失败")
    }

    if (result.data) {
      const data = result.data as NotificationSettingsResponse
      setExternalNotificationEnabled(data.externalNotificationEnabled)
      setNotificationWebhookUrl(data.notificationWebhookUrl)
    }

    toast.success(result.message ?? "操作成功", successTitle)
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      await requestNotificationSettings("/api/profile/notification-settings", "通知设置")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败", "通知设置")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)

    try {
      await requestNotificationSettings("/api/profile/notification-settings/test", "Webhook 测试", {
        externalNotificationEnabled,
        notificationWebhookUrl,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试失败", "Webhook 测试")
    } finally {
      setTesting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="rounded-[24px] bg-card p-5 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">站外通知</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              开启后，系统通知会额外以 JSON POST 到你的 Webhook URL。你可以先测试，再决定是否保存启用。
            </p>
          </div>
          <Button
            type="button"
            variant={externalNotificationEnabled ? "default" : "outline"}
            onClick={() => setExternalNotificationEnabled((current) => !current)}
          >
            {externalNotificationEnabled ? "已开启" : "已关闭"}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">通知 Webhook URL</p>
          <input
            type="url"
            value={notificationWebhookUrl}
            onChange={(event) => setNotificationWebhookUrl(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
            placeholder="https://example.com/hooks/system-notification"
          />
          <p className="text-xs text-muted-foreground">
            仅支持 `http://` 或 `https://` 地址。系统通知会发送 `event`、通知内容、关联对象和接收用户 ID。
          </p>
        </div>

        <div className="rounded-[20px] border border-dashed border-border bg-background/60 p-4 text-xs leading-6 text-muted-foreground">
          <p>测试按钮不会保存设置，只会向当前输入的 URL 发送一条模拟系统通知。</p>
          <p className="mt-1">保存后，后续所有系统通知都会按你的开关状态自动同步到该地址。</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving || testing}>
          {saving ? "保存中..." : "保存通知设置"}
        </Button>
        <Button type="button" variant="outline" disabled={saving || testing || !notificationWebhookUrl.trim()} onClick={handleTest}>
          {testing ? "测试中..." : "测试 Webhook"}
        </Button>
      </div>
    </form>
  )
}
