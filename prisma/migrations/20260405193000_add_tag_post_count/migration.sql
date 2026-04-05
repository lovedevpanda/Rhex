-- AlterTable
ALTER TABLE "Tag"
ADD COLUMN "postCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill
UPDATE "Tag" AS "t"
SET "postCount" = COALESCE("counts"."postCount", 0)
FROM (
  SELECT "tagId", COUNT(*)::INTEGER AS "postCount"
  FROM "PostTag"
  GROUP BY "tagId"
) AS "counts"
WHERE "t"."id" = "counts"."tagId";

-- CreateIndex
CREATE INDEX "Tag_createdAt_idx" ON "Tag"("createdAt");

-- CreateIndex
CREATE INDEX "Tag_postCount_createdAt_idx" ON "Tag"("postCount", "createdAt");
