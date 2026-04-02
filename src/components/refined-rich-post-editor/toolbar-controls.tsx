"use client"

import React, { useState } from "react"
import { AlignCenter, AlignLeft, AlignRight, Code2, List, ListOrdered, ListTodo } from "lucide-react"

import { TOOLBAR_TIPS } from "@/components/refined-rich-post-editor/constants"
import type { ToolbarTipDefinition } from "@/components/refined-rich-post-editor/types"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Tooltip } from "@/components/ui/tooltip"
import { resolvePlatformShortcuts, type ClientPlatform } from "@/lib/client-platform"

type ToolbarSelectProps<TValue> = {
  disabled?: boolean
  onOpenChange?: (open: boolean) => void
  onSelect: (value: TValue) => void
  onMouseDown?: () => void
  platform: ClientPlatform
}

function HeadingLevelOneIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 1047 1024" xmlns="http://www.w3.org/2000/svg">
      <path d="M472.296727 930.909091v-372.363636H116.363636v372.363636h-93.090909V93.090909h93.090909v372.363636h355.886546V93.090909h93.090909v837.818182z" />
      <path d="M874.170182 930.955636v-0.418909h-120.413091v-69.818182h120.413091v-364.171636a283.927273 283.927273 0 0 1-120.413091 67.072V483.141818a301.335273 301.335273 0 0 0 74.146909-31.278545 304.500364 304.500364 0 0 0 66.187636-52.922182h60.183273v461.730909h93.090909v69.818182h-93.090909V930.909091z" />
    </svg>
  )
}

function HeadingLevelTwoIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <path d="M662.667636 930.909091a203.776 203.776 0 0 1 52.130909-139.310546 667.787636 667.787636 0 0 1 118.225455-96.954181 547.467636 547.467636 0 0 0 74.891636-61.021091 130.653091 130.653091 0 0 0 35.979637-87.179637 86.946909 86.946909 0 0 0-24.250182-67.025454 102.4 102.4 0 0 0-71.214546-22.341818 86.853818 86.853818 0 0 0-74.938181 34.257454 163.607273 163.607273 0 0 0-27.927273 97.745455h-80.058182a206.196364 206.196364 0 0 1 50.688-143.034182 170.402909 170.402909 0 0 1 134.981818-57.344 176.267636 176.267636 0 0 1 124.136728 43.938909 150.807273 150.807273 0 0 1 47.662545 114.734545 185.530182 185.530182 0 0 1-51.2 125.952 740.864 740.864 0 0 1-108.683636 85.690182 258.513455 258.513455 0 0 0-101.329455 100.538182H1024V930.909091z m-216.482909 0v-372.363636H93.090909v372.363636H0V93.090909h93.090909v372.363636h353.047273V93.090909h93.090909v837.818182z" />
    </svg>
  )
}

function HeadingLevelThreeIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <path d="M707.490909 894.417455a188.509091 188.509091 0 0 1-61.719273-136.331637h80.802909a110.033455 110.033455 0 0 0 34.490182 82.711273 105.006545 105.006545 0 0 0 74.845091 26.810182 114.641455 114.641455 0 0 0 81.547637-29.789091 90.670545 90.670545 0 0 0 27.22909-66.327273 82.199273 82.199273 0 0 0-28.672-69.259636 119.202909 119.202909 0 0 0-78.568727-22.434909h-38.167273v-61.067637h37.515637a107.799273 107.799273 0 0 0 72.657454-21.643636 78.382545 78.382545 0 0 0 24.994909-61.812364 80.709818 80.709818 0 0 0-22.807272-61.067636 102.4 102.4 0 0 0-71.261091-21.643636 104.866909 104.866909 0 0 0-74.146909 24.66909 110.312727 110.312727 0 0 0-31.604364 73.681455h-78.568727a174.638545 174.638545 0 0 1 58.042182-123.671273 177.524364 177.524364 0 0 1 125.672727-43.938909 194.699636 194.699636 0 0 1 127.022545 38.772364 133.352727 133.352727 0 0 1 47.010909 107.054545 115.246545 115.246545 0 0 1-86.667636 117.015273 146.338909 146.338909 0 0 1 70.516364 43.892364 113.943273 113.943273 0 0 1 26.391272 77.544727 158.999273 158.999273 0 0 1-49.943272 120.645818 200.471273 200.471273 0 0 1-137.309091 47.662546 193.117091 193.117091 0 0 1-129.303273-41.472z m-261.306182 41.890909v-382.976H93.090909v372.363636H0v-837.818182h93.090909v372.363637h353.093818V98.304h93.090909v837.818182z" />
    </svg>
  )
}

function ToolbarTip({ label, shortcuts, description, platform }: ToolbarTipDefinition & { platform: ClientPlatform }) {
  const shortcutLabels = resolvePlatformShortcuts(shortcuts, platform)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-50">{label}</span>
        {shortcutLabels.length > 0 ? (
          <span className="inline-flex flex-wrap justify-end gap-1">
            {shortcutLabels.map((shortcut) => (
              <kbd
                key={shortcut}
                className="rounded-md border border-slate-300/80 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-slate-600 shadow-sm dark:border-slate-600/80 dark:bg-slate-900/60 dark:text-slate-200"
              >
                {shortcut}
              </kbd>
            ))}
          </span>
        ) : null}
      </div>
      {description ? <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-300/80">{description}</p> : null}
    </div>
  )
}

