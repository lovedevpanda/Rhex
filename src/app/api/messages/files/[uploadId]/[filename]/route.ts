import { prisma } from "@/db/client"
import { findUploadById } from "@/db/upload-queries"
import { apiError, createUserRouteHandler } from "@/lib/api-route"
import { buildMessageFileProxyUrl, MESSAGE_FILE_UPLOAD_FOLDER, normalizeMessageFileRouteSegment } from "@/lib/message-media"
import { assertMessageFeatureEnabled } from "@/lib/messages"
import { createDownloadResponseFromStoredUpload } from "@/lib/upload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

interface MessageFileRouteProps {
  params: Promise<{
    uploadId: string
    filename: string
  }>
}

export function canAccessMessageFile(input: {
  requesterId: number
  uploadOwnerId: number
  isSharedWithRequester: boolean
}) {
  return input.requesterId === input.uploadOwnerId || input.isSharedWithRequester
}

export function isCanonicalMessageFileRouteSegment(routeSegment: string, originalName: string) {
  const expected = normalizeMessageFileRouteSegment(originalName)
  if (routeSegment === expected) {
    return true
  }

  try {
    return decodeURIComponent(routeSegment) === expected
  } catch {
    return false
  }
}

async function readMessageFileResponse(uploadId: string, filename: string, requesterId: number) {
  const upload = await findUploadById(uploadId)
  if (!upload || upload.bucketType !== MESSAGE_FILE_UPLOAD_FOLDER) {
    apiError(404, "文件不存在")
  }

  if (!isCanonicalMessageFileRouteSegment(filename, upload.originalName)) {
    apiError(404, "文件不存在")
  }

  const proxyUrl = buildMessageFileProxyUrl(upload.id, upload.originalName)
  const sharedMessage = upload.userId === requesterId
    ? null
    : await prisma.directMessage.findFirst({
      where: {
        senderId: upload.userId,
        body: { contains: proxyUrl },
        conversation: {
          participants: {
            some: { userId: requesterId, archivedAt: null },
          },
        },
      },
      select: { id: true },
    })

  if (!canAccessMessageFile({
    requesterId,
    uploadOwnerId: upload.userId,
    isSharedWithRequester: Boolean(sharedMessage),
  })) {
    // Use 404 rather than 403 so upload IDs cannot be probed by other users.
    apiError(404, "文件不存在")
  }

  return createDownloadResponseFromStoredUpload({
    storagePath: upload.storagePath,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    fileName: upload.originalName,
  })
}

export const GET = createUserRouteHandler(async ({ routeContext, currentUser }) => {
  await assertMessageFeatureEnabled()

  const params = await (routeContext as MessageFileRouteProps | undefined)?.params
  const uploadId = params?.uploadId?.trim() ?? ""
  const filename = params?.filename?.trim() ?? ""

  if (!uploadId || !filename) {
    apiError(404, "文件不存在")
  }

  return readMessageFileResponse(uploadId, filename, currentUser.id)
}, {
  errorMessage: "私信文件下载失败",
  logPrefix: "[api/messages/files] unexpected error",
  unauthorizedMessage: "请先登录后下载私信文件",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法下载私信文件",
    INACTIVE: "账号未激活，无法下载私信文件",
  },
})
