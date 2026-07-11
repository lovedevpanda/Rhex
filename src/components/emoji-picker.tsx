"use client"

import { useMemo, useState } from "react"

import { LevelIcon } from "@/components/level-icon"
import { DEFAULT_MARKDOWN_EMOJI_GROUP, normalizeMarkdownEmojiGroup, type MarkdownEmojiItem } from "@/lib/markdown-emoji"
import { cn } from "@/lib/utils"

type EmojiPickerItem = Pick<MarkdownEmojiItem, "icon" | "label" | "group"> & {
  key: string
  value: string
}

interface EmojiPickerProps {
  items: EmojiPickerItem[]
  title?: string
  columns?: number
  className?: string
  panelClassName?: string
  buttonClassName?: string
  iconClassName?: string
  onSelect: (value: string) => void
}

const GRID_COLUMNS_CLASSNAME: Record<number, string> = {
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
}

function resolveColumns(itemCount: number, columns?: number) {
  if (columns) {
    return columns
  }

  return itemCount > 0 ? 8 : 4
}

function groupEmojiItems(items: EmojiPickerItem[]) {
  const groupMap = new Map<string, EmojiPickerItem[]>()

  for (const item of items) {
    const group = normalizeMarkdownEmojiGroup(item.group)
    const groupItems = groupMap.get(group)
    if (groupItems) {
      groupItems.push(item)
    } else {
      groupMap.set(group, [item])
    }
  }

  return Array.from(groupMap.entries()).map(([group, groupItems]) => ({
    group,
    items: groupItems,
  }))
}

export function EmojiPicker({
  items,
  title = "选择一个表情",
  columns,
  className,
  panelClassName,
  buttonClassName,
  iconClassName,
  onSelect,
}: EmojiPickerProps) {
  const resolvedColumns = resolveColumns(items.length, columns)
  const gridColumnsClassName = GRID_COLUMNS_CLASSNAME[resolvedColumns] ?? GRID_COLUMNS_CLASSNAME[4]
  const groups = useMemo(() => groupEmojiItems(items), [items])
  const defaultGroup = groups.find((group) => group.group === DEFAULT_MARKDOWN_EMOJI_GROUP) ?? groups[0]
  const [requestedActiveGroup, setRequestedActiveGroup] = useState(defaultGroup?.group ?? DEFAULT_MARKDOWN_EMOJI_GROUP)
  const activeGroup = groups.some((group) => group.group === requestedActiveGroup)
    ? requestedActiveGroup
    : defaultGroup?.group ?? DEFAULT_MARKDOWN_EMOJI_GROUP
  const activeGroupItems = groups.find((group) => group.group === activeGroup)?.items ?? defaultGroup?.items ?? []

  function renderGrid(groupItems: EmojiPickerItem[]) {
    return (
      <div className={cn("grid max-h-[260px] gap-x-2 gap-y-2.5 overflow-y-auto px-3.5 py-3.5 max-sm:gap-x-1 max-sm:gap-y-1.5 max-sm:px-2 max-sm:py-2", gridColumnsClassName, className)}>
        {groupItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn("flex aspect-square min-h-0 items-center justify-center rounded-md bg-transparent p-1 transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", buttonClassName)}
            onClick={() => onSelect(item.value)}
            title={item.label}
            aria-label={item.label}
          >
            <LevelIcon
              icon={item.icon}
              title={item.label}
              className={cn("size-8 text-[30px] leading-none max-sm:size-6 max-sm:text-[24px]", iconClassName)}
              emojiClassName="leading-none"
              svgClassName="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            />
          </button>
        ))}
      </div>
    )
  }

  if (groups.length > 0) {
    return (
      <div className={cn("flex min-w-0 flex-col overflow-hidden rounded-[14px] bg-background", panelClassName)}>
        <div className="flex h-9 items-center gap-4 overflow-x-auto border-b border-border/70 px-4 max-sm:h-8 max-sm:gap-2.5 max-sm:px-2.5" role="tablist" aria-label={title}>
          {groups.map((group) => {
            const active = group.group === activeGroup

            return (
              <button
                key={group.group}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "relative flex h-full flex-none items-center px-0 text-sm font-semibold text-muted-foreground transition hover:text-foreground max-sm:text-xs",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
                  active && "text-primary after:opacity-100",
                )}
                onClick={() => setRequestedActiveGroup(group.group)}
              >
                {group.group}
              </button>
            )
          })}
        </div>
        <div role="tabpanel" aria-label={activeGroup}>
          {renderGrid(activeGroupItems)}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", panelClassName)}>
      <div className="text-xs text-muted-foreground">{title}</div>
      {renderGrid(groups[0]?.items ?? [])}
    </div>
  )
}
