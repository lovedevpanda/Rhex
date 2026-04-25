"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/rbutton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { TextField } from "@/components/ui/text-field"
import { toast } from "@/components/ui/toast"
import type { UserNotificationChannel, UserNotificationEvent, UserNotificationPreferences } from "@/lib/user-notification-preferences"

interface ProfileNotificationSettingsProps {
  initialNotificationPreferences: UserNotificationPreferences
  initialEmail: string | null
  initialEmailVerified: boolean
  emailDeliveryEnabled: boolean
}

interface NotificationSettingsResponse {
  notificationPreferences: UserNotificationPreferences
}

const notificationEventItems: Array<{
  key: UserNotificationEvent
  label: string
  description: string
}> = [
  {
    key: "systemNotification",
    label: "系统通知",
    description: "系统消息、审核结果、运营提醒等站内通知。",
  },
  {
    key: "privateMessage",
    label: "私信通知",
    description: "收到新的用户私信时触发站外通知。",
  },
]

function hasEnabledEvents(events: UserNotificationPreferences["webhook"]["events"]) {
  return events.systemNotification || events.privateMessage
}

function applyDefaultChannelEvents(
  preferences: UserNotificationPreferences,
  channel: UserNotificationChannel,
  nextEnabled: boolean,
) {
  if (!nextEnabled) {
    return preferences
  }

  if (channel === "webhook" && !hasEnabledEvents(preferences.webhook.events)) {
    return {
      ...preferences,
      webhook: {
        ...preferences.webhook,
        events: {
          ...preferences.webhook.events,
          systemNotification: true,
        },
      },
    }
  }

  if (channel === "email" && !hasEnabledEvents(preferences.email.events)) {
    return {
      ...preferences,
      email: {
        ...preferences.email,
        events: {
          ...preferences.email.events,
          privateMessage: true,
        },
      },
    }
  }

  return preferences
}

