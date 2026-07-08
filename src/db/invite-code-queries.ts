import { prisma } from "@/db/client"

export type InviteCodeUsageStatus = "all" | "used" | "unused"

function buildInviteCodeCreatorWhere(userId: number, status: InviteCodeUsageStatus = "all") {
  return {
    createdById: userId,
    ...(status === "used"
      ? { usedById: { not: null } }
      : status === "unused"
        ? { usedById: null }
        : {}),
  }
}

export function findInviteCodeByCode(code: string) {
  return prisma.inviteCode.findUnique({ where: { code } })
}

export function createInviteCodesBatch(data: Array<{ code: string; createdById?: number | null; note?: string | null }>) {
  return prisma.inviteCode.createMany({ data })
}

export function findInviteCodesByCodes(codes: string[]) {
  return prisma.inviteCode.findMany({
    where: {
      code: {
        in: codes,
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export function findInviteCodeList(limit: number) {
  return prisma.inviteCode.findMany({
    orderBy: [{ usedAt: "asc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 200)),
    include: {
      createdBy: { select: { username: true } },
      usedBy: { select: { username: true } },
    },
  })
}

export function deleteInviteCodeById(id: string) {
  return prisma.inviteCode.deleteMany({
    where: { id },
  })
}

export function deleteInviteCodesByScope(scope: "all" | "used" | "unused") {
  return prisma.inviteCode.deleteMany({
    where: scope === "all"
      ? {}
      : {
          usedAt: scope === "used" ? { not: null } : null,
        },
  })
}

export function countInviteCodesByCreator(userId: number, status: InviteCodeUsageStatus = "all") {
  return prisma.inviteCode.count({
    where: buildInviteCodeCreatorWhere(userId, status),
  })
}

export function findInviteCodesByCreator(userId: number, options: { page: number; pageSize: number; status?: InviteCodeUsageStatus }) {
  const page = Math.max(1, Math.trunc(options.page))
  const pageSize = Math.max(1, Math.min(Math.trunc(options.pageSize), 1000))

  return prisma.inviteCode.findMany({
    where: buildInviteCodeCreatorWhere(userId, options.status ?? "all"),
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      code: true,
      createdAt: true,
      usedAt: true,
      usedBy: {
        select: {
          username: true,
        },
      },
    },
  })
}

export function findInviteCodeForUse(code: string) {
  return prisma.inviteCode.findUnique({
    where: { code },
    select: { id: true, code: true, createdById: true, usedById: true },
  })
}

export function findUserInviteResolverByUsername(username: string) {
  return prisma.user.findUnique({ where: { username }, select: { id: true, username: true } })
}

export function findUserInviteResolverById(userId: number) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
}

export function findInvitePurchaseUser(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      points: true,
      username: true,
      vipLevel: true,
      vipExpiresAt: true,
    },
  })
}
