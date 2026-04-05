import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"
import { userDisplayNameSelect, userIdentitySelect } from "@/db/user-selects"

export function findAdminVerificationTypes() {
  return prisma.verificationType.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: { applications: true },
      },
    },
  })
}

export function findRecentVerificationApplications(limit = 200) {
  return prisma.userVerification.findMany({
    orderBy: [{ submittedAt: "desc" }],
    take: limit,
    include: {
      type: true,
      user: {
        select: userIdentitySelect,
      },
      reviewer: {
        select: userIdentitySelect,
      },
    },
  })
}

export function createVerificationTypeRecord(data: {
  name: string
  slug: string
  description?: string
  iconText: string
  color: string
  formSchemaJson?: string
  sortOrder: number
  status: boolean
  needRemark: boolean
  userLimit: number
  allowResubmitAfterReject: boolean
}) {
  return prisma.verificationType.create({ data })
}

export function findVerificationApplicationForReview(applicationId: string) {
  return prisma.userVerification.findUnique({
    where: { id: applicationId },
    include: {
      type: true,
      user: {
        select: userDisplayNameSelect,
      },
    },
  })
}

export function updateVerificationTypeRecord(id: string, data: {
  name: string
  slug: string
  description?: string
  iconText: string
  color: string
  formSchemaJson?: string
  sortOrder: number
  status: boolean
  needRemark: boolean
  userLimit: number
  allowResubmitAfterReject: boolean
}) {
  return prisma.verificationType.update({
    where: { id },
    data,
  })
}

export function countVerificationApplicationsByType(typeId: string) {
  return prisma.userVerification.count({ where: { typeId } })
}

export function deleteVerificationTypeRecord(id: string) {
  return prisma.verificationType.delete({ where: { id } })
}

export async function runVerificationReviewTransaction(params: {
  applicationId: string
  userId: number
  adminId: number
  status: "APPROVED" | "REJECTED"
  note: string
  rejectReason: string
  afterReview?: (tx: Prisma.TransactionClient) => Promise<void>
}) {
  const reviewedAt = new Date()

  return prisma.$transaction(async (tx) => {
    if (params.status === "APPROVED") {
      await tx.userVerification.updateMany({
        where: { userId: params.userId, status: "APPROVED" },
        data: {
          status: "CANCELLED",
          note: "已有新的认证通过，旧认证已自动失效",
          reviewedAt,
          reviewerId: params.adminId,
        },
      })
    }

    const reviewedApplication = await tx.userVerification.update({
      where: { id: params.applicationId },
      data: {
        status: params.status,
        note: params.note || undefined,
        rejectReason: params.status === "REJECTED" ? params.rejectReason : null,
        reviewedAt,
        reviewerId: params.adminId,
      },
    })

    if (params.afterReview) {
      await params.afterReview(tx)
    }

    return reviewedApplication
  })
}
