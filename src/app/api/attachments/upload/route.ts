import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { findExistingUpload, createUploadRecord } from "@/db/upload-queries"
import { resolvePostAttachmentUploadPermission } from "@/lib/post-attachments"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { prepareBinaryUploadedFile, saveUploadedFile } from "@/lib/upload"
import { getSiteSettings } from "@/lib/site-settings"
import { normalizeUploadExtension } from "@/lib/upload-rules"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const settings = await getSiteSettings()
  const formData = await request.formData()
  const file = formData.get("file")
  const uploadPermission = resolvePostAttachmentUploadPermission({
    settings,
    user: currentUser,
  })

  if (!settings.attachmentUploadEnabled && !uploadPermission.canBypassPermission) {
    apiError(403, "当前站点未开启附件上传功能")
  }

  if (!uploadPermission.canAddAttachments) {
    const requirementParts = [
      settings.attachmentMinUploadLevel > 0 ? `Lv.${settings.attachmentMinUploadLevel}` : null,
      settings.attachmentMinUploadVipLevel > 0 ? `VIP${settings.attachmentMinUploadVipLevel}` : null,
    ].filter(Boolean)
    apiError(403, requirementParts.length > 0 ? `当前账号至少需要达到 ${requirementParts.join("、")} 才能上传帖子附件` : "当前账号暂不具备上传帖子附件的权限")
  }

  if (!(file instanceof File)) {
    apiError(400, "缺少上传文件")
  }

  if (file.size <= 0) {
    apiError(400, "上传文件不能为空")
  }

  const extension = normalizeUploadExtension(file.name)
  const allowedExtensions = settings.attachmentAllowedExtensions.map((item) => item.trim().toLowerCase()).filter(Boolean)
  const maxSizeBytes = Math.max(1, settings.attachmentMaxFileSizeMb) * 1024 * 1024

  if (!extension || !allowedExtensions.includes(extension)) {
    apiError(400, `仅支持上传 ${allowedExtensions.join(" / ")} 格式的附件`)
  }

  if (file.size > maxSizeBytes) {
    apiError(400, `附件大小不能超过 ${settings.attachmentMaxFileSizeMb}MB`)
  }

  const preparedFile = await prepareBinaryUploadedFile(file)

  const requestUrl = new URL(request.url)
  const hookCtx = { request, pathname: requestUrl.pathname, searchParams: requestUrl.searchParams }
  await executeAddonActionHook("upload.file.before", {
    uploaderId: currentUser.id,
    filename: file.name,
    mime: file.type,
    size: file.size,
  }, hookCtx)

  return withRequestWriteGuard(createRequestWriteGuardOptions("attachments-upload", {
    request,
    userId: currentUser.id,
    input: {
      fileHash: preparedFile.fileHash,
    },
  }), async () => {
    const existing = await findExistingUpload(currentUser.id, "attachments", preparedFile.fileHash)
    if (existing) {
      return apiSuccess({
        upload: {
          id: existing.id,
          originalName: existing.originalName,
          fileSize: existing.fileSize,
          fileExt: existing.fileExt,
          mimeType: existing.mimeType,
        },
      }, "附件上传成功")
    }

    const saved = await saveUploadedFile(file, preparedFile, "attachments", {
      request,
      actor: {
        id: currentUser.id,
        username: currentUser.username,
        kind: "user",
      },
    })
    const upload = await createUploadRecord({
      userId: currentUser.id,
      bucketType: "attachments",
      originalName: file.name,
      saved,
    })

    logRouteWriteSuccess({
      scope: "upload-post-attachment",
      action: "upload-post-attachment",
    }, {
      userId: currentUser.id,
      targetId: upload.id,
      extra: {
        originalName: upload.originalName,
        fileSize: upload.fileSize,
        fileExt: upload.fileExt,
      },
    })

    await executeAddonActionHook("upload.file.after", {
      uploaderId: currentUser.id,
      fileId: upload.id,
      filename: upload.originalName,
      mime: upload.mimeType,
      size: upload.fileSize,
    }, hookCtx)

    return apiSuccess({
      upload: {
        id: upload.id,
        originalName: upload.originalName,
        fileSize: upload.fileSize,
        fileExt: upload.fileExt,
        mimeType: upload.mimeType,
      },
    }, "附件上传成功")
  })
}, {
  errorMessage: "附件上传失败",
  logPrefix: "[api/attachments/upload] unexpected error",
  unauthorizedMessage: "请先登录后再上传附件",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法上传附件",
    INACTIVE: "账号未激活，无法上传附件",
  },
})
