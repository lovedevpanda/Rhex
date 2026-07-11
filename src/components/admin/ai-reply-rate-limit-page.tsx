"use client"

import { useCallback, useEffect, useState, useTransition } from "react"

import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"

interface RateLimitConfig {
  dailyMax: number
}

interface UsageEntry {
  appKey: string
  count: number
  day: string
}

interface GetResponse {
  code: number
  message?: string
  data?: {
    config: RateLimitConfig
    usage: UsageEntry[]
    appKeys: string[]
  }
}

interface MutateResponse {
  code: number
  message?: string
  data?: unknown
}

export function AiReplyRateLimitPage() {
  const [config, setConfig] = useState<RateLimitConfig>({ dailyMax: 0 })
  const [dailyMaxInput, setDailyMaxInput] = useState<string>("")
  const [usage, setUsage] = useState<UsageEntry[]>([])
  const [appKeys, setAppKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, startSave] = useTransition()
  const [resetting, startReset] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/apps/ai-reply/rate-limit", { cache: "no-store" })
      const json = (await res.json()) as GetResponse
      if (!res.ok || json.code !== 0 || !json.data) {
        toast.error(json.message || "加载失败")
        return
      }
      setConfig(json.data.config)
      setDailyMaxInput(String(json.data.config.dailyMax))
      setUsage(json.data.usage)
      setAppKeys(json.data.appKeys)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const save = useCallback(() => {
    const parsed = Number(dailyMaxInput)
    if (!Number.isInteger(parsed) || parsed < 0) {
      toast.error("dailyMax 必须是非负整数")
      return
    }
    startSave(async () => {
      try {
        const res = await fetch("/api/admin/apps/ai-reply/rate-limit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dailyMax: parsed }),
        })
        const json = (await res.json()) as MutateResponse
        if (!res.ok || json.code !== 0) {
          toast.error(json.message || "保存失败")
          return
        }
        toast.success(json.message || "已保存")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    })
  }, [dailyMaxInput, load])

  const resetUsage = useCallback((appKey: string) => {
    if (!confirm(`确认重置 ${appKey} 今日计数？`)) return
    startReset(async () => {
      try {
        const res = await fetch("/api/admin/apps/ai-reply/rate-limit", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ appKey }),
        })
        const json = (await res.json()) as MutateResponse
        if (!res.ok || json.code !== 0) {
          toast.error(json.message || "重置失败")
          return
        }
        toast.success(json.message || "已重置")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    })
  }, [load])

  const remaining = (entry: UsageEntry) => Math.max(config.dailyMax - entry.count, 0)
  const exhausted = (entry: UsageEntry) => config.dailyMax > 0 && entry.count >= config.dailyMax

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>日调用上限</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">dailyMax (0 = 关闭限额)</span>
              <input
                type="number"
                min={0}
                step={1}
                className="w-40 rounded border border-border bg-background px-2 py-1"
                value={dailyMaxInput}
                onChange={(e) => setDailyMaxInput(e.target.value)}
              />
            </label>
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? "刷新中..." : "刷新"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            当前生效值：<span className="font-mono">{config.dailyMax}</span>
            {config.dailyMax === 0 ? "（关闭）" : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>今日用量</CardTitle>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">App Key</th>
                  <th className="py-2 pr-4">日期</th>
                  <th className="py-2 pr-4">已用</th>
                  <th className="py-2 pr-4">剩余</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((entry) => (
                  <tr key={entry.appKey} className="border-t border-border">
                    <td className="py-2 pr-4 font-mono">{entry.appKey}</td>
                    <td className="py-2 pr-4">{entry.day}</td>
                    <td className="py-2 pr-4">{entry.count}</td>
                    <td className="py-2 pr-4">{config.dailyMax > 0 ? remaining(entry) : "∞"}</td>
                    <td className="py-2 pr-4">
                      {exhausted(entry) ? (
                        <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-600">已达上限</span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-600">正常</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Button size="sm" variant="outline" onClick={() => resetUsage(entry.appKey)} disabled={resetting}>
                        {resetting ? "..." : "重置"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {appKeys.length > usage.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              未出现的 appKey 表示今日尚未调用：{appKeys.filter((k) => !usage.some((u) => u.appKey === k)).join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}