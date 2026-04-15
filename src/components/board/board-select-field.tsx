"use client"

import { Check, ChevronDown, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
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
        <div className="space-y-4">
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

          <div className="min-h-0 max-h-[min(65dvh,36rem)] space-y-4 overflow-y-auto pr-1">
            {filteredGroups.length > 0 ? filteredGroups.map((group) => (
              <section key={group.zone} className="space-y-2">
                <div className="sticky top-0 z-10 bg-background/95 py-1 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur-sm">
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
      </Modal>
    </>
  )
}

