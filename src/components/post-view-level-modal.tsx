"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal, DialogPositioner } from "@/components/ui/dialog"

interface PostViewLevelModalProps {
  open: boolean
  value: {
    minViewLevel: string
    minViewVipLevel: string
  }
  onChange: (value: { minViewLevel: string; minViewVipLevel: string }) => void
  onClose: () => void
}

export function PostViewLevelModal({ open, value, onChange, onClose }: PostViewLevelModalProps) {
  return (
    <DialogPortal open={open} onClose={onClose}>
      <div className="fixed inset-0 z-[120]">
        <DialogBackdrop onClick={onClose} />
        <DialogPositioner>
          {open ? <PostViewLevelModalBody initialValue={value} onChange={onChange} onClose={onClose} /> : null}
        </DialogPositioner>
      </div>
    </DialogPortal>
  )
}

function PostViewLevelModalBody({ initialValue, onChange, onClose }: {
  initialValue: { minViewLevel: string; minViewVipLevel: string }
  onChange: (value: { minViewLevel: string; minViewVipLevel: string }) => void
  onClose: () => void
}) {
  const [draftLevelValue, setDraftLevelValue] = useState(initialValue.minViewLevel)
  const [draftVipLevelValue, setDraftVipLevelValue] = useState(initialValue.minViewVipLevel)

  function handleSave() {
    onChange({
      minViewLevel: draftLevelValue,
      minViewVipLevel: draftVipLevelValue,
    })
    onClose()
  }

  return (
    <DialogPanel className="max-w-lg">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h4 className="text-lg font-semibold">设置帖子浏览门槛</h4>
          <p className="mt-1 text-sm text-muted-foreground">等级和 VIP 任一设置为大于 0 时，只有满足全部门槛的用户才可查看帖子正文。</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>关闭</Button>
      </div>

      <div className="space-y-4 px-6 py-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">最低浏览等级</p>
          <input
            value={draftLevelValue}
            onChange={(event) => setDraftLevelValue(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
            placeholder="输入等级，0 表示公开可见"
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">最低 VIP 浏览等级</p>
          <input
            value={draftVipLevelValue}
            onChange={(event) => setDraftVipLevelValue(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none"
            placeholder="输入 VIP 等级，0 表示不限制"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
        <Button type="button" onClick={handleSave}>保存访问门槛</Button>
      </div>
    </DialogPanel>
  )
}
