"use client"

import { useEffect, useState } from "react"

import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import { Button } from "@/components/ui/button"

interface HiddenContentModalProps {
  open: boolean
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  onClose: () => void
  price?: string
  onPriceChange?: (value: string) => void
  priceLabel?: string
}

export function HiddenContentModal({ open, title, description, value, onChange, onClose, price, onPriceChange, priceLabel }: HiddenContentModalProps) {
  const [draftValue, setDraftValue] = useState(value)
  const [draftPrice, setDraftPrice] = useState(price ?? "")

  useEffect(() => {
    if (open) {
      setDraftValue(value)
      setDraftPrice(price ?? "")
    }
  }, [open, value, price])

  if (!open) {
    return null
  }

  function handleSave() {
    onChange(draftValue)
    onPriceChange?.(draftPrice)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-4xl rounded-[28px] border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h4 className="text-lg font-semibold">{title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>关闭</Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {onPriceChange ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{priceLabel ?? "价格"}</p>
              <input value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder="输入价格" />
            </div>
          ) : null}

          <RefinedRichPostEditor
            value={draftValue}
            onChange={setDraftValue}
            placeholder="写下这部分隐藏内容，支持 Markdown、图片和表情。"
            minHeight={260}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          <Button type="button" onClick={handleSave}>保存这段隐藏内容</Button>
        </div>
      </div>
    </div>
  )
}
