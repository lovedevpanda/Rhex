"use client"

import { useMemo, useState, useTransition } from "react"
import { BadgeRuleOperator, BadgeRuleType } from "@/db/types"
import { Pencil, Plus, Save, Trash2 } from "lucide-react"

import { AdminIconPickerField } from "@/components/admin-icon-picker-field"
import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"


type BadgeRuleFormItem = {
  id?: string
  ruleType: BadgeRuleType
  operator: BadgeRuleOperator
  value: string
  extraValue?: string
  sortOrder: number
}

type BadgeFormItem = {
  id?: string
  name: string
  code: string
  description: string
  iconText: string
  color: string
  imageUrl: string
  category: string
  sortOrder: number
  status: boolean
  isHidden: boolean
  grantedUserCount?: number
  rules: BadgeRuleFormItem[]
}

interface AdminBadgeManagerProps {
  initialBadges: BadgeFormItem[]
}

const BADGE_COLOR_PRESETS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"]

const ruleTypeOptions: Array<{ value: BadgeRuleType; label: string; placeholder: string }> = [
  { value: BadgeRuleType.REGISTER_DAYS, label: "注册天数", placeholder: "如 30" },
  { value: BadgeRuleType.REGISTER_TIME_RANGE, label: "注册时间", placeholder: "开始时间，如 2026-01-01T00:00:00.000Z" },
  { value: BadgeRuleType.POST_COUNT, label: "发帖数", placeholder: "如 10" },
  { value: BadgeRuleType.COMMENT_COUNT, label: "回复数", placeholder: "如 20" },
  { value: BadgeRuleType.RECEIVED_LIKE_COUNT, label: "获赞数", placeholder: "如 100" },
  { value: BadgeRuleType.INVITE_COUNT, label: "邀请人数", placeholder: "如 5" },
  { value: "ACCEPTED_ANSWER_COUNT" as BadgeRuleType, label: "被采纳数", placeholder: "如 3" },
  { value: BadgeRuleType.USER_ID, label: "UID", placeholder: "如 1000" },


  { value: BadgeRuleType.LEVEL, label: "等级", placeholder: "如 5" },
  { value: BadgeRuleType.CHECK_IN_DAYS, label: "签到天数", placeholder: "如 30" },
  { value: BadgeRuleType.VIP_LEVEL, label: "VIP 等级", placeholder: "如 2" },
]

const operatorOptions: Array<{ value: BadgeRuleOperator; label: string }> = [
  { value: BadgeRuleOperator.GT, label: ">" },
  { value: BadgeRuleOperator.GTE, label: ">=" },
  { value: BadgeRuleOperator.EQ, label: "=" },
  { value: BadgeRuleOperator.LT, label: "<" },
  { value: BadgeRuleOperator.LTE, label: "<=" },
  { value: BadgeRuleOperator.BETWEEN, label: "区间" },
  { value: BadgeRuleOperator.BEFORE, label: "早于" },
  { value: BadgeRuleOperator.AFTER, label: "晚于" },
]

function createRule(sortOrder: number): BadgeRuleFormItem {
  return {
    ruleType: BadgeRuleType.POST_COUNT,
    operator: BadgeRuleOperator.GTE,
    value: "1",
    extraValue: "",
    sortOrder,
  }
}

function createBadge(nextSortOrder: number): BadgeFormItem {
  return {
    name: "新勋章",
    code: `badge_${Date.now()}`,
    description: "",
    iconText: "🏅",
    color: "#f59e0b",
    imageUrl: "",
    category: "社区成就",
    sortOrder: nextSortOrder,
    status: true,
    isHidden: false,
    rules: [createRule(0)],
  }
}

function normalizeColor(color: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color
  }

  return "#f59e0b"
}

