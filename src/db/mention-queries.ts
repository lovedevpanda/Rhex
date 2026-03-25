import { prisma } from "@/db/client"

export async function findUsersByUsernames(usernames: string[]) {
  if (usernames.length === 0) {
    return []
  }

  return prisma.user.findMany({
    where: {
      username: {
        in: usernames,
      },
    },
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  })
}
