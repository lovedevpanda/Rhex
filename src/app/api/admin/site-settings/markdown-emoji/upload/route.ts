import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"
import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { isAllowedUploadMimeType, normalizeUploadExtension } from "@/lib/upload-rules"
import { normalizeMarkdownEmojiGroup, type MarkdownEmojiItem } from "@/lib/markdown-emoji"
import {
  buildMarkdownEmojiUploadItem,
  MARKDOWN_EMOJI_UPLOAD_FOLDER,
  MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSIONS,
  MARKDOWN_EMOJI_UPLOAD_MAX_FILES,
} from "@/lib/markdown-emoji-batch-upload.shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSION_SET = new Set<string>(MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSIONS)

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const settings = await getSiteSettings()
  const formData = await request.formData()
  const files = formData.getAll("files").filter((file): file is File => file instanceof File)
  const group = normalizeMarkdownEmojiGroup(formData.get("group"))

  if (files.length === 0) {
    apiError(400, "请选择要上传的表情文件")
  }

  if (files.length > MARKDOWN_EMOJI_UPLOAD_MAX_FILES) {
    apiError(400, `单次最多上传 ${MARKDOWN_EMOJI_UPLOAD_MAX_FILES} 个表情`)
  }

  const maxSizeMb = Number.isFinite(settings.uploadMaxFileSizeMb) && settings.uploadMaxFileSizeMb > 0
    ? settings.uploadMaxFileSizeMb
    : 5
  const maxSizeBytes = maxSizeMb * 1024 * 1024
  const usedShortcodes = new Set<string>()
  const items: MarkdownEmojiItem[] = []

  for (const file of files) {
    if (file.size <= 0) {
      apiError(400, `表情文件 ${file.name || "未命名文件"} 不能为空`)
    }

    const extension = normalizeUploadExtension(file.name)
    if (!extension || !MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSION_SET.has(extension)) {
      apiError(400, `仅支持上传 ${MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSIONS.join(" / ")} 格式的表情`)
    }

    if (file.type && !file.type.startsWith("image/")) {
      apiError(400, `表情文件 ${file.name} 不是图片文件`)
    }

    if (file.size > maxSizeBytes) {
      apiError(400, `单个表情文件不能超过 ${maxSizeMb}MB`)
    }

    const preparedFile = await prepareUploadedFile(file, {
      folder: MARKDOWN_EMOJI_UPLOAD_FOLDER,
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

    if (!isAllowedUploadMimeType(preparedFile.detectedMime, MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSIONS)) {
      apiError(400, `仅支持上传 ${MARKDOWN_EMOJI_UPLOAD_IMAGE_EXTENSIONS.join(" / ")} 格式的表情`)
    }

    const existing = await findExistingUpload(adminUser.id, MARKDOWN_EMOJI_UPLOAD_FOLDER, preparedFile.fileHash)
    const upload = existing ?? await createUploadRecord({
      userId: adminUser.id,
      bucketType: MARKDOWN_EMOJI_UPLOAD_FOLDER,
      originalName: file.name,
      saved: await saveUploadedFile(file, preparedFile, MARKDOWN_EMOJI_UPLOAD_FOLDER, {
        request,
        actor: {
          id: adminUser.id,
          username: adminUser.username,
          role: adminUser.role,
          kind: "admin",
        },
      }),
    })

    items.push(buildMarkdownEmojiUploadItem(file.name, upload.urlPath, usedShortcodes, items.length, group))

    logRouteWriteSuccess({
      scope: "admin-markdown-emoji-upload",
      action: "upload-markdown-emoji",
    }, {
      userId: adminUser.id,
      targetId: upload.id,
      extra: {
        originalName: upload.originalName,
        urlPath: upload.urlPath,
      },
    })
  }

  return apiSuccess({ items }, `已上传 ${items.length} 个表情`)
}, {
  errorMessage: "上传 Markdown 表情失败",
  logPrefix: "[api/admin/site-settings/markdown-emoji/upload:POST] unexpected error",
  unauthorizedMessage: "无权操作",
  permission: "admin.siteSettings.manage",
})
