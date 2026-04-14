"use client"

import type { ReactNode } from "react"

import { CircleHelp } from "lucide-react"

import { ColorPicker } from "@/components/ui/color-picker"
import { IconPicker } from "@/components/ui/icon-picker"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import type {
  BoardSidebarLinkDraft,
  SelectFieldOption,
} from "@/components/admin/admin-structure.types"
import type { BoardItem, ZoneItem } from "@/lib/admin-structure-management"
import type { BoardSidebarLinkItem } from "@/lib/board-sidebar-config"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

export const postTypeOptions = [
  { value: "NORMAL", label: "普通帖" },
  { value: "BOUNTY", label: "悬赏帖" },
  { value: "POLL", label: "投票帖" },
  { value: "LOTTERY", label: "抽奖帖" },
  { value: "AUCTION", label: "拍卖帖" },
] as const

export const boardStatusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "ACTIVE", label: "启用中" },
  { value: "HIDDEN", label: "已隐藏" },
  { value: "DISABLED", label: "已停用" },
]

export const postingOptions = [
  { value: "ALL", label: "全部发帖权限" },
  { value: "on", label: "允许发帖" },
  { value: "off", label: "暂停发帖" },
]

const EMPTY_SELECT_VALUE = "__empty__"

export function createEmptyBoardSidebarLink(): BoardSidebarLinkItem {
  return {
    title: "",
    url: "",
    icon: null,
    titleColor: null,
  }
}

export function getZoneHomeFeedVisibilityLabel(zone: ZoneItem) {
  return zone.showInHomeFeed ? "首页显示" : "首页隐藏"
}

export function getBoardHomeFeedVisibilityLabel(board: BoardItem) {
  if (board.showInHomeFeed == null) {
    return board.effectiveShowInHomeFeed ? "首页显示(继承)" : "首页隐藏(继承)"
  }

  return board.showInHomeFeed ? "首页显示" : "首页隐藏"
}

export function SelectField({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: SelectFieldOption[]
  onValueChange: (value: string) => void
}) {
  const normalizedValue = value === "" ? EMPTY_SELECT_VALUE : value

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <Select
        value={normalizedValue}
        onValueChange={(nextValue) =>
          onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}
      >
        <SelectTrigger className="h-10 rounded-full bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value || EMPTY_SELECT_VALUE}
              value={option.value === "" ? EMPTY_SELECT_VALUE : option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function MetricBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/35 px-2.5 py-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <p className="mt-1 font-medium text-foreground">{formatNumber(value)}</p>
    </div>
  )
}

export function BoardSidebarLinkEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: BoardSidebarLinkDraft
  index: number
  onChange: (
    index: number,
    key: keyof BoardSidebarLinkDraft,
    value: BoardSidebarLinkDraft[keyof BoardSidebarLinkDraft],
  ) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="rounded-[18px] border border-border bg-card/60 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(360px,1.6fr)_110px_72px] lg:items-center">
        <div className="flex items-center gap-2">
          <IconPicker
            label="图标"
            value={item.icon ?? ""}
            onChange={(value) => onChange(index, "icon", value.trim() ? value : null)}
            popoverTitle="选择节点链接图标"
            containerClassName="shrink-0"
            triggerClassName="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-left text-sm transition-colors hover:bg-accent"
            textareaRows={3}
            hideLabel
            triggerMode="icon"
          />
          <Input
            value={item.title}
            onChange={(event) => onChange(index, "title", event.target.value)}
            placeholder="标题"
            className="h-9 min-w-0 flex-1 rounded-full bg-background px-3"
          />
        </div>
        <Input
          value={item.url}
          onChange={(event) => onChange(index, "url", event.target.value)}
          placeholder="/help/pkq 或 https://example.com"
          className="h-9 min-w-0 rounded-full bg-background px-3"
        />
        <BoardSidebarLinkColorField
          value={item.titleColor ?? ""}
          onChange={(value) => onChange(index, "titleColor", value || null)}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full px-3 text-xs"
            onClick={() => onRemove(index)}
          >
            删除
          </Button>
        </div>
      </div>
    </div>
  )
}

