import { Prisma } from "@/db/types"
import { prisma } from "@/db/client"
import type { SavedUploadFile } from "@/lib/upload"

const uploadSelect = {
  id: true,
  urlPath: true,
  fileName: true,
  fileHash: true,
} satisfies Prisma.UploadSelect

/**
 * 在同一用户、同一 bucket、相同内容哈希下查找已有上传记录。
 * 用于文件去重，避免重复写盘和重复入库。
 */
export async function findExistingUpload(userId: number, bucketType: string, fileHash: string) {
  return prisma.upload.findUnique({
    where: {
      userId_bucketType_fileHash: { userId, bucketType, fileHash },
    },
    select: uploadSelect,
  })
}

export interface CreateUploadInput {
  userId: number
  bucketType: string
  originalName: string
  saved: SavedUploadFile
}

/**
 * 创建上传记录（含 fileHash）。
 * fileHash 已在 SavedUploadFile 中携带，由 saveUploadedFile 负责填充。
 */
export async function createUploadRecord(input: CreateUploadInput) {
  const { userId, bucketType, originalName, saved } = input
  return prisma.upload.create({
    data: {
      userId,
      bucketType,
      originalName,
      fileName: saved.fileName,
      fileExt: saved.fileExt,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      fileHash: saved.fileHash,
      storagePath: saved.storagePath,
      urlPath: saved.urlPath,
    },
    select: uploadSelect,
  })
}
