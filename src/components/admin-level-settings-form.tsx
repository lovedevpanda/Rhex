"use client"

import { ArrowDown, ArrowUp, CheckCircle2, ChevronRight, Crown, GripVertical, Plus, Save, Trash2 } from "lucide-react"
import { useMemo, useRef, useState, useTransition } from "react"

import { AdminIconPickerField } from "@/components/admin-icon-picker-field"
import { LevelIcon } from "@/components/level-icon"
import { PickerPopover, PickerTriggerField, normalizeHexColor } from "@/components/admin-picker-popover"
import { Button } from "@/components/ui/button"



interface LevelDefinitionFormItem {
  id?: string
  level: number
  name: string
  color: string
  icon: string
  requireCheckInDays: number
  requirePostCount: number
  requireCommentCount: number
  requireLikeCount: number
}

interface AdminLevelSettingsFormProps {
  initialLevels: LevelDefinitionFormItem[]
}

const LEVEL_ICON_PRESETS = ["🌱", "⭐", "🔥", "⚡", "💎", "👑", "🛡️", "🚀", "🎯", "🏆", "🌈", "🧠"]
const LEVEL_COLOR_PRESETS = ["#64748b", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#ca8a04"]

type PickerState =
  | { type: "color"; index: number }
  | null


function createLevel(level: number): LevelDefinitionFormItem {
  return {
    level,
    name: `等级 ${level}`,
    color: "#64748b",
    icon: "⭐",
    requireCheckInDays: 0,
    requirePostCount: 0,
    requireCommentCount: 0,
    requireLikeCount: 0,
  }
}

function formatRequirementSummary(level: LevelDefinitionFormItem, readonlyBase: boolean) {
  if (readonlyBase) {
    return "注册即得"
  }

  const parts = [
    level.requireCheckInDays > 0 ? `签 ${level.requireCheckInDays}` : null,
    level.requirePostCount > 0 ? `帖 ${level.requirePostCount}` : null,
    level.requireCommentCount > 0 ? `回 ${level.requireCommentCount}` : null,
    level.requireLikeCount > 0 ? `赞 ${level.requireLikeCount}` : null,
  ].filter(Boolean)

  if (parts.length === 0) {
    return "无额外门槛"
  }

  return parts.join(" · ")
}

function clampToNonNegative(value: string) {
  return Math.max(0, Number(value) || 0)
}



export function AdminLevelSettingsForm({ initialLevels }: AdminLevelSettingsFormProps) {
  const [levels, setLevels] = useState<LevelDefinitionFormItem[]>(initialLevels)
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()
  const [picker, setPicker] = useState<PickerState>(null)
  const pickerContainerRef = useRef<HTMLDivElement | null>(null)

  const sortedLevels = useMemo(() => levels.map((item, index) => ({ ...item, level: index + 1 })), [levels])

  function updateLevel(index: number, patch: Partial<LevelDefinitionFormItem>) {
    setLevels((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function appendLevel() {
    setLevels((current) => [...current, createLevel(current.length + 1)])
  }

  function removeLevel(index: number) {
    setLevels((current) => current.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, level: itemIndex + 1 })))
    setPicker((current) => (current?.index === index ? null : current))
  }

  function moveLevel(index: number, direction: "up" | "down") {
    setLevels((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current
      }

      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(targetIndex, 0, item)
      return next.map((level, itemIndex) => ({ ...level, level: itemIndex + 1 }))
    })
    setPicker(null)
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const response = await fetch("/api/admin/levels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ levels: sortedLevels }),
          })
          const result = await response.json()
          setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
          if (response.ok && Array.isArray(result.data)) {
            setLevels(result.data)
          }
        })
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-border bg-card px-4 py-3">
        <div>
          <h4 className="text-sm font-semibold">等级规则</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">满足下面条件则自动升级等级</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-full px-3" onClick={appendLevel}>
            <Plus className="mr-1 h-4 w-4" />
            新增
          </Button>
          <Button disabled={isPending} className="h-9 rounded-full px-4">
            <Save className="mr-1.5 h-4 w-4" />
            {isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="space-y-2.5">
        {sortedLevels.map((level, index) => {
          const readonlyBase = index === 0
          const summary = formatRequirementSummary(level, readonlyBase)
          const nextLevelName = sortedLevels[index + 1]?.name
          const canMoveUp = index > 1
          const canMoveDown = index > 0 && index < sortedLevels.length - 1
          const showColorPicker = picker?.type === "color" && picker.index === index


          return (
            <div key={level.id ?? `level-${level.level}`} className="rounded-[20px] border border-border bg-card px-3 py-3 shadow-sm shadow-black/5">
              <div className="grid gap-3 xl:grid-cols-[210px_110px_96px_minmax(0,1fr)_auto] xl:items-center">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-lg"
                    style={{
                      color: level.color,
                      backgroundColor: `${level.color}14`,
                      borderColor: `${level.color}33`,
                    }}
                  >
                    <LevelIcon icon={level.icon} color={level.color} className="h-5 w-5 text-[18px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">Lv.{level.level}</span>
                      <span className="truncate text-sm" style={{ color: level.color }}>{level.name || `等级 ${level.level}`}</span>
                      {readonlyBase ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">默认</span> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <span>{summary}</span>
                      {nextLevelName ? (
                        <>
                          <ChevronRight className="h-3 w-3" />
                          <span>{nextLevelName}</span>
                        </>
                      ) : (
                        <>
                          <Crown className="h-3 w-3 text-amber-500" />
                          <span>最高级</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <CompactField label="名称" value={level.name} onChange={(value) => updateLevel(index, { name: value })} placeholder="等级名" />

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">名称颜色</p>
                  <PickerTriggerField value={level.color} previewColor={level.color} fallbackColor="#64748b" onClick={() => setPicker(showColorPicker ? null : { type: "color", index })} />
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[92px_92px_92px_92px_112px] xl:items-end">
                  <NumberField label="签到" value={String(level.requireCheckInDays)} onChange={(value) => updateLevel(index, { requireCheckInDays: clampToNonNegative(value) })} disabled={readonlyBase} />
                  <NumberField label="发帖" value={String(level.requirePostCount)} onChange={(value) => updateLevel(index, { requirePostCount: clampToNonNegative(value) })} disabled={readonlyBase} />
                  <NumberField label="回复" value={String(level.requireCommentCount)} onChange={(value) => updateLevel(index, { requireCommentCount: clampToNonNegative(value) })} disabled={readonlyBase} />
                  <NumberField label="获赞" value={String(level.requireLikeCount)} onChange={(value) => updateLevel(index, { requireLikeCount: clampToNonNegative(value) })} disabled={readonlyBase} />

                  <div ref={showColorPicker ? pickerContainerRef : undefined}>
                    <AdminIconPickerField
                      label="图标"
                      value={level.icon}
                      onChange={(value) => updateLevel(index, { icon: value })}
                      presets={LEVEL_ICON_PRESETS}
                      previewColor={level.color}
                      popoverTitle="选择等级图标"
                    />
                  </div>

                </div>

                <div className="flex items-center justify-end gap-1">
                  <IconButton label="上移" disabled={!canMoveUp} onClick={() => moveLevel(index, "up")}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="下移" disabled={!canMoveDown} onClick={() => moveLevel(index, "down")}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="删除" disabled={readonlyBase} onClick={() => removeLevel(index)} destructive>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>

              {showColorPicker ? (
                <PickerPopover title="选择等级名称颜色" onClose={() => setPicker(null)}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={normalizeHexColor(level.color, "#64748b")}
                      onChange={(event) => updateLevel(index, { color: event.target.value })}
                      className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-0.5"
                      aria-label={`选择 Lv.${level.level} 的名称颜色`}
                    />
                    <input
                      value={level.color}
                      onChange={(event) => updateLevel(index, { color: event.target.value })}
                      className="h-8 w-28 rounded-full border border-border bg-background px-3 text-xs outline-none"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {LEVEL_COLOR_PRESETS.map((preset) => {
                      const active = level.color.toLowerCase() === preset.toLowerCase()
                      return (
                        <button
                          key={`${level.level}-${preset}`}
                          type="button"
                          className={active ? "h-7 w-7 rounded-full ring-2 ring-foreground/20 ring-offset-1 ring-offset-background" : "h-7 w-7 rounded-full border border-border"}
                          style={{ backgroundColor: preset }}
                          onClick={() => {
                            updateLevel(index, { color: preset })
                            setPicker(null)
                          }}
                          aria-label={`使用颜色 ${preset}`}
                        />
                      )
                    })}
                  </div>
                </PickerPopover>
              ) : null}





            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{feedback || ""}</span>
        </div>
        <Button disabled={isPending} className="h-9 rounded-full px-4">
          <Save className="mr-1.5 h-4 w-4" />
          {isPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </form>
  )
}

function CompactField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-full border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-foreground/30"
      />
    </div>
  )
}

function NumberField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-full border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-foreground/30 disabled:cursor-not-allowed disabled:bg-secondary/40 disabled:opacity-60"
      />
    </div>
  )
}



function IconButton({ label, children, onClick, disabled = false, destructive = false }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; destructive?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={destructive ? "flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-400/20 dark:text-red-300 dark:hover:bg-red-500/10" : "flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"}
    >
      {children}
    </button>
  )
}
