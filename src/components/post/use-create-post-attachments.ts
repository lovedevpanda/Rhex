"use client"

import type { ChangeEvent } from "react"
import { useState } from "react"

import type { LocalPostDraft } from "@/lib/post-draft"
import { toast } from "@/components/ui/toast"

interface UseCreatePostAttachmentsOptions {
  draft: LocalPostDraft
  canAddAttachments: boolean
  attachmentFeature: {
    uploadEnabled: boolean
    minUploadLevel: number
    minUploadVipLevel: number
    allowedExtensions: string[]
    maxFileSizeMb: number
  }
  setDraft: React.Dispatch<React.SetStateAction<LocalPostDraft>>
  updateDraftField: <Key extends keyof LocalPostDraft>(
    field: Key,
    value: LocalPostDraft[Key],
  ) => void
}

export function useCreatePostAttachments({
  draft,
  canAddAttachments,
  attachmentFeature,
  setDraft,
  updateDraftField,
}: UseCreatePostAttachmentsOptions) {
  const [coverUploading, setCoverUploading] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)

  function addExternalAttachment() {
    if (!canAddAttachments) {
      toast.error("当前账号暂不具备添加附件的权限", "无法添加网盘附件")
      return
    }

    if (draft.attachments.length >= 20) {
      toast.info("单个帖子最多添加 20 个附件", "附件数量已满")
      return
    }

    updateDraftField("attachments", [
      ...draft.attachments,
      {
        sourceType: "EXTERNAL_LINK",
        uploadId: "",
        name: "",
        externalUrl: "",
        externalCode: "",
        fileSize: null,
        fileExt: "",
        mimeType: "",
        minDownloadLevel: "0",
        minDownloadVipLevel: "0",
        pointsCost: "0",
        requireReplyUnlock: false,
      },
    ])
  }

  function updateAttachment(
    index: number,
    patch: Partial<LocalPostDraft["attachments"][number]>,
  ) {
    updateDraftField(
      "attachments",
      draft.attachments.map((attachment, currentIndex) => {
        if (currentIndex !== index) {
          return attachment
        }

        const nextAttachment = {
          ...attachment,
          ...patch,
        }

        if (
          ("sourceType" in patch
            && patch.sourceType
            && patch.sourceType !== attachment.sourceType)
          || ("uploadId" in patch
            && patch.uploadId !== undefined
            && patch.uploadId !== attachment.uploadId)
        ) {
          nextAttachment.id = undefined
        }

        return nextAttachment
      }),
    )
  }

  function removeAttachment(index: number) {
    updateDraftField(
      "attachments",
      draft.attachments.filter((_, currentIndex) => currentIndex !== index),
    )
  }

  async function handleAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const normalizedFileExtension = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".") + 1).trim().toLowerCase()
      : ""
    const normalizedAttachmentMaxFileSizeMb = Math.max(1, attachmentFeature.maxFileSizeMb)
    const maxFileSizeBytes = normalizedAttachmentMaxFileSizeMb * 1024 * 1024
    const allowedAttachmentExtensions = attachmentFeature.allowedExtensions
      .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean)

    if (!canAddAttachments) {
      toast.error("当前账号暂不具备添加附件的权限", "附件上传失败")
      event.target.value = ""
      return
    }

    if (!attachmentFeature.uploadEnabled) {
      toast.error("当前站点已关闭站内附件上传，仍可添加网盘附件", "附件上传失败")
      event.target.value = ""
      return
    }

    if (draft.attachments.length >= 20) {
      toast.info("单个帖子最多添加 20 个附件", "附件数量已满")
      event.target.value = ""
      return
    }

    if (
      !normalizedFileExtension
      || !allowedAttachmentExtensions.includes(normalizedFileExtension)
    ) {
      toast.error(
        `仅支持上传 ${allowedAttachmentExtensions.join(" / ")} 格式的附件`,
        "附件上传失败",
      )
      event.target.value = ""
      return
    }

    if (file.size > maxFileSizeBytes) {
      toast.error(
        `附件大小不能超过 ${normalizedAttachmentMaxFileSizeMb}MB`,
        "附件上传失败",
      )
      event.target.value = ""
      return
    }

    setAttachmentUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message ?? "附件上传失败")
      }

      const uploadedAttachment = result.data?.upload as {
        id?: string
        originalName?: string
        fileSize?: number
        fileExt?: string
        mimeType?: string
      } | undefined

      if (!uploadedAttachment?.id || !uploadedAttachment.originalName) {
        throw new Error("附件上传成功，但返回数据不完整")
      }

      const uploadedDraftAttachment: LocalPostDraft["attachments"][number] = {
        sourceType: "UPLOAD",
        uploadId: uploadedAttachment.id,
        name: uploadedAttachment.originalName,
        externalUrl: "",
        externalCode: "",
        fileSize:
          typeof uploadedAttachment.fileSize === "number"
            ? uploadedAttachment.fileSize
            : null,
        fileExt: uploadedAttachment.fileExt ?? "",
        mimeType: uploadedAttachment.mimeType ?? "",
        minDownloadLevel: "0",
        minDownloadVipLevel: "0",
        pointsCost: "0",
        requireReplyUnlock: false,
      }

      setDraft((current) => ({
        ...current,
        attachments: [...current.attachments, uploadedDraftAttachment],
      }))
      toast.success("附件已上传并加入帖子草稿", "附件上传成功")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "附件上传失败",
        "附件上传失败",
      )
    } finally {
      setAttachmentUploading(false)
      event.target.value = ""
    }
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件后再上传", "封面上传失败")
      event.target.value = ""
      return
    }

    setCoverUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "post-covers")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message ?? "封面上传失败")
      }

      updateDraftField("coverPath", String(result.data?.urlPath ?? ""))
      toast.success("封面上传成功", "封面上传成功")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "封面上传失败",
        "封面上传失败",
      )
    } finally {
      setCoverUploading(false)
      event.target.value = ""
    }
  }

  return {
    coverUploading,
    attachmentUploading,
    addExternalAttachment,
    updateAttachment,
    removeAttachment,
    handleAttachmentUpload,
    handleCoverUpload,
  }
}
