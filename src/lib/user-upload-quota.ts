import "server-only"

import path from "node:path"

import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"
import { Prisma } from "@/db/types"
import { deleteStoredUploadFile, type SavedUploadFile } from "@/lib/upload"
import { withRequestWriteGuard } from "@/lib/write-guard"
import {
  assertUserUploadQuota,
  getUtcDayLockKey,
  getUtcDayRange,
  resolveUserUploadLimits,
} from "@/lib/upload-limit-policy"

const uploadSelect = {
  id: true,
  userId: true,
  bucketType: true,
  originalName: true,
  urlPath: true,
  fileName: true,
  fileExt: true,
  mimeType: true,
  fileSize: true,
  fileHash: true,
  storagePath: true,
} satisfies Prisma.UploadSelect

export function withUserUploadRateLimit<T>(input: {
  request: Request
  userId: number
  task: () => Promise<T>
}) {
  const limits = resolveUserUploadLimits()

  return withRequestWriteGuard({
    scope: "user-upload",
    request: input.request,
    userId: input.userId,
    cooldownMs: limits.minIntervalMs,
    cooldownMessage: "上传过于频繁，请稍后再试",
    // Rejected uploads should not consume the short rate-limit window.
    releaseOnError: true,
  }, input.task)
}

function canDeleteSavedUploadOnRollback(storagePath: string) {
  // Built-in local and S3 backends use absolute paths and s3:// respectively.
  // Add-on providers may return opaque remote handles (for example remote:...)
  // that this process must never treat as a local pathname.
  return storagePath.startsWith("s3://") || path.isAbsolute(storagePath)
}

async function cleanupSavedUploadAfterFailedCreate(input: {
  bucketType: string
  fileHash: string
  saved: SavedUploadFile
}) {
  if (!canDeleteSavedUploadOnRollback(input.saved.storagePath)) {
    console.error("[upload-quota] upload record creation failed after an add-on provider saved a non-reversible object", {
      storagePath: input.saved.storagePath,
    })
    return
  }

  try {
    // Reacquire the same object-key lock used by writers before deleting. This
    // closes the gap after the failed transaction releases its lock: a matching
    // upload either commits first (and is observed below) or waits for cleanup.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${input.bucketType}:${input.fileHash}`}))
      `

      const existingReference = await tx.upload.findFirst({
        where: { storagePath: input.saved.storagePath },
        select: { id: true },
      })
      if (existingReference) {
        return
      }

      await deleteStoredUploadFile(input.saved.storagePath)
    }, { timeout: 60_000 })
  } catch (cleanupError) {
    // Preserve the original request error, but make a remaining orphan visible
    // to operators. Add-on upload providers without a rollback API remain
    // intentionally untouched rather than deleting an opaque remote resource.
    console.error("[upload-quota] failed to clean up saved upload after database rollback", {
      storagePath: input.saved.storagePath,
      cleanupError,
    })
  }
}


/**
 * Reserves a user's daily upload quota and creates the Upload record in one
 * PostgreSQL transaction. A transaction-scoped advisory lock serializes all
 * upload buckets for the same user and UTC day, preventing concurrent requests
 * from both passing a read-then-write quota check.
 *
 * The storage write happens only after the quota check while that lock is held;
 * callers should therefore keep `save` limited to the actual upload operation.
 */
export async function createUploadWithinDailyQuota(input: {
  userId: number
  bucketType: string
  originalName: string
  fileHash: string
  fileSize: number
  save: () => Promise<SavedUploadFile>
}) {
  const now = new Date()
  const { start, end } = getUtcDayRange(now)
  const limits = resolveUserUploadLimits()
  let savedUpload: SavedUploadFile | null = null

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(${input.userId}, ${getUtcDayLockKey(now)})
      `

      const existing = await tx.upload.findUnique({
        where: {
          userId_bucketType_fileHash: {
            userId: input.userId,
            bucketType: input.bucketType,
            fileHash: input.fileHash,
          },
        },
        select: uploadSelect,
      })

      if (existing) {
        return { upload: existing, reused: true as const }
      }

      // The deterministic built-in storage keys are based on bucket + hash.
      // Serializing this key prevents a rollback cleanup from racing a matching
      // upload by another user, while hash collisions merely serialize work.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${input.bucketType}:${input.fileHash}`}))
      `

      const usage = await tx.upload.aggregate({
        where: {
          userId: input.userId,
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        _count: { _all: true },
        _sum: { fileSize: true },
      })

      try {
        assertUserUploadQuota({
          usage: {
            fileCount: usage._count._all,
            totalBytes: usage._sum.fileSize ?? 0,
          },
          incomingBytes: input.fileSize,
          limits,
        })
      } catch (error) {
        if (error instanceof Error && error.name === "UserUploadQuotaExceededError") {
          apiError(429, error.message)
        }
        throw error
      }

      const saved = await input.save()
      savedUpload = saved

      const upload = await tx.upload.create({
        data: {
          userId: input.userId,
          bucketType: input.bucketType,
          originalName: input.originalName,
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

      return { upload, reused: false as const }
    }, {
      // A storage operation can take longer than Prisma's small default in a
      // remote object store. The per-user advisory lock still keeps the critical
      // section bounded to a single upload at a time.
      timeout: 60_000,
    })
  } catch (error) {
    if (savedUpload) {
      await cleanupSavedUploadAfterFailedCreate({
        bucketType: input.bucketType,
        fileHash: input.fileHash,
        saved: savedUpload,
      })
    }
    throw error
  }
}
