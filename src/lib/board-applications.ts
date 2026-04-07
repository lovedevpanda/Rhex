import { BoardApplicationStatus, UserRole, UserStatus } from "@/db/types"
import { prisma } from "@/db/client"

import {
  approveBoardApplicationWithBoardCreation,
  countPendingBoardApplications,
  createBoardApplication,
  findBoardApplicationById,
  findBoardApplicationDuplicateBoard,
  findBoardApplicationsByApplicant,
  findBoardApplicationsForAdmin,
  findPendingBoardApplicationByApplicantAndSlug,
  findZoneByIdForBoardApplication,
  rejectBoardApplication,
  updateBoardApplicationByAdmin,
} from "@/db/board-application-queries"
import { decrementBoardTreasuryPointsIfEnough } from "@/db/board-treasury-queries"
import { apiError } from "@/lib/api-route"
import type { SessionActor } from "@/lib/auth"
import { canWithdrawBoardTreasury, ensureCanManageBoard, resolveAdminActorFromSessionUser } from "@/lib/moderator-permissions"
import { createSystemNotification } from "@/lib/notification-writes"
import { applyPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { resolveBoardSettings } from "@/lib/board-settings"
import { normalizeTrimmedText } from "@/lib/shared/normalizers"
import { getSiteSettings } from "@/lib/site-settings"

export interface BoardApplicationSubmitInput {
  applicantId: number
  zoneId: string
  name: string
  slug: string
  description?: string
  icon?: string
  reason?: string
}

function normalizeBoardApplicationSlug(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)

  return normalized
}

function ensureBoardApplicationPayload(input: {
  zoneId: string
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  reason?: string | null
}) {
  const zoneId = normalizeTrimmedText(input.zoneId, 100)
  const name = normalizeTrimmedText(input.name, 40)
  const slug = normalizeBoardApplicationSlug(input.slug || input.name)
  const description = normalizeTrimmedText(input.description, 3000) || null
  const icon = normalizeTrimmedText(input.icon, 100) || null
  const reason = normalizeTrimmedText(input.reason, 2000) || null

  if (!zoneId) {
    apiError(400, "请选择所属分区")
  }

  if (!name) {
    apiError(400, "请输入节点名称")
  }

  if (!slug) {
    apiError(400, "请输入合法的节点 slug")
  }

  return {
    zoneId,
    name,
    slug,
    description,
    icon,
    reason,
  }
}

function mapBoardApplicationItem(
  item: Awaited<ReturnType<typeof findBoardApplicationsByApplicant>>[number],
  actor: Awaited<ReturnType<typeof resolveAdminActorFromSessionUser>> | null,
) {
  const canWithdrawTreasury = item.board && actor
    ? canWithdrawBoardTreasury(actor, item.board.id, {
        zoneId: item.zone.id,
        moderatorsCanWithdrawBoardTreasury: resolveBoardSettings(null, { configJson: item.board.configJson }).moderatorsCanWithdrawBoardTreasury,
      })
    : false

  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    icon: item.icon ?? "💬",
    reason: item.reason ?? "",
    status: item.status,
    reviewNote: item.reviewNote ?? "",
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    zone: {
      id: item.zone.id,
      name: item.zone.name,
      slug: item.zone.slug,
    },
    board: item.board
      ? {
          id: item.board.id,
          name: item.board.name,
          slug: item.board.slug,
          treasuryPoints: item.board.treasuryPoints,
          canWithdrawTreasury,
        }
      : null,
  }
}

function mapAdminBoardApplicationItem(item: Awaited<ReturnType<typeof findBoardApplicationsForAdmin>>[number]) {
  return {
    id: item.id,
    applicantId: item.applicantId,
    zoneId: item.zoneId,
    boardId: item.boardId,
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    icon: item.icon ?? "💬",
    reason: item.reason ?? "",
    status: item.status,
    reviewNote: item.reviewNote ?? "",
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    applicant: {
      id: item.applicant.id,
      username: item.applicant.username,
      displayName: item.applicant.nickname ?? item.applicant.username,
      role: item.applicant.role,
      status: item.applicant.status,
    },
    reviewer: item.reviewer
      ? {
          id: item.reviewer.id,
          displayName: item.reviewer.nickname ?? item.reviewer.username,
        }
      : null,
    zone: {
      id: item.zone.id,
      name: item.zone.name,
      slug: item.zone.slug,
    },
    board: item.board
      ? {
          id: item.board.id,
          name: item.board.name,
          slug: item.board.slug,
          treasuryPoints: item.board.treasuryPoints,
        }
      : null,
  }
}

