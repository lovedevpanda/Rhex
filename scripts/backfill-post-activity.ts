import { prisma } from "@/db/client"

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Post"
    SET "activityAt" = COALESCE("lastCommentedAt", "createdAt")
    WHERE "activityAt" IS NULL
       OR "activityAt" <> COALESCE("lastCommentedAt", "createdAt")
  `)

  console.log(`Backfilled activityAt for ${result} posts.`)
}

main()
  .catch((error) => {
    console.error("Failed to backfill post activityAt:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
