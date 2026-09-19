import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { isAllowedUploadMimeType, normalizeUploadExtension, normalizeUploadFolder } from "@/lib/upload-rules"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { createUploadWithinDailyQuota, withUserUploadRateLimit } from "@/lib/user-upload-quota"
import { isUploadRequestContentLengthWithinLimit } from "@/lib/upload-limit-policy"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  return withUserUploadRateLimit({
    request,
    userId: currentUser.id,
    task: async () => {
      const settings = await getSiteSettings()
      const configuredImageMaxSizeMb = Math.max(
        settings.uploadAvatarMaxFileSizeMb,
        settings.uploadMaxFileSizeMb,
      )
      const requestMaxFileBytes = (Number.isFinite(configuredImageMaxSizeMb) && configuredImageMaxSizeMb > 0
        ? configuredImageMaxSizeMb
        : 5) * 1024 * 1024
      if (!isUploadRequestContentLengthWithinLimit(request.headers.get("content-length"), requestMaxFileBytes)) {
        apiError(413, "上传请求大小不合法或超过允许范围")
      }

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
      // SVG 是**管理员能力**，不对普通用户开放。
      //
      // 这个路由只要求登录，而 folder 由客户端表单决定、`icon` 在白名单内，
      // 原先 `folder === "icon"` 时额外放开 svg —— 于任何登录用户都能把
      // `<svg onload=...>` 传成 /uploads/icon/<hash>.svg，再由无鉴权的
      // /uploads 路由以 image/svg+xml 返回。把该链接贴进帖子，受害者一点就在
      // 站点同源下执行脚本（同源 fetch 可冒用其身份）。
      //
      // 站点图标本来就有管理员专用入口 api/admin/site-settings/icon-upload，
      // 因此这里直接不放行 svg，不需要新增权限判断。
      const allowedExtensions = Array.from(new Set(
        settings.uploadAllowedImageTypes.map((item) => item.trim().toLowerCase()).filter(Boolean),
      ))
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
        maxFileSizeBytes: maxSizeBytes,
        settings,
        request,
        actor: {
          id: currentUser.id,
          username: currentUser.username,
          kind: "user",
        },
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
        const result = await createUploadWithinDailyQuota({
          userId: currentUser.id,
          bucketType: folder,
          originalName: file.name,
          fileHash: preparedFile.fileHash,
          fileSize: preparedFile.fileSize,
          save: () => saveUploadedFile(file, preparedFile, folder, {
            request,
            actor: {
              id: currentUser.id,
              username: currentUser.username,
              kind: "user",
            },
          }),
        })

        if (result.reused) {
          return apiSuccess({ urlPath: result.upload.urlPath }, "上传成功")
        }

        const saved = result.upload
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
    },
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
