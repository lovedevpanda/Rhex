ALTER TABLE "PostGiftEvent"
  ADD COLUMN "commentId" TEXT;

ALTER TABLE "PostGiftEvent"
  ADD CONSTRAINT "PostGiftEvent_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PostGiftEvent_commentId_createdAt_idx" ON "PostGiftEvent"("commentId", "createdAt");
CREATE INDEX "PostGiftEvent_commentId_senderId_createdAt_idx" ON "PostGiftEvent"("commentId", "senderId", "createdAt");