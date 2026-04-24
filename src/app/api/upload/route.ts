import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { isAllowedUploadMimeType, normalizeUploadExtension, normalizeUploadFolder } from "@/lib/upload-rules"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const settings = await getSiteSettings()

  const formData = await request.formData()
  const file = formData.get("file")
  const folder = normalizeUploadFolder(formData.get("folder"))

  if (!(file instanceof File)) {
    apiError(400, "缺少上传文件")
  }

  if (file.size <= 0) {
    apiError(400, "上传文件不能为空")
  }

  const extension = normalizeUploadExtension(file.name)
  const allowedExtensions = Array.from(new Set([
    ...settings.uploadAllowedImageTypes.map((item) => item.trim().toLowerCase()).filter(Boolean),
    ...(folder === "icon" ? ["svg"] : []),
  ]))
  const maxSizeMb = folder === "avatars" ? settings.uploadAvatarMaxFileSizeMb : settings.uploadMaxFileSizeMb
  const normalizedMaxSizeMb = Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 5
  const maxSizeBytes = normalizedMaxSizeMb * 1024 * 1024

  if (!extension || !allowedExtensions.includes(extension)) {
    apiError(400, `仅支持上传 ${allowedExtensions.join(" / ")} 格式的图片`)
  }

  if (file.type && !file.type.startsWith("image/")) {
    apiError(400, "仅允许上传图片文件")
  }

  if (file.size > maxSizeBytes) {
    apiError(400, `上传文件不能超过 ${maxSizeMb}MB`)
  }

  const preparedFile = await prepareUploadedFile(file, {
    folder,
    settings,
  })

  if (!isAllowedUploadMimeType(preparedFile.detectedMime, allowedExtensions)) {
    apiError(400, `仅支持上传 ${allowedExtensions.join(" / ")} 格式的图片`)
  }

  return withRequestWriteGuard(createRequestWriteGuardOptions("upload-file", {
    request,
    userId: currentUser.id,
    input: {
      folder,
      fileHash: preparedFile.fileHash,
    },
  }), async () => {
    // 同用户、同 bucket、相同内容 → 直接复用已有记录，跳过写盘和入库
    const existing = await findExistingUpload(currentUser.id, folder, preparedFile.fileHash)
    if (existing) {
      return apiSuccess({ urlPath: existing.urlPath }, "上传成功")
    }

    const saved = await saveUploadedFile(file, preparedFile, folder, {
      request,
      actor: {
        id: currentUser.id,
        username: currentUser.username,
        kind: "user",
      },
    })

    await createUploadRecord({
      userId: currentUser.id,
      bucketType: folder,
      originalName: file.name,
      saved,
    })

    logRouteWriteSuccess({
      scope: "upload-file",
      action: "upload-file",
    }, {
      userId: currentUser.id,
      targetId: saved.fileName,
      extra: {
        folder,
        urlPath: saved.urlPath,
      },
    })

    return apiSuccess({ urlPath: saved.urlPath }, "上传成功")
  })
}, {
  errorMessage: "上传失败",
  logPrefix: "[api/upload] unexpected error",
  unauthorizedMessage: "请先登录后再上传",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法上传文件",
    INACTIVE: "账号未激活，无法上传文件",
  },
})
