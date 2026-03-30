import path from "path"

import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { computeFileHash, saveUploadedFile } from "@/lib/upload"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"

const ALLOWED_UPLOAD_FOLDERS = new Set(["avatars", "posts", "comments", "friend-links", "site-logo"])

function normalizeExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase()
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const settings = await getSiteSettings()

  const formData = await request.formData()
  const file = formData.get("file")
  const rawFolder = String(formData.get("folder") ?? "avatars").trim().toLowerCase()
  const folder = ALLOWED_UPLOAD_FOLDERS.has(rawFolder) ? rawFolder : "avatars"

  if (!(file instanceof File)) {
    apiError(400, "缺少上传文件")
  }

  if (file.size <= 0) {
    apiError(400, "上传文件不能为空")
  }

  const extension = normalizeExtension(file.name)
  const allowedExtensions = settings.uploadAllowedImageTypes.map((item) => item.trim().toLowerCase()).filter(Boolean)
  const maxSizeMb = folder === "avatars" ? settings.uploadAvatarMaxFileSizeMb : settings.uploadMaxFileSizeMb
  const normalizedMaxSizeMb = Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 5
  const maxSizeBytes = normalizedMaxSizeMb * 1024 * 1024

  if (!extension || extension === "svg" || !allowedExtensions.includes(extension)) {
    apiError(400, `仅支持上传 ${allowedExtensions.join(" / ")} 格式的图片`)
  }

  if (!file.type.startsWith("image/")) {
    apiError(400, "仅允许上传图片文件")
  }

  if (file.size > maxSizeBytes) {
    apiError(400, `上传文件不能超过 ${maxSizeMb}MB`)
  }

  const fileHash = await computeFileHash(file)

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "upload-file",
  }, async () => {
    // 同用户、同 bucket、相同内容 → 直接复用已有记录，跳过写盘和入库
    const existing = await findExistingUpload(currentUser.id, folder, fileHash)
    if (existing) {
      return apiSuccess({ urlPath: existing.urlPath }, "上传成功")
    }

    const saved = await saveUploadedFile(file, folder, fileHash)

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
