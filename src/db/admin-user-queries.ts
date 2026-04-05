import { UserRole, UserStatus } from "@/db/types"

import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { resolveCountMap } from "@/db/helpers"

export function buildAdminUserSummary(where: Prisma.UserWhereInput) {
  return resolveCountMap([
    ["total", prisma.user.count({ where })],
    ["active", prisma.user.count({ where: { ...where, status: UserStatus.ACTIVE } })],
    ["muted", prisma.user.count({ where: { ...where, status: UserStatus.MUTED } })],
    ["banned", prisma.user.count({ where: { ...where, status: UserStatus.BANNED } })],
    ["inactive", prisma.user.count({ where: { ...where, status: UserStatus.INACTIVE } })],
    ["admin", prisma.user.count({ where: { ...where, role: UserRole.ADMIN } })],
    ["moderator", prisma.user.count({ where: { ...where, role: UserRole.MODERATOR } })],
  ] as const)
}

export function findAdminUsersPage(where: Prisma.UserWhereInput, orderBy: Prisma.UserOrderByWithRelationInput[], skip: number, take: number) {
  return prisma.user.findMany({
    where,
    orderBy,
    include: {
      inviter: {
        select: {
          username: true,
          nickname: true,
        },
      },
      levelProgress: {
        select: {
          checkInDays: true,
        },
      },
      _count: {
        select: {
          favorites: true,
        },
      },
      moderatedZoneScopes: {
        orderBy: [{ zone: { sortOrder: "asc" } }, { createdAt: "asc" }],
        include: {
          zone: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      moderatedBoardScopes: {
        orderBy: [{ board: { sortOrder: "asc" } }, { createdAt: "asc" }],
        include: {
          board: {
            select: {
              id: true,
              name: true,
              slug: true,
              zoneId: true,
              zone: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
    skip,
    take,
  })
}

export async function findModeratorScopeOptions() {
  const [zones, boards] = await prisma.$transaction(async (tx) => {
    return Promise.all([
      tx.zone.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),
      tx.board.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          zoneId: true,
          zone: {
            select: {
              name: true,
            },
          },
        },
      }),
    ])
  })

  return {
    zones,
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      slug: board.slug,
      zoneId: board.zoneId ?? null,
      zoneName: board.zone?.name ?? null,
    })),
  }
}