function getToolbarTitle({ label, shortcuts }: ToolbarTipDefinition, platform: ClientPlatform) {
  const shortcutLabels = resolvePlatformShortcuts(shortcuts, platform)
  if (shortcutLabels.length === 0) {
    return label
  }

  return `${label} (${shortcutLabels.join(" / ")})`
}

export function ToolButton({
  tip,
  platform,
  onClick,
  children,
  disabled = false,
  active = false,
  onMouseDown,
}: {
  tip: ToolbarTipDefinition
  platform: ClientPlatform
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  active?: boolean
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <Tooltip content={<ToolbarTip {...tip} platform={platform} />}>
      <button
        type="button"
        aria-label={tip.label}
        onMouseDown={onMouseDown}
        onClick={onClick}
        disabled={disabled}
        className={active ? "shrink-0 rounded-lg bg-accent p-2 text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50" : "shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function ToolbarSelectTrigger({ tip, platform, children }: { tip: ToolbarTipDefinition; platform: ClientPlatform; children: React.ReactNode }) {
  return (
    <Tooltip content={<ToolbarTip {...tip} platform={platform} />}>
      <SelectTrigger
        aria-label={tip.label}
        title={getToolbarTitle(tip, platform)}
        className="h-9 w-9 shrink-0 justify-center gap-0.5 rounded-xl border-0 bg-transparent px-0 text-sm font-semibold text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus:ring-0 focus:ring-offset-0 [&>span]:flex [&>span]:w-auto [&>span]:items-center [&>span]:justify-center [&>span]:text-center [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-55"
      >
        {children}
      </SelectTrigger>
    </Tooltip>
  )
}

export function HeadingSelect({ disabled, onOpenChange, onSelect, onMouseDown, platform }: ToolbarSelectProps<1 | 2 | 3>) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        const level = Number(nextValue)
        if (level === 1 || level === 2 || level === 3) {
          onSelect(level)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger tip={TOOLBAR_TIPS.heading} platform={platform}>
        <HeadingLevelOneIcon />
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="1" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <HeadingLevelOneIcon />
          一级标题
        </SelectItem>
        <SelectItem value="2" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <HeadingLevelTwoIcon />
          二级标题
        </SelectItem>
        <SelectItem value="3" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <HeadingLevelThreeIcon />
          三级标题
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export function AlignmentSelect({ disabled, onOpenChange, onSelect, onMouseDown, platform }: ToolbarSelectProps<"left" | "center" | "right">) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        if (nextValue === "left" || nextValue === "center" || nextValue === "right") {
          onSelect(nextValue)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger tip={TOOLBAR_TIPS.alignment} platform={platform}>
        <AlignLeft className="h-4 w-4 shrink-0" />
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="left" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <AlignLeft className="h-4 w-4 shrink-0" />
          左对齐
        </SelectItem>
        <SelectItem value="center" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <AlignCenter className="h-4 w-4 shrink-0" />
          居中
        </SelectItem>
        <SelectItem value="right" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <AlignRight className="h-4 w-4 shrink-0" />
          右对齐
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export function ListSelect({ disabled, onOpenChange, onSelect, onMouseDown, platform }: ToolbarSelectProps<"unordered" | "unordered-star" | "ordered" | "task">) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        if (nextValue === "unordered" || nextValue === "unordered-star" || nextValue === "ordered" || nextValue === "task") {
          onSelect(nextValue)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger tip={TOOLBAR_TIPS.list} platform={platform}>
        <List className="h-4 w-4 shrink-0" />
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="unordered" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <List className="h-4 w-4 shrink-0" />
          无序列表
        </SelectItem>
        <SelectItem value="unordered-star" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <List className="h-4 w-4 shrink-0" />
          星号列表
        </SelectItem>
        <SelectItem value="ordered" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <ListOrdered className="h-4 w-4 shrink-0" />
          有序列表
        </SelectItem>
        <SelectItem value="task" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <ListTodo className="h-4 w-4 shrink-0" />
          待办列表
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export function CodeFormatSelect({ disabled, onOpenChange, onSelect, onMouseDown, platform }: ToolbarSelectProps<"inline-code" | "code-block">) {
  const [value, setValue] = useState("")

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          onMouseDown?.()
        }
        onOpenChange?.(open)
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue)
        if (nextValue === "inline-code" || nextValue === "code-block") {
          onSelect(nextValue)
        }
        requestAnimationFrame(() => {
          setValue("")
        })
      }}
      disabled={disabled}
    >
      <ToolbarSelectTrigger tip={TOOLBAR_TIPS.code} platform={platform}>
        <Code2 className="h-4 w-4 shrink-0" />
      </ToolbarSelectTrigger>
      <SelectContent className="bg-background/100">
        <SelectItem value="inline-code" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <Code2 className="h-4 w-4 shrink-0" />
          行内代码
        </SelectItem>
        <SelectItem value="code-block" className="flex items-center gap-2 pl-3 [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:gap-2">
          <Code2 className="h-4 w-4 shrink-0" />
          代码块
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