export async function getBoardApplicationPageData(
  userId: number | null | undefined,
  actorSource?: SessionActor | null,
) {
  if (!userId) {
    return {
      pendingCount: 0,
      items: [],
    }
  }

  const [items, actor] = await Promise.all([
    findBoardApplicationsByApplicant(userId),
    actorSource ? resolveAdminActorFromSessionUser(actorSource) : Promise.resolve(null),
  ])

  return {
    pendingCount: items.filter((item) => item.status === BoardApplicationStatus.PENDING).length,
    items: items.map((item) => mapBoardApplicationItem(item, actor)),
  }
}

export async function getAdminBoardApplicationPageData() {
  const [items, pendingCount] = await Promise.all([
    findBoardApplicationsForAdmin(),
    countPendingBoardApplications(),
  ])

  return {
    pendingCount,
    items: items.map(mapAdminBoardApplicationItem),
  }
}

export async function submitBoardApplication(input: BoardApplicationSubmitInput) {
  const settings = await getSiteSettings()
  if (!settings.boardApplicationEnabled) {
    apiError(403, "当前站点未开启节点申请")
  }

  const payload = ensureBoardApplicationPayload(input)
  const zone = await findZoneByIdForBoardApplication(payload.zoneId)

  if (!zone) {
    apiError(404, "目标分区不存在")
  }

  const duplicatedBoard = await findBoardApplicationDuplicateBoard(payload.name, payload.slug)
  if (duplicatedBoard) {
    apiError(409, duplicatedBoard.slug === payload.slug ? "该节点 slug 已存在" : "该节点名称已存在")
  }

  const duplicatedPending = await findPendingBoardApplicationByApplicantAndSlug(input.applicantId, payload.slug)
  if (duplicatedPending) {
    apiError(409, "你已经提交过同 slug 的待审核申请，请勿重复提交")
  }

  return createBoardApplication({
    applicantId: input.applicantId,
    zoneId: payload.zoneId,
    name: payload.name,
    slug: payload.slug,
    description: payload.description,
    icon: payload.icon,
    reason: payload.reason,
    status: BoardApplicationStatus.PENDING,
  })
}

export async function reviewBoardApplication(input: {
  applicationId: string
  reviewerId: number
  action: "approve" | "reject" | "update"
  zoneId?: string
  name?: string
  slug?: string
  description?: string
  icon?: string
  reason?: string
  reviewNote?: string
}) {
  const application = await findBoardApplicationById(input.applicationId)
  if (!application) {
    apiError(404, "节点申请不存在")
  }

  const payload = ensureBoardApplicationPayload({
    zoneId: input.zoneId ?? application.zoneId,
    name: input.name ?? application.name,
    slug: input.slug ?? application.slug,
    description: input.description ?? application.description,
    icon: input.icon ?? application.icon,
    reason: input.reason ?? application.reason,
  })
  const reviewNote = normalizeTrimmedText(input.reviewNote, 1000) || null

  const zone = await findZoneByIdForBoardApplication(payload.zoneId)
  if (!zone) {
    apiError(404, "目标分区不存在")
  }

  const duplicatedBoard = await findBoardApplicationDuplicateBoard(payload.name, payload.slug)
  if (duplicatedBoard && duplicatedBoard.id !== application.boardId) {
    apiError(409, duplicatedBoard.slug === payload.slug ? "该节点 slug 已存在" : "该节点名称已存在")
  }

  if (input.action === "update") {
    await updateBoardApplicationByAdmin({
      id: application.id,
      zoneId: payload.zoneId,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      icon: payload.icon,
      reason: payload.reason,
      reviewNote,
    })

    return { message: "节点申请已更新" }
  }

  if (application.status !== BoardApplicationStatus.PENDING) {
    apiError(400, "该申请已处理，不能重复审核")
  }

  if (input.action === "reject") {
    await prisma.$transaction(async (tx) => {
      await rejectBoardApplication({
        id: application.id,
        reviewNote,
        reviewerId: input.reviewerId,
        nextStatus: BoardApplicationStatus.REJECTED,
        client: tx,
      })

      await createSystemNotification({
        client: tx,
        userId: application.applicantId,
        senderId: input.reviewerId,
        relatedType: "ANNOUNCEMENT",
        relatedId: application.id,
        title: "你的节点申请未通过",
        content: `你提交的节点申请“${payload.name}”未通过审核。${reviewNote ? `审核备注：${reviewNote}` : "请调整申请内容后重新提交。"} `,
      })
    })

    return { message: "节点申请已驳回" }
  }

  if (application.applicant.status !== UserStatus.ACTIVE) {
    apiError(400, "申请人账号当前不是启用状态，不能直接设为节点版主")
  }

  if (application.applicant.role === UserRole.ADMIN) {
    apiError(400, "管理员账号不需要通过申请来绑定节点版主")
  }

  const result = await approveBoardApplicationWithBoardCreation({
    applicationId: application.id,
    applicantId: application.applicantId,
    zoneId: payload.zoneId,
    name: payload.name,
    slug: payload.slug,
    description: payload.description,
    icon: payload.icon,
    reviewNote,
    reviewerId: input.reviewerId,
    afterApprove: async (tx, context) => {
      await createSystemNotification({
        client: tx,
        userId: application.applicantId,
        senderId: input.reviewerId,
        relatedType: "ANNOUNCEMENT",
        relatedId: context.applicationId,
        title: "你的节点申请已通过",
        content: `你提交的节点申请“${payload.name}”已通过审核，节点 /boards/${context.boardSlug} 已创建，并已为你开通该节点版主权限。${reviewNote ? ` 审核备注：${reviewNote}` : ""}`,
      })
    },
  })

  return {
    message: `节点申请已通过，@${application.applicant.username} 已成为 ${result.board.name} 的版主`,
    data: {
      boardId: result.board.id,
      boardSlug: result.board.slug,
    },
  }
}