function BoardSidebarLinkColorField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <ColorPicker
      value={value}
      onChange={onChange}
      hideLabel
      allowClear
      clearLabel="清空"
      fallbackColor="#111827"
      placeholder="#111827"
      popoverTitle="选择标题颜色"
    />
  )
}

export function Field({
  label,
  help,
  value,
  onChange,
  placeholder,
}: {
  label: string
  help?: ReactNode
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium">{label}</p>
        {help ? (
          <Tooltip content={help} contentClassName="max-w-[320px]" enableMobileTap>
            <button
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`${label}填写说明`}
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-full bg-background px-4"
      />
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{label}</p>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-[24px] bg-background px-4 py-3"
      />
    </div>
  )
}

export function getBoardStatusBadgeClassName(status: BoardItem["status"]) {
  if (status === "HIDDEN") {
    return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }

  if (status === "DISABLED") {
    return "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
  }

  return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex h-11 items-center justify-between rounded-full border border-border bg-background px-4 text-sm">
      <span>{label}</span>
      <Button
        type="button"
        variant={checked ? "default" : "outline"}
        size="sm"
        className="rounded-full px-3"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
      >
        {checked ? "已开启" : "已关闭"}
      </Button>
    </div>
  )
}

export function getStructureNumericFieldHelp({
  field,
  isBoard,
  isModeratorBoardEdit,
}: {
  field: "postPointDelta" | "replyPointDelta" | "postIntervalSeconds" | "replyIntervalSeconds"
  isBoard: boolean
  isModeratorBoardEdit: boolean
}) {
  const isPointsField = field === "postPointDelta" || field === "replyPointDelta"
  const inheritText = isBoard ? "留空：继承所属分区的设置。" : "分区建议直接填写明确数值；留空时会回落到系统默认值。"
  const zeroText = isPointsField ? "填写 0：不加分也不扣分。" : "填写 0：不限制操作频率。"
  const negativeText = isPointsField ? "填写负数：执行操作时扣除对应积分。" : "填写负数：系统会按“无频率限制”处理。"
  const positiveText = isPointsField ? "填写正数：执行成功后奖励对应积分。" : "填写正数：要求用户等待这么多秒后才能再次操作。"

  return (
    <div className="space-y-1.5 text-[12px] leading-5">
      <p>{inheritText}</p>
      <p>{zeroText}</p>
      <p>{negativeText}</p>
      {!isModeratorBoardEdit ? <p>{positiveText}</p> : <p>版主编辑节点时：只能填写留空、0 或负数，不能填写正数。</p>}
    </div>
  )
}

export function getStructureAccessFieldHelp({
  field,
  isBoard,
}: {
  field:
    | "minViewPoints"
    | "minViewLevel"
    | "minPostPoints"
    | "minPostLevel"
    | "minReplyPoints"
    | "minReplyLevel"
    | "minViewVipLevel"
    | "minPostVipLevel"
    | "minReplyVipLevel"
  isBoard: boolean
}) {
  const inheritText = isBoard ? "留空：继承所属分区的限制。" : "分区建议直接填写明确数值；留空时会回落到系统默认值。"
  const isVipField = field === "minViewVipLevel" || field === "minPostVipLevel" || field === "minReplyVipLevel"
  const isLevelField = field === "minViewLevel" || field === "minPostLevel" || field === "minReplyLevel"
  const actionText = field.startsWith("minView") ? "浏览" : field.startsWith("minPost") ? "发帖" : "回复"
  const thresholdText = isVipField
    ? `填写数值：只有 VIP 等级大于等于该值的用户才能${actionText}。`
    : isLevelField
      ? `填写数值：只有等级大于等于该值的用户才能${actionText}。`
      : `填写数值：只有积分大于等于该值的用户才能${actionText}。`
  const zeroText = "填写 0：不额外限制这项权限。"

  return (
    <div className="space-y-1.5 text-[12px] leading-5">
      <p>{inheritText}</p>
      <p>{zeroText}</p>
      <p>{thresholdText}</p>
    </div>
  )
}
