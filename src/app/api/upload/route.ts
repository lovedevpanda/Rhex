import path from "path"

import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { prisma } from "@/db/client"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { saveUploadedFile } from "@/lib/upload"
import { withRequestWriteGuard } from "@/lib/write-guard"


const ALLOWED_UPLOAD_FOLDERS = new Set(["avatars", "posts", "friend-links", "site-logo"])

function normalizeExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase()
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const settings = await getSiteSettings()

  if (settings.uploadRequireLogin && !currentUser) {
    apiError(401, "请先登录后再上传")
  }

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

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "upload-file",
    cooldownMs: 2_000,
    dedupeKey: `${currentUser.id}:${folder}:${file.name}:${file.size}`,
  }, async () => {
    const saved = await saveUploadedFile(file, folder)

    await prisma.upload.create({
      data: {
        userId: currentUser.id,
        bucketType: folder,
        originalName: file.name,
        fileName: saved.fileName,
        fileExt: saved.fileExt,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        storagePath: saved.storagePath,
        urlPath: saved.urlPath,
      },
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

    return apiSuccess({
      urlPath: saved.urlPath,
    }, "上传成功")

  })
}, {
  errorMessage: "上传失败",
  logPrefix: "[api/upload] unexpected error",
  unauthorizedMessage: "请先登录后再上传",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
