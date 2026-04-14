"use client"

import type { ReactNode } from "react"
import { useMemo, useState, useTransition } from "react"
import { CircleHelp, Pencil, Plus, Save, Sparkles, Trash2 } from "lucide-react"

import { Modal } from "@/components/ui/modal"
import { ConditionValueField } from "@/components/condition-value-field"
import { LevelIcon } from "@/components/level-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ColorPicker } from "@/components/ui/color-picker"
import { IconPicker } from "@/components/ui/icon-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { showConfirm } from "@/components/ui/alert-dialog"
import { Tooltip } from "@/components/ui/tooltip"
import { buildUserLevelThresholdOptions, buildVipLevelThresholdOptions } from "@/lib/access-threshold-options"
import { BADGE_RULE_TYPE_OPTIONS, getBadgeRuleTypeOption, type BadgeRuleTypeValue } from "@/lib/badge-rule-definitions"
import { BadgeRuleOperator, BadgeRuleType } from "@/lib/shared/badge-rule-enums"
import type { LevelDefinitionItem } from "@/lib/level-system"
import {
  BADGE_EFFECT_SCOPE_HOME_AUTO_CHECK_IN,
  POINT_EFFECT_DIRECTION_OPTIONS,
  POINT_EFFECT_RULE_KIND_OPTIONS,
  getDefaultPointEffectScopeKeysByTargetType,
  getPointEffectAllScopeKeyByTargetType,
  getPointEffectDirectionOptionsByRuleKind,
  getPointEffectDirectionLabel,
  getPointEffectRuleKindLabel,
  getPointEffectScopeLabel,
  getPointEffectScopeOptionsByTargetType,
  getPointEffectTargetOptionsForBadgeEffects,
  getPointEffectTargetLabel,
  isFunctionalPointEffectTargetType,
  normalizePointEffectScopeKeysByTargetType,
  normalizePointEffectDirectionByRuleKind,
  timeInputToMinuteOfDay,
} from "@/lib/point-effect-definitions"
import { PointEffectDirection, PointEffectRuleKind, PointEffectTargetType } from "@/lib/shared/point-effect-enums"

type BadgeRuleFormItem = {
  id?: string
  ruleType: BadgeRuleTypeValue
  operator: BadgeRuleOperator
  value: string
  extraValue?: string
  sortOrder: number
}

type BadgeEffectFormItem = {
  id?: string
  name: string
  description: string
  targetType: PointEffectTargetType
  scopeKeys: string[]
  ruleKind: PointEffectRuleKind
  direction: PointEffectDirection
  value: string
  extraValue: string
  startMinuteOfDay: string
  endMinuteOfDay: string
  sortOrder: number
  status: boolean
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
  pointsCost: number
  status: boolean
  isHidden: boolean
  grantedUserCount?: number
  rules: BadgeRuleFormItem[]
  effects: BadgeEffectFormItem[]
}

interface AdminBadgeManagerProps {
  initialBadges: BadgeFormItem[]
  initialLevelDefinitions: LevelDefinitionItem[]
}

type EffectModalState = {
  mode: "create" | "edit"
  effectIndex: number | null
  draft: BadgeEffectFormItem
} | null

const BADGE_COLOR_PRESETS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"]

const numericOperatorOptions: Array<{ value: BadgeRuleOperator; label: string }> = [
  { value: BadgeRuleOperator.GT, label: ">" },
  { value: BadgeRuleOperator.GTE, label: ">=" },
  { value: BadgeRuleOperator.EQ, label: "=" },
  { value: BadgeRuleOperator.LT, label: "<" },
  { value: BadgeRuleOperator.LTE, label: "<=" },
]

const registerTimeOperatorOptions: Array<{ value: BadgeRuleOperator; label: string }> = [
  { value: BadgeRuleOperator.BETWEEN, label: "区间" },
  { value: BadgeRuleOperator.BEFORE, label: "早于" },
  { value: BadgeRuleOperator.AFTER, label: "晚于" },
]

function getBadgeRuleOperatorOptions(ruleType: BadgeRuleTypeValue) {
  return ruleType === BadgeRuleType.REGISTER_TIME_RANGE ? registerTimeOperatorOptions : numericOperatorOptions
}

