ALTER TABLE "Comment"
  ADD COLUMN "tipCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tipTotalPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PostTip"
  ADD COLUMN "commentId" TEXT;

ALTER TABLE "PostTip"
  ADD CONSTRAINT "PostTip_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PostTip_commentId_idx" ON "PostTip"("commentId");
CREATE INDEX "PostTip_commentId_senderId_createdAt_idx" ON "PostTip"("commentId", "senderId", "createdAt");