import path from "path"
import { lookup } from "dns/promises"
import { isIP } from "net"

import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { createUploadRecord, findExistingUpload } from "@/db/upload-queries"
import { getSiteSettings } from "@/lib/site-settings"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { normalizeMarkdownMediaUrl } from "@/lib/markdown/media"
import { prepareUploadedFile, saveUploadedFile } from "@/lib/upload"
import { isAllowedUploadMimeType, normalizeUploadFolder } from "@/lib/upload-rules"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { safeOutboundFetch } from "@/lib/safe-outbound-http"

const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 12_000
const REMOTE_IMAGE_MAX_REDIRECTS = 5

export const runtime = "nodejs"

type RemoteImageUploadBody = {
  url?: unknown
  folder?: unknown
  fileName?: unknown
}

function sanitizeRemoteImageFileName(value: unknown, url: URL) {
  const explicitName = typeof value === "string" ? value.trim() : ""
  const urlName = path.posix.basename(url.pathname).trim()
  const fallbackName = explicitName || urlName || "remote-image"

  return fallbackName
    .replace(/[/\\\r\n\t]+/g, "_")
    .replace(/[^\w .()-]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    || "remote-image"
}

function isPrivateOrLocalIpAddress(address: string): boolean {
  const normalized = address.toLowerCase()

  if (isIP(normalized) === 4) {
    const parts = normalized.split(".").map((item) => Number.parseInt(item, 10))
    const [first = 0, second = 0] = parts

    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
  }

  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fe80:")) {
      return true
    }

    const firstGroup = Number.parseInt(normalized.split(":")[0] ?? "", 16)
    if (Number.isFinite(firstGroup) && (firstGroup & 0xfe00) === 0xfc00) {
      return true
    }

    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
    return mappedIpv4 ? isPrivateOrLocalIpAddress(mappedIpv4) : false
  }

  return true
}

async function assertPublicRemoteImageUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    apiError(400, "远程图片仅支持 http 或 https 地址")
  }

  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    apiError(400, "不支持本机或内网图片地址")
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => {
        apiError(400, "远程图片地址无法解析")
      })

  if (addresses.some((item) => isPrivateOrLocalIpAddress(item.address))) {
    apiError(400, "不支持本机或内网图片地址")
  }
}

async function fetchRemoteImage(url: URL, maxSizeBytes: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_IMAGE_FETCH_TIMEOUT_MS)
  let currentUrl = url

  try {
    for (let redirectCount = 0; redirectCount <= REMOTE_IMAGE_MAX_REDIRECTS; redirectCount += 1) {
      await assertPublicRemoteImageUrl(currentUrl)

      const response = await safeOutboundFetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.8",
          "User-Agent": "Rhex image localizer",
        },
      })

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location")
        if (!location) {
          apiError(400, "远程图片跳转地址无效")
        }

        currentUrl = new URL(location, currentUrl)
        continue
      }

      if (!response.ok) {
        apiError(400, `远程图片下载失败：HTTP ${response.status}`)
      }

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? ""
      if (contentType && !contentType.startsWith("image/")) {
        apiError(400, "远程地址返回的不是图片文件")
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0)
      if (contentLength > maxSizeBytes) {
        apiError(400, "远程图片大小超过站点上传限制")
      }

      const chunks: Uint8Array[] = []
      let receivedBytes = 0
      const reader = response.body?.getReader()

      if (!reader) {
        apiError(400, "远程图片响应内容为空")
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        receivedBytes += value.byteLength
        if (receivedBytes > maxSizeBytes) {
          apiError(400, "远程图片大小超过站点上传限制")
        }

        chunks.push(value)
      }

      return {
        buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
        contentType,
      }
    }

    apiError(400, "远程图片跳转次数过多")
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      apiError(408, "远程图片下载超时")
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody<RemoteImageUploadBody>(request)
  const url = normalizeMarkdownMediaUrl(typeof body.url === "string" ? body.url : "")

  if (!url) {
    apiError(400, "请输入有效的远程图片地址")
  }

  const folder = normalizeUploadFolder(body.folder)
  const settings = await getSiteSettings()
  const allowedExtensions = Array.from(new Set([
    ...settings.uploadAllowedImageTypes.map((item) => item.trim().toLowerCase()).filter(Boolean),
    ...(folder === "icon" ? ["svg"] : []),
  ]))
  const maxSizeMb = folder === "avatars" ? settings.uploadAvatarMaxFileSizeMb : settings.uploadMaxFileSizeMb
  const normalizedMaxSizeMb = Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 5
  const maxSizeBytes = normalizedMaxSizeMb * 1024 * 1024
  const remoteImage = await fetchRemoteImage(url, maxSizeBytes)
  const fileName = sanitizeRemoteImageFileName(body.fileName, url)
  const file = new File([remoteImage.buffer], fileName, {
    type: remoteImage.contentType || "application/octet-stream",
  })
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
      action: "upload-remote-image",
    }, {
      userId: currentUser.id,
      targetId: saved.fileName,
      extra: {
        folder,
        sourceUrl: url.toString(),
        urlPath: saved.urlPath,
      },
    })

    return apiSuccess({ urlPath: saved.urlPath }, "上传成功")
  })
}, {
  errorMessage: "远程图片本地化失败",
  logPrefix: "[api/upload/remote-image] unexpected error",
  unauthorizedMessage: "请先登录后再上传",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法上传文件",
    INACTIVE: "账号未激活，无法上传文件",
  },
})
