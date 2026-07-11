import { BoardApplicationStatus, Prisma, UserRole, UserStatus } from "@/db/types"

import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"

export function findPendingBoardApplicationByApplicantAndSlug(applicantId: number, slug: string) {
  return prisma.boardApplication.findFirst({
    where: {
      applicantId,
      slug,
      status: BoardApplicationStatus.PENDING,
    },
    select: { id: true },
  })
}

export function findBoardApplicationDuplicateBoard(name: string, slug: string) {
  return prisma.board.findFirst({
    where: {
      OR: [
        { name },
        { slug },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })
}

export async function createPendingBoardApplicationIfAbsent(data: {
  applicantId: number
  zoneId: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  reason: string | null
}) {
  return prisma.$transaction(async (tx) => {
    // The public write guard only deduplicates a short request window. Serialize
    // this business key as well so retried or parallel requests cannot create
    // multiple pending applications for the same applicant and slug.
    await tx.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtext('board-application-submit'),
        hashtext(${`${data.applicantId}:${data.slug}`})
      )
    `)

    const existing = await tx.boardApplication.findFirst({
      where: {
        applicantId: data.applicantId,
        slug: data.slug,
        status: BoardApplicationStatus.PENDING,
      },
      select: { id: true },
    })

    if (existing) {
      return null
    }

    return tx.boardApplication.create({
      data: {
        ...data,
        status: BoardApplicationStatus.PENDING,
      },
    })
  })
}

export function findBoardApplicationsByApplicant(applicantId: number, take = 10) {
  return prisma.boardApplication.findMany({
    where: { applicantId },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(take, 20)),
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      reason: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      zone: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      board: {
        select: {
          id: true,
          slug: true,
          name: true,
          treasuryPoints: true,
          configJson: true,
        },
      },
    },
  })
}

export function findBoardApplicationsForAdmin(take = 30) {
  return prisma.boardApplication.findMany({
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
    take: Math.max(1, Math.min(take, 100)),
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      reason: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      applicantId: true,
      zoneId: true,
      boardId: true,
      applicant: {
        select: {
          id: true,
          username: true,
          nickname: true,
          role: true,
          status: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      zone: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      board: {
        select: {
          id: true,
          name: true,
          slug: true,
          treasuryPoints: true,
          configJson: true,
        },
      },
    },
  })
}

export function countPendingBoardApplications() {
  return prisma.boardApplication.count({
    where: { status: BoardApplicationStatus.PENDING },
  })
}

export function findBoardApplicationById(id: string) {
  return prisma.boardApplication.findUnique({
    where: { id },
    select: {
      id: true,
      applicantId: true,
      zoneId: true,
      boardId: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      reason: true,
      status: true,
      reviewNote: true,
      applicant: {
        select: {
          id: true,
          username: true,
          nickname: true,
          role: true,
          status: true,
        },
      },
      zone: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })
}

export function findZoneByIdForBoardApplication(zoneId: string) {
  return prisma.zone.findUnique({
    where: { id: zoneId },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })
}

export function findBoardSortOrderMaxByZone(zoneId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.board.aggregate({
    where: { zoneId },
    _max: {
      sortOrder: true,
    },
  })
}

export async function approveBoardApplicationWithBoardCreation(params: {
  applicationId: string
  applicantId: number
  zoneId: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  reviewNote: string | null
  reviewerId: number
  afterApprove?: (tx: Prisma.TransactionClient, context: {
    applicationId: string
    boardId: string
    boardName: string
    boardSlug: string
  }) => Promise<void>
}) {
  return prisma.$transaction(async (tx) => {
    // Claim the pending application before any side effect. The conditional
    // transition is the authority for concurrent approve/reject requests.
    const claimed = await tx.boardApplication.updateMany({
      where: {
        id: params.applicationId,
        status: BoardApplicationStatus.PENDING,
      },
      data: {
        status: BoardApplicationStatus.APPROVED,
        reviewNote: params.reviewNote,
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
      },
    })

    if (claimed.count !== 1) {
      apiError(409, "该申请已被其他管理员处理")
    }

    const applicant = await tx.user.findUniqueOrThrow({
      where: { id: params.applicantId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })

    if (applicant.status !== UserStatus.ACTIVE) {
      apiError(400, "申请人账号当前不是启用状态，不能直接设为节点版主")
    }

    if (applicant.role === UserRole.ADMIN) {
      apiError(400, "管理员账号不需要通过申请来绑定节点版主")
    }

    const nextSortOrder = ((await findBoardSortOrderMaxByZone(params.zoneId, tx))._max.sortOrder ?? 0) + 1
    const board = await tx.board.create({
      data: {
        zoneId: params.zoneId,
        name: params.name,
        slug: params.slug,
        description: params.description,
        iconPath: params.icon,
        sortOrder: nextSortOrder,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })

    if (applicant.role === UserRole.USER) {
      await tx.user.update({
        where: { id: params.applicantId },
        data: {
          role: UserRole.MODERATOR,
        },
      })
    }

    await tx.moderatorBoardScope.upsert({
      where: {
        moderatorId_boardId: {
          moderatorId: params.applicantId,
          boardId: board.id,
        },
      },
      create: {
        moderatorId: params.applicantId,
        boardId: board.id,
        canEditSettings: true,
        canWithdrawTreasury: true,
      },
      update: {
        canEditSettings: true,
        canWithdrawTreasury: true,
      },
    })

    const application = await tx.boardApplication.update({
      where: { id: params.applicationId },
      data: {
        zoneId: params.zoneId,
        name: params.name,
        slug: params.slug,
        description: params.description,
        icon: params.icon,
        status: BoardApplicationStatus.APPROVED,
        reviewNote: params.reviewNote,
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        boardId: board.id,
      },
      select: {
        id: true,
        boardId: true,
      },
    })

    if (params.afterApprove) {
      await params.afterApprove(tx, {
        applicationId: application.id,
        boardId: board.id,
        boardName: board.name,
        boardSlug: board.slug,
      })
    }

    return { board, application, applicant }
  })
}

export function rejectBoardApplication(params: {
  id: string
  reviewNote: string | null
  reviewerId: number
  nextStatus?: "REJECTED" | "CANCELLED"
  client?: Prisma.TransactionClient | typeof prisma
}) {
  const client = params.client ?? prisma

  return client.boardApplication.updateMany({
    where: {
      id: params.id,
      status: BoardApplicationStatus.PENDING,
    },
    data: {
      status: params.nextStatus ?? BoardApplicationStatus.REJECTED,
      reviewNote: params.reviewNote,
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
    },
  })
}

export function updateBoardApplicationByAdmin(params: {
  id: string
  zoneId: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  reason: string | null
  reviewNote: string | null
}) {
  return prisma.boardApplication.updateMany({
    where: {
      id: params.id,
      status: BoardApplicationStatus.PENDING,
    },
    data: {
      zoneId: params.zoneId,
      name: params.name,
      slug: params.slug,
      description: params.description,
      icon: params.icon,
      reason: params.reason,
      reviewNote: params.reviewNote,
    },
  })
}
