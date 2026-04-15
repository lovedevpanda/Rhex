"use client"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { MAX_MANUAL_TAGS } from "@/lib/post-tags"

export function TagConfigModal({
  open,
  autoExtractedTags,
  manualTags,
  tagInput,
  tagEditingIndex,
  tagEditingValue,
  onClose,
  onTagInputChange,
  onTagInputConfirm,
  onApplyAutoTagsToManual,
  onAddManualTag,
  onClearManualTags,
  onStartEditingTag,
  onTagEditingValueChange,
  onCommitEditingTag,
  onCancelEditingTag,
  onRemoveManualTag,
}: {
  open: boolean
  autoExtractedTags: string[]
  manualTags: string[]
  tagInput: string
  tagEditingIndex: number | null
  tagEditingValue: string
  onClose: () => void
  onTagInputChange: (value: string) => void
  onTagInputConfirm: () => void
  onApplyAutoTagsToManual: () => void
  onAddManualTag: (value: string) => boolean
  onClearManualTags: () => void
  onStartEditingTag: (index: number) => void
  onTagEditingValueChange: (value: string) => void
  onCommitEditingTag: (index?: number | null) => void
  onCancelEditingTag: () => void
  onRemoveManualTag: (tag: string) => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="标签提取"
      description="自动提取仅作为候选结果，只有你手动添加后才会进入最终提交标签，并且可以继续编辑。"
      size="lg"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">左侧是候选标签，右侧和下方是最终提交标签，只有手动采用的标签才会被保存。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={manualTags.length > 0 ? onClearManualTags : onClose}>{manualTags.length > 0 ? "清空最终标签" : "关闭"}</Button>
            <Button type="button" variant="outline" onClick={onApplyAutoTagsToManual} disabled={autoExtractedTags.length === 0}>加入全部自动标签</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">自动提取</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">基于当前标题和正文自动计算。</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{autoExtractedTags.length} 个</span>
            </div>
 
            <div className="flex min-h-[84px] flex-wrap content-start items-start gap-2">
              {autoExtractedTags.length > 0 ? autoExtractedTags.map((tag) => {
                const adopted = manualTags.some((item) => item.toLowerCase() === tag.toLowerCase())

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onAddManualTag(tag)}
                    className={adopted ? "inline-flex self-start items-center rounded-full border border-foreground bg-accent px-3 py-1.5 text-sm" : "inline-flex self-start items-center rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"}
                  >
                    #{tag}
                    <span className="ml-2 text-xs text-muted-foreground">{adopted ? "已加入" : "加入"}</span>
                  </button>
                )
              }) : <p className="text-sm text-muted-foreground">暂未提取到标签，可以先补充标题或正文。</p>}
            </div>
          </div>

          <div className="space-y-3 rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">最终标签</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">支持手动新增、删除和编辑，最多 {MAX_MANUAL_TAGS} 个。</p>
              </div>
              <span className={manualTags.length > 0 ? "rounded-full bg-foreground px-3 py-1 text-xs text-background" : "rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"}>{manualTags.length} / {MAX_MANUAL_TAGS}</span>
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(event) => onTagInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    onTagInputConfirm()
                  }
                }}
                className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-hidden"
                placeholder="输入标签后回车，可用逗号批量添加"
              />
              <Button type="button" variant="outline" onClick={onTagInputConfirm}>添加</Button>
            </div>

            <div className="flex min-h-[84px] flex-wrap content-start items-start gap-2">
              {manualTags.length > 0 ? manualTags.map((tag, index) => (
                tagEditingIndex === index ? (
                  <div key={`${tag}-${index}`} className="inline-flex self-start items-center gap-2 rounded-full border border-foreground bg-accent px-3 py-1.5">
                    <span className="text-sm text-muted-foreground">#</span>
                    <input
                      value={tagEditingValue}
                      onChange={(event) => onTagEditingValueChange(event.target.value)}
                      onBlur={() => onCommitEditingTag(index)}
                      autoFocus
                      className="h-7 min-w-[96px] bg-transparent text-sm outline-hidden"
                    />
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => onCommitEditingTag(index)}>完成</Button>
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={onCancelEditingTag}>取消</Button>
                  </div>
                ) : (
                  <div key={`${tag}-${index}`} className="inline-flex self-start items-center gap-2 rounded-full border border-foreground bg-accent px-3 py-1.5 text-sm">
                    <button type="button" onClick={() => onStartEditingTag(index)} className="transition-opacity hover:opacity-80">
                      #{tag}
                    </button>
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => onRemoveManualTag(tag)}>删除</Button>
                  </div>
                )
              )) : <p className="text-sm text-muted-foreground">还没有最终标签，点左侧候选标签加入，或自行输入即可。</p>}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">最终提交标签</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">候选 {autoExtractedTags.length}</span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">最终 {manualTags.length}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap content-start items-start gap-2">
            {manualTags.length > 0 ? manualTags.map((tag) => (
              <span key={tag} className="inline-flex self-start items-center rounded-full border border-foreground bg-accent px-3 py-1.5 text-sm">#{tag}</span>
            )) : <p className="text-sm text-muted-foreground">当前还没有可提交的标签。</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}
