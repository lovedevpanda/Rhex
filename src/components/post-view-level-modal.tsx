"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

interface PostViewLevelModalProps {
  open: boolean
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

export function PostViewLevelModal({ open, value, onChange, onClose }: PostViewLevelModalProps) {
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    if (open) {
      setDraftValue(value)
    }
  }, [open, value])

  if (!open) {
    return null
  }

  function handleSave() {
    onChange(draftValue)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-lg rounded-[28px] border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h4 className="text-lg font-semibold">设置帖子最低浏览等级</h4>
            <p className="mt-1 text-sm text-muted-foreground">设置为 0 表示公开浏览；设置更高等级后，仅满足门槛的用户可查看帖子正文。</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>关闭</Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">最低浏览等级</p>
            <input
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
              placeholder="输入等级，0 表示公开可见"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          <Button type="button" onClick={handleSave}>保存浏览门槛</Button>
        </div>
      </div>
    </div>
  )
}
