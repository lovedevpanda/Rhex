import { prisma } from "@/db/client"

const verificationApplicationTypeSelect = {
  id: true,
  name: true,
  iconText: true,
  color: true,
  description: true,
} as const

export function listActiveVerificationTypes() {
  return prisma.verificationType.findMany({
    where: { status: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
}

export function listUserVerificationApplications(userId: number) {
  return prisma.userVerification.findMany({
    where: { userId },
    orderBy: [{ submittedAt: "desc" }],
    include: {
      type: {
        select: verificationApplicationTypeSelect,
      },
    },
  })
}

export function findApprovedUserVerification(userId: number) {
  return prisma.userVerification.findFirst({
    where: { userId, status: "APPROVED" },
    orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }],
    include: {
      type: {
        select: verificationApplicationTypeSelect,
      },
    },
  })
}

export function findVerificationTypeById(verificationTypeId: string) {
  return prisma.verificationType.findUnique({
    where: { id: verificationTypeId },
  })
}

export function findLatestUserVerificationApplication(userId: number, typeId: string) {
  return prisma.userVerification.findFirst({
    where: {
      userId,
      typeId,
    },
    orderBy: [{ submittedAt: "desc" }],
  })
}

export function createUserVerificationApplication(input: {
  userId: number
  verificationTypeId: string
  content: string
  customIconText: string | null
  customDescription: string | null
  formResponseJson: string | null
}) {
  return prisma.userVerification.create({
    data: {
      userId: input.userId,
      typeId: input.verificationTypeId,
      content: input.content,
      customIconText: input.customIconText,
      customDescription: input.customDescription,
      formResponseJson: input.formResponseJson,
      status: "PENDING",
    },
    include: {
      type: {
        select: verificationApplicationTypeSelect,
      },
    },
  })
}

export function updateUserVerificationById(id: string, data: {
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  note?: string | null
  reviewedAt?: Date | null
}) {
  return prisma.userVerification.update({
    where: { id },
    data,
  })
}