function getDefaultBadgeRuleOperator(ruleType: BadgeRuleTypeValue) {
  return ruleType === BadgeRuleType.REGISTER_TIME_RANGE ? BadgeRuleOperator.AFTER : BadgeRuleOperator.GTE
}

function getDefaultBadgeRuleValue(ruleType: BadgeRuleTypeValue) {
  const valueMode = getBadgeRuleTypeOption(ruleType)?.valueMode

  if (valueMode === "datetime-local") {
    return ""
  }

  return "1"
}

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
    pointsCost: 0,
    status: true,
    isHidden: false,
    rules: [],
    effects: [],
  }
}

function createEffect(sortOrder: number): BadgeEffectFormItem {
  return normalizeEffectDraft({
    name: "新特效",
    description: "",
    targetType: PointEffectTargetType.POINTS,
    scopeKeys: getDefaultPointEffectScopeKeysByTargetType(PointEffectTargetType.POINTS),
    ruleKind: PointEffectRuleKind.FIXED,
    direction: PointEffectDirection.BUFF,
    value: "1",
    extraValue: "",
    startMinuteOfDay: "",
    endMinuteOfDay: "",
    sortOrder,
    status: true,
  })
}

function normalizeEffectDraft(effect: BadgeEffectFormItem): BadgeEffectFormItem {
  const nextTargetType = isHomeAutoCheckInEffect(effect)
    ? PointEffectTargetType.FUNCTION
    : effect.targetType
  const scopeKeys = normalizePointEffectScopeKeysByTargetType(effect.scopeKeys, nextTargetType)

  if (isFunctionalPointEffectTargetType(nextTargetType)) {
    return {
      ...effect,
      targetType: nextTargetType,
      scopeKeys: scopeKeys.length > 0 ? scopeKeys : getDefaultPointEffectScopeKeysByTargetType(nextTargetType),
      ruleKind: PointEffectRuleKind.FIXED,
      direction: PointEffectDirection.BUFF,
      value: "1",
      extraValue: "",
      startMinuteOfDay: "",
      endMinuteOfDay: "",
    }
  }

  return {
    ...effect,
    targetType: nextTargetType,
    direction: normalizePointEffectDirectionByRuleKind(effect.direction, effect.ruleKind),
    scopeKeys,
  }
}

function buildEffectScopeSummary(effect: BadgeEffectFormItem) {
  if (effect.scopeKeys.length === 0) {
    return "未设置范围"
  }

  return effect.scopeKeys.map((scopeKey) => getPointEffectScopeLabel(scopeKey)).join(" · ")
}

function buildEffectTimeSummary(effect: BadgeEffectFormItem) {
  if (!effect.startMinuteOfDay && !effect.endMinuteOfDay) {
    return "全天"
  }

  return `${effect.startMinuteOfDay || "00:00"} - ${effect.endMinuteOfDay || "23:59"}`
}

function isHomeAutoCheckInEffect(effect: Pick<BadgeEffectFormItem, "scopeKeys">) {
  return effect.scopeKeys.includes(BADGE_EFFECT_SCOPE_HOME_AUTO_CHECK_IN)
}

function isFunctionalBadgeEffect(effect: Pick<BadgeEffectFormItem, "targetType" | "scopeKeys">) {
  return isFunctionalPointEffectTargetType(effect.targetType) || isHomeAutoCheckInEffect(effect)
}

function buildEffectValueSummary(effect: BadgeEffectFormItem) {
  if (isFunctionalBadgeEffect(effect)) {
    return "功能特效，无需数值"
  }

  return effect.extraValue ? `${effect.value} - ${effect.extraValue}` : effect.value
}

