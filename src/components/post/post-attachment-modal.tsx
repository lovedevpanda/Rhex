"use client"

import { ChevronDown, FileArchive, Link2, Loader2, Trash2, Upload } from "lucide-react"
import { useState, type ChangeEvent } from "react"

import { AccessThresholdSelectGroup } from "@/components/access-threshold-select-group"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import type { LocalPostDraft } from "@/lib/post-draft"

function formatFileSize(fileSize: number | null) {
  if (!fileSize || fileSize <= 0) {
    return "未知大小"
  }

  if (fileSize >= 1024 * 1024 * 1024) {
    return `${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
  }

  return `${Math.max(1, Math.round(fileSize / 1024))} KB`
}

function buildAttachmentPermissionSummary(attachment: LocalPostDraft["attachments"][number], pointName: string) {
  const summary: string[] = []

  if (Number(attachment.minDownloadLevel) > 0) {
    summary.push(`Lv.${attachment.minDownloadLevel}`)
  }

  if (Number(attachment.minDownloadVipLevel) > 0) {
    summary.push(`VIP${attachment.minDownloadVipLevel}`)
  }

  if (Number(attachment.pointsCost) > 0) {
    summary.push(`${attachment.pointsCost} ${pointName}`)
  }

  if (attachment.requireReplyUnlock) {
    summary.push("回复可下")
  }

  return summary.length > 0 ? summary : ["公开下载"]
}

interface PostAttachmentModalProps {
  open: boolean
  attachments: LocalPostDraft["attachments"]
  pointName: string
  levelOptions: AccessThresholdOption[]
  vipLevelOptions: AccessThresholdOption[]
  attachmentFeature: {
    siteUploadEnabled: boolean
    canManage: boolean
    canAddNew: boolean
    minUploadLevel: number
    minUploadVipLevel: number
    allowedExtensions: string[]
    maxFileSizeMb: number
  }
  uploading: boolean
  onClose: () => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  onAddExternal: () => void
  onRemove: (index: number) => void
  onAttachmentChange: (index: number, patch: Partial<LocalPostDraft["attachments"][number]>) => void
}

export function PostAttachmentModal({
  open,
  attachments,
  pointName,
  levelOptions,
  vipLevelOptions,
  attachmentFeature,
  uploading,
  onClose,
  onUpload,
  onAddExternal,
  onRemove,
  onAttachmentChange,
}: PostAttachmentModalProps) {
  const [expandedPermissionKeys, setExpandedPermissionKeys] = useState<Set<string>>(() => new Set())
  const editingDisabled = !attachmentFeature.canManage
  const canAddExternalAttachment = attachmentFeature.canAddNew && attachments.length < 20
  const canUploadAttachment = attachmentFeature.siteUploadEnabled && canAddExternalAttachment
  const requirementParts = [
    attachmentFeature.minUploadLevel > 0 ? `Lv.${attachmentFeature.minUploadLevel}` : null,
    attachmentFeature.minUploadVipLevel > 0 ? `VIP${attachmentFeature.minUploadVipLevel}` : null,
  ].filter(Boolean)
  const requirementSummary = requirementParts.length > 0 ? `至少 ${requirementParts.join("、")}` : "当前站点规则"
  const permissionHint = !attachmentFeature.canAddNew
    ? attachments.length > 0
      ? `当前账号未达到新增附件门槛：${requirementSummary}。你仍可调整或删除已存在的附件。`
      : `当前账号未达到附件门槛：${requirementSummary}。`
    : !attachmentFeature.siteUploadEnabled
    ? "当前站内附件上传已关闭，但仍可添加网盘链接；已有附件也可以继续调整下载权限。"
    : `当前允许添加附件。支持格式：${attachmentFeature.allowedExtensions.join(", ")}，单文件不超过 ${attachmentFeature.maxFileSizeMb}MB。`

  function togglePermissionSection(key: string) {
    setExpandedPermissionKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="配置帖子附件"
      hideHeaderCloseButtonOnMobile
      description="附件会统一展示在帖子正文底部，可分别设置等级、VIP、积分购买和回复解锁条件。"
      size="xl"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-6 text-muted-foreground">{permissionHint}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>完成</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className={canUploadAttachment && !uploading ? "inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent" : "inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground"}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploading ? "上传中..." : "上传站内附件"}</span>
            <input type="file" className="hidden" disabled={!canUploadAttachment || uploading} onChange={onUpload} />
          </label>
          <Button type="button" variant="outline" onClick={onAddExternal} disabled={!canAddExternalAttachment}>
            <Link2 className="mr-2 h-4 w-4" />
            添加网盘附件
          </Button>
          <span className="text-xs text-muted-foreground">当前已添加 {attachments.length} / 20 个附件</span>
        </div>

        {attachments.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border bg-card/60 px-4 py-6 text-sm leading-6 text-muted-foreground">
            当前还没有附件。可以上传站内文件，也可以添加网盘链接和提取码。
          </div>
        ) : null}

        <div className="space-y-4">
          {attachments.map((attachment, index) => {
            const attachmentKey = attachment.id ?? `${attachment.sourceType}-${attachment.uploadId || attachment.externalUrl || index}`
            const permissionExpanded = expandedPermissionKeys.has(attachmentKey)
            const permissionSummary = buildAttachmentPermissionSummary(attachment, pointName)

            return (
            <div key={`${attachment.id ?? "new"}-${attachment.sourceType}-${index}`} className="space-y-4 rounded-[20px] border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                      {attachment.sourceType === "UPLOAD" ? <FileArchive className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                      {attachment.sourceType === "UPLOAD" ? "站内上传" : "第三方链接"}
                    </span>
                    {attachment.sourceType === "UPLOAD" ? (
                      <span className="text-xs text-muted-foreground">
                        {attachment.fileExt ? attachment.fileExt.toUpperCase() : "FILE"} · {formatFileSize(attachment.fileSize)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium">{attachment.name || `附件 ${index + 1}`}</p>
                </div>
                <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-xs" onClick={() => onRemove(index)} disabled={editingDisabled}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  删除
                </Button>
              </div>

              {attachment.sourceType === "EXTERNAL_LINK" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">显示名称</p>
                    <input
                      value={attachment.name}
                      onChange={(event) => onAttachmentChange(index, { name: event.target.value })}
                      className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
                      placeholder="可选，留空会自动从链接推断"
                      disabled={editingDisabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">提取码</p>
                    <input
                      value={attachment.externalCode}
                      onChange={(event) => onAttachmentChange(index, { externalCode: event.target.value })}
                      className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
                      placeholder="可选，如 abcd"
                      disabled={editingDisabled}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <p className="text-sm font-medium">网盘链接</p>
                    <input
                      value={attachment.externalUrl}
                      onChange={(event) => onAttachmentChange(index, { externalUrl: event.target.value })}
                      className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
                      placeholder="填写 http 或 https 网盘链接"
                      disabled={editingDisabled}
                    />
                  </div>
                </div>
              ) : null}

              <div className="rounded-[18px] border border-border bg-background">
                <button
                  type="button"
                  onClick={() => togglePermissionSection(attachmentKey)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">下载权限</p>
                    <div className="flex flex-wrap gap-2">
                      {permissionSummary.map((item) => (
                        <span key={`${attachmentKey}-${item}`} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronDown className={permissionExpanded ? "h-4 w-4 rotate-180 text-muted-foreground transition-transform" : "h-4 w-4 text-muted-foreground transition-transform"} />
                </button>

                {permissionExpanded ? (
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <div>
                      <p className="text-xs leading-6 text-muted-foreground">等级和 VIP 门槛可叠加；如果还设置了积分或回复条件，则用户需要全部满足后才能拿到下载权限。</p>
                    </div>
                    <AccessThresholdSelectGroup
                      levelValue={attachment.minDownloadLevel}
                      vipLevelValue={attachment.minDownloadVipLevel}
                      levelOptions={levelOptions}
                      vipLevelOptions={vipLevelOptions}
                      onLevelChange={(value) => onAttachmentChange(index, { minDownloadLevel: value })}
                      onVipLevelChange={(value) => onAttachmentChange(index, { minDownloadVipLevel: value })}
                      levelLabel="最低用户等级"
                      vipLevelLabel="最低 VIP 等级"
                      levelDescriptionBuilder={(option) => option?.value === "0" ? "不限制用户等级，满足其它条件即可下载。" : `至少达到 ${option?.label ?? "当前等级"} 才能下载该附件。`}
                      vipLevelDescriptionBuilder={(option) => option?.value === "0" ? "不限制 VIP 等级。" : `至少达到 ${option?.label ?? "当前 VIP"} 才能下载该附件。`}
                      disabled={editingDisabled}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">积分购买价</p>
                        <input
                          type="number"
                          min={0}
                          value={attachment.pointsCost}
                          onChange={(event) => onAttachmentChange(index, { pointsCost: event.target.value })}
                          className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-hidden"
                          placeholder={`0 表示无需支付 ${pointName}`}
                          disabled={editingDisabled}
                        />
                        <p className="text-xs leading-6 text-muted-foreground">设置为 0 表示不需要额外购买；大于 0 时，满足其它条件后还需支付 {pointName} 才能下载。</p>
                      </div>
                      <label className={attachment.requireReplyUnlock ? "flex min-h-11 cursor-pointer items-start justify-between gap-3 rounded-[20px] border border-foreground bg-accent px-4 py-3" : "flex min-h-11 cursor-pointer items-start justify-between gap-3 rounded-[20px] border border-border bg-card px-4 py-3"}>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">回复后可下载</p>
                          <p className="text-xs leading-5 text-muted-foreground">开启后，用户至少在本帖回复 1 次才能下载该附件。</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={attachment.requireReplyUnlock}
                          onChange={(event) => onAttachmentChange(index, { requireReplyUnlock: event.target.checked })}
                          className="mt-1 h-4 w-4"
                          disabled={editingDisabled}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

