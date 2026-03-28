import { BoardStatus } from "@/db/types"

import { prisma } from "@/db/client"

import type { Prisma } from "@/db/types"

export function createZone(data: Prisma.ZoneCreateInput) {
  return prisma.zone.create({ data })
}

export function createBoard(data: Prisma.BoardUncheckedCreateInput) {
  return prisma.board.create({ data })
}

export function updateZone(id: string, data: Prisma.ZoneUpdateInput) {
  return prisma.zone.update({
    where: { id },
    data,
  })
}

export function updateBoard(id: string, data: Prisma.BoardUncheckedUpdateInput) {
  return prisma.board.update({
    where: { id },
    data,
  })
}

export function countBoardsByZone(zoneId: string) {
  return prisma.board.count({ where: { zoneId } })
}

export function deleteZone(id: string) {
  return prisma.zone.delete({ where: { id } })
}

export function countPostsByBoard(boardId: string) {
  return prisma.post.count({ where: { boardId } })
}

export function deleteBoard(id: string) {
  return prisma.board.delete({ where: { id } })
}

export { BoardStatus }