export async function withdrawBoardTreasury(input: {
  boardId: string
  currentUser: SessionActor
}) {
  if (!input.boardId.trim()) {
    apiError(400, "缺少节点参数")
  }

  const actor = await resolveAdminActorFromSessionUser(input.currentUser)
  if (!actor) {
    apiError(403, "只有管理员或版主可以提取节点金库")
  }

  const settings = await getSiteSettings()

  const managedBoard = await ensureCanManageBoard(actor, input.boardId)
  const moderatorsCanWithdrawBoardTreasury = resolveBoardSettings(null, {
    configJson: managedBoard.configJson,
  }).moderatorsCanWithdrawBoardTreasury

  if (!canWithdrawBoardTreasury(actor, managedBoard.id, {
    zoneId: managedBoard.zoneId,
    moderatorsCanWithdrawBoardTreasury,
  })) {
    apiError(403, "无权提取该节点金库")
  }

  return prisma.$transaction(async (tx) => {
    const [board, user] = await Promise.all([
      tx.board.findUnique({
        where: { id: managedBoard.id },
        select: {
          id: true,
          name: true,
          slug: true,
          treasuryPoints: true,
        },
      }),
      tx.user.findUnique({
        where: { id: input.currentUser.id },
        select: {
          id: true,
          points: true,
        },
      }),
    ])

    if (!board) {
      apiError(404, "节点不存在")
    }

    if (!user) {
      apiError(404, "用户不存在")
    }

    const withdrawAmount = board.treasuryPoints
    if (!Number.isSafeInteger(withdrawAmount) || withdrawAmount <= 0) {
      apiError(400, "节点金库暂无可提取积分")
    }

    const deducted = await decrementBoardTreasuryPointsIfEnough(tx, board.id, withdrawAmount)
    if (!deducted) {
      apiError(409, "节点金库余额已变化，请刷新后重试")
    }

    await applyPointDelta({
      tx,
      userId: user.id,
      beforeBalance: user.points,
      prepared: {
        scopeKey: "ALL_POINT_CHANGES",
        baseDelta: withdrawAmount,
        finalDelta: withdrawAmount,
        appliedRules: [],
      },
      reason: `提取节点金库 ${board.name}`,
      eventType: POINT_LOG_EVENT_TYPES.BOARD_TREASURY_WITHDRAW,
      eventData: {
        boardId: board.id,
        boardSlug: board.slug,
        boardName: board.name,
        withdrawAmount,
        operatorUserId: user.id,
      },
      pointName: settings.pointName,
    })

    return {
      amount: withdrawAmount,
      pointName: settings.pointName,
      board: {
        id: board.id,
        slug: board.slug,
        name: board.name,
      },
    }
  })
}
