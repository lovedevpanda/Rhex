import { prisma } from "@/db/client"

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      username: true,
      email: true,
      status: true,
    },
  })
}

export function updateUserPasswordById(userId: number, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
    },
    select: {
      id: true,
      username: true,
      email: true,
    },
  })
}
