"use client"

import Image from "next/image"
import type { ChangeEvent } from "react"
import { Loader2, Upload } from "lucide-react"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"

export function CoverConfigModal({
  open,
  coverPath,
  coverUploading,
  onClose,
  onCoverUpload,
  onCoverPathChange,
  onCoverClear,
}: {
  open: boolean
  coverPath: string
  coverUploading: boolean
  onClose: () => void
  onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  onCoverPathChange: (value: string) => void
  onCoverClear: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设置封面图"
      description="画廊模式默认提取正文第一张图片，也可以在这里手动上传或填写封面地址。"
      size="lg"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">留空时，帖子列表会自动提取正文中的第一张图片作为封面。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={!coverPath || coverUploading} onClick={onCoverClear}>清空封面</Button>
            <Button type="button" variant="outline" onClick={onClose}>完成</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className={coverUploading ? "inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground" : "inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent"}>
            {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{coverUploading ? "上传中..." : "上传封面"}</span>
            <input type="file" accept="image/*" className="hidden" disabled={coverUploading} onChange={onCoverUpload} />
          </label>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">封面地址</p>
          <input value={coverPath} onChange={(event) => onCoverPathChange(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" placeholder="留空则自动使用正文首图，也可以直接填写封面图片地址" />
        </div>
        {coverPath ? (
          <div className="relative overflow-hidden rounded-[24px] border border-border bg-card">
            <div className="relative aspect-video w-full">
              <Image src={coverPath} alt="帖子封面预览" fill sizes="(max-width: 1024px) 100vw, 896px" className="object-cover" unoptimized />
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-border bg-card/60 px-4 py-5 text-sm leading-6 text-muted-foreground">
            当前未手动设置封面图，发布后会自动提取正文中的第一张图片作为封面。
          </div>
        )}
      </div>
    </Modal>
  )
}
