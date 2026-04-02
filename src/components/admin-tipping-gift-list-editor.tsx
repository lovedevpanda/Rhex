"use client"

import { Plus, Trash2 } from "lucide-react"

import { AdminIconPickerField } from "@/components/admin-icon-picker-field"
import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"
import type { SiteTippingGiftItem } from "@/lib/site-settings"

interface AdminTippingGiftListEditorProps {
  items: SiteTippingGiftItem[]
  onChange: (items: SiteTippingGiftItem[]) => void
}

function createDraftGift(nextIndex: number): SiteTippingGiftItem {
  const draftId = `gift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const defaultIcons = ["🌹", "☕", "🍰", "🎁", "🚀", "👑", "💎", "🔥"]

  return {
    id: draftId,
    name: `礼物 ${nextIndex}`,
    icon: defaultIcons[(nextIndex - 1) % defaultIcons.length] ?? "🎁",
    price: 10,
  }
}

export function AdminTippingGiftListEditor({ items, onChange }: AdminTippingGiftListEditorProps) {
  function updateItem(id: string, key: "name" | "icon" | "price", value: string) {
    onChange(items.map((item) => {
      if (item.id !== id) {
        return item
      }

      if (key === "price") {
        return {
          ...item,
          price: Number(value) || 0,
        }
      }

      return {
        ...item,
        [key]: value,
      }
    }))
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id))
  }

  function addItem() {
    onChange([...items, createDraftGift(items.length + 1)])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">送礼配置</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">可自定义礼物名称、图标与价格。前台打赏弹层会直接按这里的礼物列表展示。</p>
        </div>
        <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={addItem}>
          <Plus className="mr-1 h-4 w-4" />
          添加礼物
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          暂无礼物，添加后前台才可送礼。
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-[20px] border border-border bg-card/70 p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_140px_auto]">
                <div className="space-y-2">
                  <AdminIconPickerField
                    label="礼物图标"
                    value={item.icon}
                    onChange={(value) => updateItem(item.id, "icon", value)}
                    popoverTitle="选择礼物图标"
                    containerClassName="space-y-2"
                    triggerClassName="flex h-11 w-full items-center gap-3 rounded-[16px] border border-border bg-background px-3 text-left text-sm transition-colors hover:bg-accent"
                    textareaRows={5}
                    description="支持 emoji、符号，或粘贴完整 SVG。前台送礼区会复用这里的图标。"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">礼物名称</p>
                  <input
                    value={item.name}
                    onChange={(event) => updateItem(item.id, "name", event.target.value)}
                    className="h-11 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none"
                    placeholder={`礼物 ${index + 1}`}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">礼物价格</p>
                  <input
                    value={String(item.price)}
                    onChange={(event) => updateItem(item.id, "price", event.target.value)}
                    className="h-11 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none"
                    inputMode="numeric"
                    placeholder="如 10"
                  />
                </div>
                <div className="flex items-end">
                  <div className="mr-2 inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-border bg-background text-foreground/80">
                    <LevelIcon icon={item.icon} className="h-5 w-5 text-base" emojiClassName="text-inherit" svgClassName="[&>svg]:block" title={item.name || "礼物图标预览"} />
                  </div>
                  <Button type="button" variant="ghost" className="h-11 rounded-[16px] px-3 text-rose-600 hover:text-rose-600" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
