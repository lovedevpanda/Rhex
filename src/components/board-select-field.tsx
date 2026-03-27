"use client"

import { Check, ChevronDown, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
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
  description = "支持按分区、节点名或 slug 搜索，节点较多时也能快速定位。",
}: BoardSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const allBoards = useMemo(
    () => boardOptions.flatMap((group) => group.items.map((item) => ({ ...item, zone: group.zone }))),
    [boardOptions],
  )

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

  const selectedBoard = allBoards.find((item) => item.value === value) ?? allBoards[0]

  function closeDialog() {
    setOpen(false)
    setQuery("")
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
            setOpen(true)
          }
        }}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-full border border-border bg-card px-4 text-left text-sm outline-none transition-colors",
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

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/45" onClick={closeDialog}>
          <div className="flex min-h-full items-end justify-center overflow-y-auto px-0 pt-8 sm:items-center sm:px-4 sm:py-6">
            <div
              className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-2xl sm:rounded-[28px] sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
                </div>
                <Button type="button" variant="ghost" className="h-8 px-2" onClick={closeDialog}>
                  关闭
                </Button>
              </div>

              <div className="mt-4 rounded-[20px] border border-border bg-card/70 p-3">
                <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索分区、节点名称或 slug"
                    className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                </label>
              </div>

              <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2">
                {filteredGroups.length > 0 ? filteredGroups.map((group) => (
                  <section key={group.zone} className="space-y-2">
                    <div className="sticky top-0 z-10 bg-background/95 py-1 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur">
                      {group.zone}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const active = item.value === value
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => handleSelect(item.value)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-[20px] border px-4 py-3 text-left transition-colors",
                              active ? "border-foreground/20 bg-accent" : "border-border bg-card hover:bg-accent/50",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                              <p className="truncate text-xs leading-6 text-muted-foreground">{item.value}</p>
                            </div>
                            <span
                              className={cn(
                                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                                active ? "border-foreground bg-foreground text-background" : "border-border text-transparent",
                              )}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
                    没有找到匹配的节点，请换个关键词试试。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