export function AdminBadgeManager({ initialBadges, initialLevelDefinitions }: AdminBadgeManagerProps) {
  const [badges, setBadges] = useState(initialBadges)
  const [editingIndex, setEditingIndex] = useState<number | null>(initialBadges[0] ? 0 : null)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()
  const [effectModal, setEffectModal] = useState<EffectModalState>(null)

  const editingBadge = editingIndex === null ? null : badges[editingIndex] ?? null
  const userLevelOptions = useMemo(() => buildUserLevelThresholdOptions(initialLevelDefinitions), [initialLevelDefinitions])
  const vipLevelOptions = useMemo(() => buildVipLevelThresholdOptions(), [])

  const categoryStats = useMemo(() => {
    const record = new Map<string, number>()
    badges.forEach((badge) => {
      const category = badge.category || "未分类"
      record.set(category, (record.get(category) ?? 0) + 1)
    })
    return Array.from(record.entries())
  }, [badges])

  const modalScopeOptions = effectModal
    ? getPointEffectScopeOptionsByTargetType(effectModal.draft.targetType)
    : []
  const modalAllScopeKey = effectModal
    ? getPointEffectAllScopeKeyByTargetType(effectModal.draft.targetType)
    : null
  const targetOptions = getPointEffectTargetOptionsForBadgeEffects()
  const modalDirectionOptions = effectModal
    ? getPointEffectDirectionOptionsByRuleKind(effectModal.draft.ruleKind)
    : POINT_EFFECT_DIRECTION_OPTIONS
  const functionalEffectSelected = effectModal ? isFunctionalBadgeEffect(effectModal.draft) : false

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

  function updateEffectModalDraft(patch: Partial<BadgeEffectFormItem>) {
    setEffectModal((current) => {
      if (!current) {
        return null
      }

      return {
        ...current,
        draft: normalizeEffectDraft({
          ...current.draft,
          ...patch,
        }),
      }
    })
  }

  function appendBadge() {
    setBadges((current) => {
      const next = [...current, createBadge(current.length)]
      setEditingIndex(next.length - 1)
      return next
    })
    setEffectModal(null)
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

  function openCreateEffectModal() {
    if (!editingBadge) {
      return
    }

    setEffectModal({
      mode: "create",
      effectIndex: null,
      draft: createEffect(editingBadge.effects.length),
    })
  }

  function openEditEffectModal(effectIndex: number) {
    if (!editingBadge) {
      return
    }

    const effect = editingBadge.effects[effectIndex]
    if (!effect) {
      return
    }

    setEffectModal({
      mode: "edit",
      effectIndex,
      draft: normalizeEffectDraft(effect),
    })
  }

  function closeEffectModal() {
    setEffectModal(null)
  }

  function commitEffectModal() {
    if (editingIndex === null || !effectModal) {
      return
    }

    const nextEffect = normalizeEffectDraft(effectModal.draft)
    setBadges((current) => current.map((badge, badgeIndex) => {
      if (badgeIndex !== editingIndex) {
        return badge
      }

      if (effectModal.mode === "edit" && effectModal.effectIndex !== null) {
        return {
          ...badge,
          effects: badge.effects.map((effect, effectIndex) => (
            effectIndex === effectModal.effectIndex
              ? { ...nextEffect, sortOrder: effectModal.effectIndex }
              : effect
          )),
        }
      }

      return {
        ...badge,
        effects: [...badge.effects, { ...nextEffect, sortOrder: badge.effects.length }],
      }
    }))
    closeEffectModal()
  }

  function removeRule(index: number, ruleIndex: number) {
    setBadges((current) => current.map((badge, badgeIndex) => {
      if (badgeIndex !== index) {
        return badge
      }

      const nextRules = badge.rules.filter((_, itemIndex) => itemIndex !== ruleIndex).map((rule, itemIndex) => ({ ...rule, sortOrder: itemIndex }))
      return {
        ...badge,
        rules: nextRules,
      }
    }))
  }

  function removeEffect(index: number, effectIndex: number) {
    setBadges((current) => current.map((badge, badgeIndex) => {
      if (badgeIndex !== index) {
        return badge
      }

      return {
        ...badge,
        effects: badge.effects.filter((_, itemIndex) => itemIndex !== effectIndex).map((effect, itemIndex) => ({ ...effect, sortOrder: itemIndex })),
      }
    }))

    setEffectModal((current) => {
      if (!current || current.mode !== "edit" || current.effectIndex !== effectIndex) {
        return current
      }

      return null
    })
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
          effects: badge.effects.map((effect, effectIndex) => ({
            ...effect,
            sortOrder: effectIndex,
            startMinuteOfDay: timeInputToMinuteOfDay(effect.startMinuteOfDay),
            endMinuteOfDay: timeInputToMinuteOfDay(effect.endMinuteOfDay),
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

  async function removeBadge(index: number) {

    const badge = badges[index]
    if (!badge.id) {
      setBadges((current) => current.filter((_, badgeIndex) => badgeIndex !== index))
      setEditingIndex((current) => {
        if (current === null) return null
        if (current === index) return null
        return current > index ? current - 1 : current
      })
      closeEffectModal()
      return
    }

    const confirmed = await showConfirm({
      title: "删除勋章",
      description: `确认删除勋章“${badge.name}”吗？`,
      confirmText: "删除",
      variant: "danger",
    })
    if (!confirmed) {
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
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <h3 className="text-lg font-semibold">勋章系统</h3>
            <p className="mt-1 text-sm text-muted-foreground">后台自定义勋章、领取条件、积分购买价和佩戴特效，前台用户满足条件后手动领取并可佩戴生效。</p>
          </div>
          <Button className="gap-2 rounded-full" onClick={appendBadge} type="button">
            <Plus className="h-4 w-4" />
            新建勋章
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-4">
          <Card>
            <CardContent className="py-4">
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
                      closeEffectModal()
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
                            <Badge className={badge.status ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"}>{badge.status ? "启用" : "停用"}</Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{badge.category || "社区成就"} · 条件 {badge.rules.length} · 特效 {badge.effects.length} · 领取 {badge.grantedUserCount ?? 0}</p>
                        </div>
                      </div>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <h4 className="text-base font-semibold">分类统计</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {categoryStats.map(([category, count]) => (
                  <Badge key={category} variant="secondary" className="rounded-full px-3 py-1 text-xs">{category} · {count}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          {!editingBadge ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">请选择左侧勋章，或新建一枚勋章开始配置。</CardContent>
            </Card>
          ) : (
            <Card className="shadow-soft">
              <CardContent className="py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">勋章编辑</h4>
                  <p className="mt-1 text-sm text-muted-foreground">条件为全部满足后可领取；不配条件即可纯积分购买；佩戴后仅已展示勋章的特效会生效。</p>
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
                <Field label="领取价格（积分）" type="number" value={String(editingBadge.pointsCost)} onChange={(value) => updateBadge(editingIndex!, { pointsCost: Math.max(0, Number(value) || 0) })} placeholder="如 100" />
                <IconPicker
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
                  <ColorPicker
                    label="主题色"
                    value={editingBadge.color}
                    onChange={(value) => updateBadge(editingIndex!, { color: value })}
                    presets={BADGE_COLOR_PRESETS}
                    fallbackColor="#64748b"
                    popoverTitle="选择勋章主题色"
                  />
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
                    <p className="mt-1 text-xs text-muted-foreground">按 AND 逻辑判断；可以为空，留空时表示无门槛或仅需积分购买。</p>
                  </div>
                  <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => appendRule(editingIndex!)}>
                    <Plus className="h-4 w-4" />
                    新增条件
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {editingBadge.rules.length === 0 ? <p className="text-sm text-muted-foreground">当前未设置领取条件。</p> : null}
                  {editingBadge.rules.map((rule, ruleIndex) => {
                    const typeMeta = getBadgeRuleTypeOption(rule.ruleType)
                    const isTimeRange = rule.ruleType === BadgeRuleType.REGISTER_TIME_RANGE
                    const registerTimeValueHint = isTimeRange ? (
                      <div className="space-y-1">
                        <p>这里直接用时间选择器选注册时间。</p>
                        <p>`早于 / 晚于` 只填写左侧时间。</p>
                        <p>`区间` 时左侧是开始时间，右侧是结束时间。</p>
                      </div>
                    ) : undefined
                    const registerTimeExtraHint = isTimeRange && rule.operator === BadgeRuleOperator.BETWEEN ? (
                      <div className="space-y-1">
                        <p>这里选择注册时间区间的结束时间。</p>
                        <p>两边都会按你选择的日期时间一起判断。</p>
                      </div>
                    ) : undefined
                    return (
                      <div key={`${rule.id ?? ruleIndex}-${rule.ruleType}`} className="rounded-[22px] border border-border bg-secondary/20 p-4">
                        <div className="grid gap-3 xl:grid-cols-[180px_120px_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                          <SelectField
                            label="条件类型"
                            value={rule.ruleType}
                            options={BADGE_RULE_TYPE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                            onChange={(value) => {
                              const nextRuleType = value as BadgeRuleTypeValue
                              const nextTypeMeta = getBadgeRuleTypeOption(nextRuleType)
                              const nextOperatorOptions = getBadgeRuleOperatorOptions(nextRuleType)
                              const nextOperator = nextOperatorOptions.some((item) => item.value === rule.operator)
                                ? rule.operator
                                : getDefaultBadgeRuleOperator(nextRuleType)
                              const keepCurrentValue = typeMeta?.valueMode === nextTypeMeta?.valueMode

                              updateRule(editingIndex!, ruleIndex, {
                                ruleType: nextRuleType,
                                operator: nextOperator,
                                value: keepCurrentValue ? rule.value : getDefaultBadgeRuleValue(nextRuleType),
                                extraValue: nextOperator === BadgeRuleOperator.BETWEEN && keepCurrentValue && rule.operator === BadgeRuleOperator.BETWEEN
                                  ? rule.extraValue ?? ""
                                  : "",
                              })
                            }}
                          />
                          <SelectField
                            label="运算符"
                            value={rule.operator}
                            options={getBadgeRuleOperatorOptions(rule.ruleType)}
                            onChange={(value) => {
                              const nextOperator = value as BadgeRuleOperator
                              updateRule(editingIndex!, ruleIndex, {
                                operator: nextOperator,
                                extraValue: nextOperator === BadgeRuleOperator.BETWEEN ? rule.extraValue ?? "" : "",
                              })
                            }}
                          />
                          <label className="space-y-2">
                            <LabelWithHint label={isTimeRange ? "开始值 / 时间" : "目标值"} hint={registerTimeValueHint} />
                            <ConditionValueField
                              mode={typeMeta?.valueMode}
                              value={rule.value}
                              onChange={(value) => updateRule(editingIndex!, ruleIndex, { value })}
                              placeholder={typeMeta?.placeholder ?? "请输入条件值"}
                              userLevelOptions={userLevelOptions}
                              vipLevelOptions={vipLevelOptions}
                              className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden transition-colors focus:border-foreground/30"
                            />
                          </label>
                          <label className="space-y-2">
                            <LabelWithHint label={rule.operator === BadgeRuleOperator.BETWEEN ? "结束时间 / 额外值" : "额外值（可选）"} hint={registerTimeExtraHint} />
                            <ConditionValueField
                              mode={isTimeRange && rule.operator === BadgeRuleOperator.BETWEEN ? "datetime-local" : "text"}
                              value={rule.extraValue ?? ""}
                              onChange={(value) => updateRule(editingIndex!, ruleIndex, { extraValue: value })}
                              placeholder={rule.operator === BadgeRuleOperator.BETWEEN ? "选择结束时间" : "一般可留空"}
                              className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden transition-colors focus:border-foreground/30"
                            />
                          </label>
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => removeRule(editingIndex!, ruleIndex)}>删除</Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold">佩戴特效</h5>
                    <p className="mt-1 text-xs text-muted-foreground">为勋章加持有趣玩法</p>
                  </div>
                  <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={openCreateEffectModal}>
                    <Plus className="h-4 w-4" />
                    新增特效
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {editingBadge.effects.length === 0 ? <p className="text-sm text-muted-foreground">当前未设置佩戴特效。</p> : null}
                  {editingBadge.effects.map((effect, effectIndex) => (
                    <div key={`${effect.id ?? effectIndex}-${effect.name}`} className="rounded-[22px] border border-border bg-secondary/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                              <Sparkles className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{effect.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {isFunctionalBadgeEffect(effect)
                                  ? `功能特效 · 打开首页自动签到 · ${effect.status ? "启用" : "停用"}`
                                  : `${getPointEffectTargetLabel(effect.targetType)} · ${getPointEffectRuleKindLabel(effect.ruleKind)} · ${getPointEffectDirectionLabel(effect.direction)} · ${effect.status ? "启用" : "停用"}`}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                            <p>范围：{buildEffectScopeSummary(effect)}</p>
                            <p>时间：{buildEffectTimeSummary(effect)}</p>
                            <p>数值：{buildEffectValueSummary(effect)}</p>
                          </div>
                          {effect.description ? <p className="mt-2 text-xs text-muted-foreground">{effect.description}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => openEditEffectModal(effectIndex)}>编辑</Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => removeEffect(editingIndex!, effectIndex)}>删除特效</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {feedback ? <p className="mt-4 text-sm text-muted-foreground">{feedback}</p> : null}
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(effectModal)}
        onClose={closeEffectModal}
        size="xl"
        title={effectModal?.mode === "edit" ? "编辑佩戴特效" : "新增佩戴特效"}
        description="作用目标切换时，生效范围会自动过滤为兼容选项；选择“功能”后，只保留功能范围，数值设定全部隐藏。"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={closeEffectModal}>取消</Button>
            <Button type="button" className="rounded-full" onClick={commitEffectModal} disabled={!effectModal?.draft.name.trim() || effectModal.draft.scopeKeys.length === 0}>
              保存特效
            </Button>
          </div>
        )}
      >
        {effectModal ? (
          <div className="space-y-5">
            {functionalEffectSelected ? (
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                该特效属于功能型特效。用户只要佩戴此勋章，打开首页时就会自动触发一次签到；积分、概率和数值设定都不会参与计算。
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="特效名称" value={effectModal.draft.name} onChange={(value) => updateEffectModalDraft({ name: value })} placeholder="如 签到增益" />
              <Field label="说明" value={effectModal.draft.description} onChange={(value) => updateEffectModalDraft({ description: value })} placeholder="可选" />
              <SelectField
                label="作用目标"
                hint={(
                  <div className="space-y-1">
                    <p>决定特效属于积分、概率，还是纯功能触发。</p>
                    <p>切换后，生效范围会自动过滤为对应类型。</p>
                  </div>
                )}
                value={effectModal.draft.targetType}
                options={targetOptions.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(value) => {
                  const nextTargetType = value as PointEffectTargetType
                  const normalizedScopeKeys = normalizePointEffectScopeKeysByTargetType(effectModal.draft.scopeKeys, nextTargetType)
                  updateEffectModalDraft({
                    targetType: nextTargetType,
                    scopeKeys: normalizedScopeKeys.length > 0 ? normalizedScopeKeys : getDefaultPointEffectScopeKeysByTargetType(nextTargetType),
                  })
                }}
              />
            </div>

            {!functionalEffectSelected ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SelectField
                  label="生效规则"
                  hint={(
                    <div className="space-y-1">
                      <p>固定值 / 百分比：按确定值结算。</p>
                      <p>随机固定值 / 随机百分比：会结合基础值和额外值组成区间。</p>
                      <p>随机正负倍数：只允许搭配“随机正负”方向。</p>
                    </div>
                  )}
                  value={effectModal.draft.ruleKind}
                  options={POINT_EFFECT_RULE_KIND_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                  onChange={(value) => updateEffectModalDraft({ ruleKind: value as PointEffectRuleKind })}
                />
                <SelectField
                  label="增减方向"
                  hint={(
                    <div className="space-y-1">
                      <p>增益：在原值基础上增加。</p>
                      <p>减益：在原值基础上减少。</p>
                      <p>随机正负：每次随机为正向或负向，只在“随机正负倍数”下可选。</p>
                    </div>
                  )}
                  value={effectModal.draft.direction}
                  options={modalDirectionOptions.map((item) => ({ value: item.value, label: item.label }))}
                  onChange={(value) => updateEffectModalDraft({ direction: value as PointEffectDirection })}
                />
                <Field
                  label="基础值"
                  hint={(
                    <div className="space-y-1">
                      <p>固定值：直接填增减数值，如 `5`。</p>
                      <p>百分比：填百分数本体，如 `2` 表示 2%。</p>
                      <p>随机区间 / 随机倍数：这里填区间起点。</p>
                    </div>
                  )}
                  value={effectModal.draft.value}
                  onChange={(value) => updateEffectModalDraft({ value })}
                  placeholder="如 5 或 2"
                />
                <Field
                  label="额外值 / 区间上限"
                  hint={(
                    <div className="space-y-1">
                      <p>固定值 / 百分比：一般留空。</p>
                      <p>随机固定值 / 随机百分比：填写区间上限，如 `5-10` 里的 `10`。</p>
                      <p>随机正负倍数：填写倍数上限，如 `1-2` 里的 `2`。</p>
                    </div>
                  )}
                  value={effectModal.draft.extraValue}
                  onChange={(value) => updateEffectModalDraft({ extraValue: value })}
                  placeholder="随机规则可填"
                />
                <Field
                  label="开始时间"
                  hint={(
                    <div className="space-y-1">
                      <p>按 `HH:mm` 选择，如 `09:00`。</p>
                      <p>和结束时间一起构成生效时段。</p>
                      <p>开始和结束都留空表示全天生效。</p>
                    </div>
                  )}
                  type="time"
                  value={effectModal.draft.startMinuteOfDay}
                  onChange={(value) => updateEffectModalDraft({ startMinuteOfDay: value })}
                />
                <Field
                  label="结束时间"
                  hint={(
                    <div className="space-y-1">
                      <p>按 `HH:mm` 选择，如 `23:00`。</p>
                      <p>若开始时间大于结束时间，表示跨天生效。</p>
                      <p>例如 `22:00 - 02:00` 表示夜间时段。</p>
                    </div>
                  )}
                  type="time"
                  value={effectModal.draft.endMinuteOfDay}
                  onChange={(value) => updateEffectModalDraft({ endMinuteOfDay: value })}
                />
              </div>
            ) : null}

            <div className="rounded-[24px] border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-sm font-semibold">生效范围</h5>
                    <Tooltip
                      align="start"
                      content={(
                        <div className="space-y-1">
                          <p>“所有积分增减 / 所有概率”和具体子项互斥。</p>
                          <p>选了“所有”，就不会再选具体子项。</p>
                          <p>选了任一子项，“所有”会自动取消并禁用。</p>
                        </div>
                      )}
                    >
                      <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-muted-foreground">
                        <CircleHelp className="h-3 w-3" />
                      </span>
                    </Tooltip>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">当前只展示 {getPointEffectTargetLabel(effectModal.draft.targetType)} 可用范围。</p>
                </div>
                <label className="flex items-center gap-2 rounded-[16px] border border-border bg-background px-3 py-2 text-xs">
                  <input type="checkbox" checked={effectModal.draft.status} onChange={(event) => updateEffectModalDraft({ status: event.target.checked })} />
                  启用该特效
                </label>
              </div>

              {functionalEffectSelected ? (
                <p className="mt-3 text-xs text-muted-foreground">已选择功能型目标。</p>
              ) : null}

              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {modalScopeOptions.map((scopeOption) => {
                  const allScopeKey = modalAllScopeKey ?? ""
                  const checked = effectModal.draft.scopeKeys.includes(scopeOption.value)
                  const hasSubScopesSelected = Boolean(modalAllScopeKey) && effectModal.draft.scopeKeys.some((scopeKey) => scopeKey !== allScopeKey)
                  const allScopeSelected = Boolean(modalAllScopeKey) && effectModal.draft.scopeKeys.includes(allScopeKey)
                  const disabled = modalAllScopeKey
                    ? scopeOption.value === allScopeKey
                      ? hasSubScopesSelected && !checked
                      : allScopeSelected
                    : false
                  return (
                    <label key={`effect-scope-${scopeOption.value}`} className="flex items-center gap-2 rounded-[16px] border border-border bg-background px-3 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => updateEffectModalDraft({
                          scopeKeys: event.target.checked
                            ? scopeOption.value === allScopeKey
                              ? [scopeOption.value]
                              : [
                                  ...effectModal.draft.scopeKeys.filter((scopeKey) => scopeKey !== allScopeKey),
                                  scopeOption.value,
                                ]
                            : effectModal.draft.scopeKeys.filter((scopeKey) => scopeKey !== scopeOption.value),
                        })}
                      />
                      {scopeOption.label}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Field({ label, hint, value, onChange, placeholder, type = "text", className = "" }: { label: string; hint?: ReactNode; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <label className={`space-y-2 ${className}`}>
      <LabelWithHint label={label} hint={hint} />
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-[18px] bg-background px-4 text-sm" />
    </label>
  )
}

function SelectField({ label, hint, value, options, onChange }: { label: string; hint?: ReactNode; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <LabelWithHint label={label} hint={hint} />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 rounded-[18px] bg-background px-4 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function LabelWithHint({ label, hint }: { label: string; hint?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {hint ? (
        <Tooltip content={hint} align="start">
          <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-muted-foreground">
            <CircleHelp className="h-3 w-3" />
          </span>
        </Tooltip>
      ) : null}
    </span>
  )
}
