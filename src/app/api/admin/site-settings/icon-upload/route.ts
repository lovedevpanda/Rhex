import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"
import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { isAllowedUploadMimeType, normalizeUploadExtension } from "@/lib/upload-rules"

const ALLOWED_SITE_ICON_EXTENSIONS = ["svg", "png", "jpg", "jpeg", "gif", "webp", "avif"] as const
const ALLOWED_SITE_ICON_EXTENSION_SET = new Set<string>(ALLOWED_SITE_ICON_EXTENSIONS)

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const settings = await getSiteSettings()
  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    apiError(400, "缺少上传文件")
  }

  if (file.size <= 0) {
    apiError(400, "上传文件不能为空")
  }

  const extension = normalizeUploadExtension(file.name)
  if (!extension || !ALLOWED_SITE_ICON_EXTENSION_SET.has(extension)) {
    apiError(400, `仅支持上传 ${ALLOWED_SITE_ICON_EXTENSIONS.join(" / ")} 格式的站点图标`)
  }

  if (file.type && !file.type.startsWith("image/")) {
    apiError(400, "仅允许上传图片文件")
  }

  const maxSizeMb = Number.isFinite(settings.uploadMaxFileSizeMb) && settings.uploadMaxFileSizeMb > 0
    ? settings.uploadMaxFileSizeMb
    : 5
  const maxSizeBytes = maxSizeMb * 1024 * 1024

  if (file.size > maxSizeBytes) {
    apiError(400, `上传文件不能超过 ${maxSizeMb}MB`)
  }

  const preparedFile = await prepareUploadedFile(file, {
    folder: "icon",
    maxFileSizeBytes: maxSizeBytes,
    settings,
    request,
    actor: {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
      kind: "admin",
    },
  })

  if (!isAllowedUploadMimeType(preparedFile.detectedMime, ALLOWED_SITE_ICON_EXTENSIONS)) {
    apiError(400, `仅支持上传 ${ALLOWED_SITE_ICON_EXTENSIONS.join(" / ")} 格式的站点图标`)
  }

  const existing = await findExistingUpload(adminUser.id, "icon", preparedFile.fileHash)

  if (existing) {
    return apiSuccess({ urlPath: existing.urlPath }, "上传成功")
  }

  const saved = await saveUploadedFile(file, preparedFile, "icon", {
    request,
    actor: {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
      kind: "admin",
    },
  })

  await createUploadRecord({
    userId: adminUser.id,
    bucketType: "icon",
    originalName: file.name,
    saved,
  })

  logRouteWriteSuccess({
    scope: "admin-site-icon-upload",
    action: "upload-icon",
  }, {
    userId: adminUser.id,
    targetId: saved.fileName,
    extra: {
      urlPath: saved.urlPath,
    },
  })

  return apiSuccess({ urlPath: saved.urlPath }, "上传成功")
}, {
  errorMessage: "上传站点图标失败",
  logPrefix: "[api/admin/site-settings/icon-upload] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.siteSettings.manage",
})
