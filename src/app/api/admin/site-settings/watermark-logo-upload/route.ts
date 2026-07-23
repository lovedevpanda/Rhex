import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"
import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { isAllowedUploadMimeType, normalizeUploadExtension } from "@/lib/upload-rules"

const WATERMARK_LOGO_FOLDER = "watermark"
const WATERMARK_LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif"] as const
const WATERMARK_LOGO_EXTENSION_SET = new Set<string>(WATERMARK_LOGO_EXTENSIONS)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

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
  if (!extension || !WATERMARK_LOGO_EXTENSION_SET.has(extension)) {
    apiError(400, `仅支持上传 ${WATERMARK_LOGO_EXTENSIONS.join(" / ")} 格式的水印图片`)
  }

  if (file.type && !file.type.startsWith("image/")) {
    apiError(400, "仅允许上传图片文件")
  }

  const maxSizeMb = Number.isFinite(settings.uploadMaxFileSizeMb) && settings.uploadMaxFileSizeMb > 0
    ? Math.min(settings.uploadMaxFileSizeMb, 3)
    : 3
  const maxSizeBytes = maxSizeMb * 1024 * 1024

  if (file.size > maxSizeBytes) {
    apiError(400, `水印图片不能超过 ${maxSizeMb}MB`)
  }

  const preparedFile = await prepareUploadedFile(file, {
    folder: WATERMARK_LOGO_FOLDER,
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

  if (!isAllowedUploadMimeType(preparedFile.detectedMime, WATERMARK_LOGO_EXTENSIONS)) {
    apiError(400, `仅支持上传 ${WATERMARK_LOGO_EXTENSIONS.join(" / ")} 格式的水印图片`)
  }

  const existing = await findExistingUpload(adminUser.id, WATERMARK_LOGO_FOLDER, preparedFile.fileHash)

  if (existing) {
    return apiSuccess({ urlPath: existing.urlPath }, "上传成功")
  }

  const saved = await saveUploadedFile(file, preparedFile, WATERMARK_LOGO_FOLDER, {
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
    bucketType: WATERMARK_LOGO_FOLDER,
    originalName: file.name,
    saved,
  })

  logRouteWriteSuccess({
    scope: "admin-watermark-logo-upload",
    action: "upload-watermark-logo",
  }, {
    userId: adminUser.id,
    targetId: saved.fileName,
    extra: {
      urlPath: saved.urlPath,
    },
  })

  return apiSuccess({ urlPath: saved.urlPath }, "上传成功")
}, {
  errorMessage: "上传水印图片失败",
  logPrefix: "[api/admin/site-settings/watermark-logo-upload] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.operations.manage",
})
