import { findUploadById } from "@/db/upload-queries"
import { apiError, createUserRouteHandler } from "@/lib/api-route"
import { MESSAGE_FILE_UPLOAD_FOLDER } from "@/lib/message-media"
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

async function readMessageFileResponse(uploadId: string) {
  const upload = await findUploadById(uploadId)
  if (!upload || upload.bucketType !== MESSAGE_FILE_UPLOAD_FOLDER) {
    apiError(404, "文件不存在")
  }

  return createDownloadResponseFromStoredUpload({
    storagePath: upload.storagePath,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    fileName: upload.originalName,
  })
}

export const GET = createUserRouteHandler(async ({ routeContext }) => {
  const params = await (routeContext as MessageFileRouteProps | undefined)?.params
  const uploadId = params?.uploadId?.trim() ?? ""
  const filename = params?.filename?.trim() ?? ""

  if (!uploadId || !filename) {
    apiError(404, "文件不存在")
  }

  return readMessageFileResponse(uploadId)
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
