"use client"

import { useState } from "react"

import { AddonEditor } from "@/components/addon-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"

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
  return (
    <HiddenContentModalBody
      key={open ? "open" : "closed"}
      open={open}
      title={title}
      description={description}
      initialValue={value}
      initialPrice={price}
      onChange={onChange}
      onPriceChange={onPriceChange}
      onClose={onClose}
      priceLabel={priceLabel}
    />
  )
}

function HiddenContentModalBody({ open, title, description, initialValue, initialPrice, onChange, onClose, onPriceChange, priceLabel }: {
  open: boolean
  title: string
  description: string
  initialValue: string
  initialPrice?: string
  onChange: (value: string) => void
  onClose: () => void
  onPriceChange?: (value: string) => void
  priceLabel?: string
}) {
  const [draftValue, setDraftValue] = useState(initialValue)
  const [draftPrice, setDraftPrice] = useState(initialPrice ?? "")

  function handleSave() {
    onChange(draftValue)
    onPriceChange?.(draftPrice)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      description={description}
      footer={(
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          <Button type="button" onClick={handleSave}>保存这段隐藏内容</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {onPriceChange ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{priceLabel ?? "价格"}</p>
            <Input value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} className="h-11 rounded-full bg-card px-4 text-sm" placeholder="输入价格" />
          </div>
        ) : null}

        <AddonEditor
          context="post"
          value={draftValue}
          onChange={setDraftValue}
          placeholder="写下这部分隐藏内容，支持 Markdown、图片和表情。"
          minHeight={260}
        />
      </div>
    </Modal>
  )
}

