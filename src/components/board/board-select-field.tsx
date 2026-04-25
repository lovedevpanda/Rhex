"use client"

import { Check, ChevronDown, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface BoardSelectItem {
  value: string
  label: string
}

export interface BoardSelectGroup {
  zone: string
  items: BoardSelectItem[]
}

interface BoardSelectFieldProps {
  boardOptions: BoardSelectGroup[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  title?: string
  description?: string
}

export function BoardSelectField({
  boardOptions,
  value,
  onChange,
  disabled,
  placeholder = "请选择节点",
  title = "选择节点",
  description = "支持按分区、节点名或 slug 搜索",
}: BoardSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const allBoards = useMemo(
    () => boardOptions.flatMap((group) => group.items.map((item) => ({ ...item, zone: group.zone }))),
    [boardOptions],
  )
  const selectedBoard = value
    ? allBoards.find((item) => item.value === value) ?? null
    : null
  const [activeZone, setActiveZone] = useState(selectedBoard?.zone ?? boardOptions[0]?.zone ?? "")

  const normalizedQuery = query.trim().toLowerCase()
  const filteredGroups = useMemo(
    () => boardOptions
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!normalizedQuery) {
            return true
          }

          const haystack = `${group.zone} ${item.label} ${item.value}`.toLowerCase()
          return haystack.includes(normalizedQuery)
        }),
      }))
      .filter((group) => group.items.length > 0),
    [boardOptions, normalizedQuery],
  )
  const activeGroup = filteredGroups.find((group) => group.zone === activeZone) ?? filteredGroups[0] ?? null
  const visibleBoards = activeGroup?.items ?? []

  function closeDialog() {
    setOpen(false)
    setQuery("")
  }

  function openDialog() {
    setActiveZone(selectedBoard?.zone ?? boardOptions[0]?.zone ?? "")
    setOpen(true)
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue)
    closeDialog()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            openDialog()
          }
        }}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-full border border-border bg-card px-4 text-left text-sm outline-hidden transition-colors",
          disabled ? "cursor-not-allowed opacity-70" : "hover:bg-accent/50",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          {selectedBoard ? `${selectedBoard.zone} / ${selectedBoard.label}` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Modal
        open={open}
        onClose={closeDialog}
        size="lg"
        title={title}
        description={description}
        footer={(
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={closeDialog}>
              关闭
            </Button>
          </div>
        )}
      >
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索分区、节点名称或 slug"
              className="h-11 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              autoFocus
            />
          </label>

          {filteredGroups.length > 0 ? (
            <div className="grid min-h-[min(65dvh,34rem)] grid-cols-[9.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card/60">
                <div className="border-b px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground">
                  分区
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="flex flex-col gap-1 p-2">
                    {filteredGroups.map((group) => {
                      const zoneActive = group.zone === activeGroup?.zone

                      return (
                        <Button
                          key={group.zone}
                          type="button"
                          variant={zoneActive ? "secondary" : "ghost"}
                          onClick={() => setActiveZone(group.zone)}
                          className="h-auto justify-start rounded-xl px-3 py-2 text-left"
                        >
                          <span className="truncate">{group.zone}</span>
                        </Button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card/40">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{activeGroup?.zone ?? "节点"}</p>
                    <p className="text-xs text-muted-foreground">
                      {visibleBoards.length} 个可选节点
                    </p>
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="flex flex-col gap-2 p-3">
                    {visibleBoards.map((item) => {
                      const active = item.value === value

                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => handleSelect(item.value)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                            active ? "border-foreground/20 bg-accent" : "border-border bg-card hover:bg-accent/50",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                            <p className="truncate text-xs leading-6 text-muted-foreground">{item.value}</p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex size-6 shrink-0 items-center justify-center rounded-full border",
                              active ? "border-foreground bg-foreground text-background" : "border-border text-transparent",
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
              没有找到匹配的节点，请换个关键词试试。
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