export function ProfileNotificationSettings({
  initialNotificationPreferences,
  initialEmail,
  initialEmailVerified,
  emailDeliveryEnabled,
}: ProfileNotificationSettingsProps) {
  const [notificationPreferences, setNotificationPreferences] = useState(initialNotificationPreferences)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const normalizedEmail = initialEmail?.trim() || ""
  const hasVerifiedEmail = Boolean(normalizedEmail && initialEmailVerified)

  async function requestNotificationSettings(
    endpoint: string,
    successTitle: string,
    payload?: { notificationPreferences: UserNotificationPreferences },
  ) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {
        notificationPreferences,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "请求失败")
    }

    if (result.data) {
      const data = result.data as NotificationSettingsResponse
      setNotificationPreferences(data.notificationPreferences)
    }

    toast.success(result.message ?? "操作成功", successTitle)
  }

  function updateChannelEnabled(channel: UserNotificationChannel, nextEnabled: boolean) {
    setNotificationPreferences((current) => {
      const updated = channel === "webhook"
        ? {
            ...current,
            webhook: {
              ...current.webhook,
              enabled: nextEnabled,
            },
          }
        : {
            ...current,
            email: {
              ...current.email,
              enabled: nextEnabled,
            },
          }

      return applyDefaultChannelEvents(updated, channel, nextEnabled)
    })
  }

  function updateChannelEvent(channel: UserNotificationChannel, event: UserNotificationEvent, checked: boolean) {
    setNotificationPreferences((current) => channel === "webhook"
      ? {
          ...current,
          webhook: {
            ...current.webhook,
            events: {
              ...current.webhook.events,
              [event]: checked,
            },
          },
        }
      : {
          ...current,
          email: {
            ...current.email,
            events: {
              ...current.email.events,
              [event]: checked,
            },
          },
        })
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
        notificationPreferences,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试失败", "Webhook 测试")
    } finally {
      setTesting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <Card className="ring-0">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>通知渠道</CardTitle>
            <Badge variant="secondary">可扩展</Badge>
          </div>
          <CardDescription>
            你可以分别控制 webhook 和邮箱两个渠道，并按事件类型决定哪些内容需要站外提醒。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Webhook</p>
                  {notificationPreferences.webhook.url.trim() ? <Badge variant="outline">已配置地址</Badge> : <Badge variant="secondary">未配置地址</Badge>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  以 JSON POST 的方式推送通知事件，适合接企业微信机器人、自动化流程或自建网关。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{notificationPreferences.webhook.enabled ? "已开启" : "已关闭"}</span>
                <Switch checked={notificationPreferences.webhook.enabled} onCheckedChange={(checked) => updateChannelEnabled("webhook", checked)} />
              </div>
            </div>

            <div className="mt-4">
              <TextField
                label="通知 Webhook URL"
                value={notificationPreferences.webhook.url}
                onChange={(value) => setNotificationPreferences((current) => ({
                  ...current,
                  webhook: {
                    ...current.webhook,
                    url: value,
                  },
                }))}
                placeholder="https://example.com/hooks/notifications"
                type="url"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                仅支持 `http://` 或 `https://` 地址。当前会发送系统通知和私信两类事件，后续新增事件会继续复用这套通道。
              </p>
            </div>
          </div>

          <div className="rounded-xl  p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">邮箱</p>
                  {hasVerifiedEmail ? <Badge variant="outline">发送到 {normalizedEmail}</Badge> : <Badge variant="secondary">需验证邮箱</Badge>}
                  {!emailDeliveryEnabled ? <Badge variant="secondary">SMTP 未启用</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  使用当前账号已验证邮箱接收通知。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{notificationPreferences.email.enabled ? "已开启" : "已关闭"}</span>
                <Switch checked={notificationPreferences.email.enabled} onCheckedChange={(checked) => updateChannelEnabled("email", checked)} />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-border bg-background/60 p-4 text-xs leading-6 text-muted-foreground">
              {!emailDeliveryEnabled ? <p>站点当前还没有启用 SMTP，邮箱通知配置可以提前保存，但实际邮件会在后台自动跳过。</p> : null}
              {emailDeliveryEnabled && !normalizedEmail ? <p>当前账号还没有绑定邮箱，启用邮件通知前请先到资料设置里补充邮箱。</p> : null}
              {emailDeliveryEnabled && normalizedEmail && !initialEmailVerified ? <p>当前邮箱尚未验证，邮件通知配置已保存时也不会实际投递，直到邮箱验证通过。</p> : null}
              {emailDeliveryEnabled && hasVerifiedEmail ? <p>邮件会发送到当前已验证邮箱：{normalizedEmail}</p> : null}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">事件订阅</p>
              <p className="mt-1 text-sm text-muted-foreground">按事件类型分别决定 webhook / 邮箱是否需要接收对应通知。</p>
            </div>

            <div className="flex flex-col gap-3">
              {notificationEventItems.map((item) => (
                <div key={item.key} className="rounded-xl border border-border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      <label className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">Webhook</span>
                        <Switch
                          checked={notificationPreferences.webhook.events[item.key]}
                          onCheckedChange={(checked) => updateChannelEvent("webhook", item.key, checked)}
                        />
                      </label>
                      <label className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">邮箱</span>
                        <Switch
                          checked={notificationPreferences.email.events[item.key]}
                          onCheckedChange={(checked) => updateChannelEvent("email", item.key, checked)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-xs leading-6 text-muted-foreground">
            <p>Webhook 测试按钮不会保存设置，只会向当前表单里的 URL 发送一条模拟系统通知。</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving || testing}>
          {saving ? "保存中..." : "保存通知设置"}
        </Button>
        <Button type="button" variant="outline" disabled={saving || testing || !notificationPreferences.webhook.url.trim()} onClick={handleTest}>
          {testing ? "测试中..." : "测试 Webhook"}
        </Button>
      </div>
    </form>
  )
}