export function AdminBadgeManager({ initialBadges }: AdminBadgeManagerProps) {
  const [badges, setBadges] = useState(initialBadges)
  const [editingIndex, setEditingIndex] = useState<number | null>(initialBadges[0] ? 0 : null)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  const editingBadge = editingIndex === null ? null : badges[editingIndex] ?? null

  const categoryStats = useMemo(() => {
    const record = new Map<string, number>()
    badges.forEach((badge) => {
      const category = badge.category || "未分类"
      record.set(category, (record.get(category) ?? 0) + 1)
    })
    return Array.from(record.entries())
  }, [badges])

  function updateBadge(index: number, patch: Partial<BadgeFormItem>) {
    setBadges((current) => current.map((badge, badgeIndex) => (badgeIndex === index ? { ...badge, ...patch } : badge)))
  }

  function updateRule(index: number, ruleIndex: number, patch: Partial<BadgeRuleFormItem>) {
    setBadges((current) => current.map((badge, badgeIndex) => {
      if (badgeIndex !== index) {
        return badge
      }

      return {
        ...badge,
        rules: badge.rules.map((rule, currentRuleIndex) => (currentRuleIndex === ruleIndex ? { ...rule, ...patch } : rule)),
      }
    }))
  }

  function appendBadge() {
    setBadges((current) => {
      const next = [...current, createBadge(current.length)]
      setEditingIndex(next.length - 1)
      return next
    })
    setColorPickerOpen(false)
  }

  function appendRule(index: number) {
    setBadges((current) => current.map((badge, badgeIndex) => {
      if (badgeIndex !== index) {
        return badge
      }

      return {
        ...badge,
        rules: [...badge.rules, createRule(badge.rules.length)],
      }
    }))
  }

  function removeRule(index: number, ruleIndex: number) {
    setBadges((current) => current.map((badge, badgeIndex) => {
      if (badgeIndex !== index) {
        return badge
      }

      const nextRules = badge.rules.filter((_, itemIndex) => itemIndex !== ruleIndex).map((rule, itemIndex) => ({ ...rule, sortOrder: itemIndex }))
      return {
        ...badge,
        rules: nextRules.length > 0 ? nextRules : [createRule(0)],
      }
    }))
  }

  function saveBadge(index: number) {
    const badge = badges[index]
    setFeedback("")

    startTransition(async () => {
      const method = badge.id ? "PUT" : "POST"
      const response = await fetch("/api/admin/badges", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...badge,
          rules: badge.rules.map((rule, ruleIndex) => ({
            ...rule,
            sortOrder: ruleIndex,
          })),
        }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
      if (response.ok) {
        window.location.reload()
      }
    })
  }

  function removeBadge(index: number) {
    const badge = badges[index]
    if (!badge.id) {
      setBadges((current) => current.filter((_, badgeIndex) => badgeIndex !== index))
      setEditingIndex((current) => {
        if (current === null) return null
        if (current === index) return null
        return current > index ? current - 1 : current
      })
      return
    }

    if (!window.confirm(`确认删除勋章“${badge.name}”吗？`)) {
      return
    }

    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/badges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: badge.id }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "删除成功" : "删除失败"))
      if (response.ok) {
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-border bg-card p-5">
        <div>
          <h3 className="text-lg font-semibold">勋章系统</h3>
          <p className="mt-1 text-sm text-muted-foreground">后台自定义勋章和领取条件，前台用户满足条件后手动领取。</p>
        </div>
        <Button className="gap-2 rounded-full" onClick={appendBadge} type="button">
          <Plus className="h-4 w-4" />
          新建勋章
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">勋章列表</h4>
              <span className="text-sm text-muted-foreground">共 {badges.length} 枚</span>
            </div>
            <div className="mt-4 space-y-3">
              {badges.length === 0 ? <p className="text-sm text-muted-foreground">还没有勋章，先新建一枚。</p> : null}
              {badges.map((badge, index) => (
                <button
                  key={badge.id ?? `${badge.code}-${index}`}
                  type="button"
                  onClick={() => {
                    setEditingIndex(index)
                    setColorPickerOpen(false)
                  }}
                  className={editingIndex === index ? "w-full rounded-[22px] border border-foreground bg-accent/60 p-4 text-left" : "w-full rounded-[22px] border border-border bg-background p-4 text-left hover:bg-accent/40"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${badge.color}18`, color: badge.color }}>
                        <LevelIcon icon={badge.iconText} color={badge.color} className="h-5 w-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{badge.name}</p>
                          <span className={badge.status ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"}>{badge.status ? "启用" : "停用"}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{badge.category || "社区成就"} · 领取 {badge.grantedUserCount ?? 0}</p>
                      </div>
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-card p-4">
            <h4 className="text-base font-semibold">分类统计</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {categoryStats.map(([category, count]) => (
                <span key={category} className="rounded-full bg-accent px-3 py-1 text-xs text-foreground">{category} · {count}</span>
              ))}
            </div>
          </div>
        </section>

        <section>
          {!editingBadge ? (
            <div className="rounded-[28px] border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">请选择左侧勋章，或新建一枚勋章开始配置。</div>
          ) : (
            <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">勋章编辑</h4>
                  <p className="mt-1 text-sm text-muted-foreground">条件为全部满足后可领取，前台由用户手动领取。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => removeBadge(editingIndex!)}>
                    <Trash2 className="h-4 w-4" />
                    删除
                  </Button>
                  <Button type="button" className="gap-2 rounded-full" disabled={isPending} onClick={() => saveBadge(editingIndex!)}>
                    <Save className="h-4 w-4" />
                    {isPending ? "保存中..." : "保存勋章"}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="勋章名称" value={editingBadge.name} onChange={(value) => updateBadge(editingIndex!, { name: value })} placeholder="如 论坛先锋" />
                <Field label="唯一标识" value={editingBadge.code} onChange={(value) => updateBadge(editingIndex!, { code: value.replace(/\s+/g, "_") })} placeholder="如 forum_pioneer" />
                <Field label="分类" value={editingBadge.category} onChange={(value) => updateBadge(editingIndex!, { category: value })} placeholder="如 社区成就" />
                <AdminIconPickerField
                  label="图标"
                  value={editingBadge.iconText}
                  onChange={(value) => updateBadge(editingIndex!, { iconText: value })}
                  previewColor={editingBadge.color}
                  popoverTitle="选择勋章图标"
                  containerClassName="space-y-2"
                  triggerClassName="flex h-11 w-full items-center gap-3 rounded-[18px] border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
                  textareaRows={4}
                />

                <div className="space-y-2">
                  <span className="text-sm font-medium">主题色</span>
                  <PopoverTriggerField value={editingBadge.color} previewColor={editingBadge.color} onClick={() => setColorPickerOpen((current) => !current)} />
                  {colorPickerOpen ? (
                    <PickerPopover title="选择勋章主题色" onClose={() => setColorPickerOpen(false)}>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={normalizeColor(editingBadge.color)}
                          onChange={(event) => updateBadge(editingIndex!, { color: event.target.value })}
                          className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-0.5"
                          aria-label="选择勋章主题色"
                        />
                        <input
                          value={editingBadge.color}
                          onChange={(event) => updateBadge(editingIndex!, { color: event.target.value })}
                          className="h-8 w-28 rounded-full border border-border bg-background px-3 text-xs outline-none"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {BADGE_COLOR_PRESETS.map((preset) => {
                          const active = editingBadge.color.toLowerCase() === preset.toLowerCase()
                          return (
                            <button
                              key={`badge-color-${preset}`}
                              type="button"
                              className={active ? "h-7 w-7 rounded-full ring-2 ring-foreground/20 ring-offset-1 ring-offset-background" : "h-7 w-7 rounded-full border border-border"}
                              style={{ backgroundColor: preset }}
                              onClick={() => {
                                updateBadge(editingIndex!, { color: preset })
                                setColorPickerOpen(false)
                              }}
                              aria-label={`使用颜色 ${preset}`}
                            />
                          )
                        })}
                      </div>
                    </PickerPopover>
                  ) : null}
                </div>
                <Field label="排序" type="number" value={String(editingBadge.sortOrder)} onChange={(value) => updateBadge(editingIndex!, { sortOrder: Math.max(0, Number(value) || 0) })} placeholder="0" />
                <Field className="md:col-span-2 xl:col-span-3" label="描述" value={editingBadge.description} onChange={(value) => updateBadge(editingIndex!, { description: value })} placeholder="如 发帖达到一定数量后可领取" />
                <Field className="md:col-span-2 xl:col-span-3" label="图片地址（可选）" value={editingBadge.imageUrl} onChange={(value) => updateBadge(editingIndex!, { imageUrl: value })} placeholder="https://..." />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-[20px] border border-border px-4 py-3 text-sm">
                  <input type="checkbox" checked={editingBadge.status} onChange={(event) => updateBadge(editingIndex!, { status: event.target.checked })} />
                  启用该勋章
                </label>
                <label className="flex items-center gap-3 rounded-[20px] border border-border px-4 py-3 text-sm">
                  <input type="checkbox" checked={editingBadge.isHidden} onChange={(event) => updateBadge(editingIndex!, { isHidden: event.target.checked })} />
                  未获得时隐藏
                </label>
              </div>

              <div className="mt-6 rounded-[24px] border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold">领取条件</h5>
                    <p className="mt-1 text-xs text-muted-foreground">第一版按 AND 逻辑判断：下列规则全部满足才可领取。</p>
                  </div>
                  <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => appendRule(editingIndex!)}>
                    <Plus className="h-4 w-4" />
                    新增条件
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {editingBadge.rules.map((rule, ruleIndex) => {
                    const typeMeta = ruleTypeOptions.find((item) => item.value === rule.ruleType)
                    const isTimeRange = rule.ruleType === BadgeRuleType.REGISTER_TIME_RANGE
                    return (
                      <div key={`${rule.id ?? ruleIndex}-${rule.ruleType}`} className="rounded-[22px] border border-border bg-secondary/20 p-4">
                        <div className="grid gap-3 xl:grid-cols-[180px_120px_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                          <SelectField label="条件类型" value={rule.ruleType} options={ruleTypeOptions.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => updateRule(editingIndex!, ruleIndex, { ruleType: value as BadgeRuleType })} />
                          <SelectField label="运算符" value={rule.operator} options={operatorOptions} onChange={(value) => updateRule(editingIndex!, ruleIndex, { operator: value as BadgeRuleOperator })} />
                          <Field label={isTimeRange ? "开始值 / 时间" : "目标值"} value={rule.value} onChange={(value) => updateRule(editingIndex!, ruleIndex, { value })} placeholder={typeMeta?.placeholder ?? "请输入条件值"} />
                          <Field label={rule.operator === BadgeRuleOperator.BETWEEN ? "结束时间 / 额外值" : "额外值（可选）"} value={rule.extraValue ?? ""} onChange={(value) => updateRule(editingIndex!, ruleIndex, { extraValue: value })} placeholder={rule.operator === BadgeRuleOperator.BETWEEN ? "结束时间" : "一般可留空"} />
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => removeRule(editingIndex!, ruleIndex)}>删除</Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {feedback ? <p className="mt-4 text-sm text-muted-foreground">{feedback}</p> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <label className={`space-y-2 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30" />
    </label>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function PopoverTriggerField({ value, onClick, previewColor }: { value: string; onClick: () => void; previewColor?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full items-center justify-between rounded-full border border-border bg-background px-3 text-xs text-left transition-colors hover:bg-accent"
    >
      <span className="truncate">{value}</span>
      {previewColor ? <span className="ml-2 h-4 w-4 rounded-full border border-border" style={{ backgroundColor: normalizeColor(previewColor) }} /> : null}
    </button>
  )
}

function PickerPopover({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="mt-2 rounded-[18px] border border-border bg-background p-3 shadow-lg shadow-black/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <button type="button" onClick={onClose} className="text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          关闭
        </button>
      </div>
      {children}
    </div>
  )
}

