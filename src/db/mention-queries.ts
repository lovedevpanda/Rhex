import { prisma } from "@/db/client"

export async function findUsersByMentionTexts(mentionTexts: string[]) {
  const normalizedMentionTexts = [...new Set(mentionTexts.map((item) => item.trim()).filter(Boolean))]

  if (normalizedMentionTexts.length === 0) {
    return []
  }

  return prisma.user.findMany({
    where: {
      OR: [
        {
          username: {
            in: normalizedMentionTexts,
          },
        },
        {
          nickname: {
            in: normalizedMentionTexts,
          },
        },
      ],
    },
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  })
}
