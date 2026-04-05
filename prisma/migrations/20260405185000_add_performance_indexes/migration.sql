-- CreateIndex
CREATE INDEX "AdminLog_adminId_createdAt_idx" ON "AdminLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminLog_targetType_targetId_createdAt_idx" ON "AdminLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Favorite_postId_createdAt_idx" ON "Favorite"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "Like_userId_targetType_createdAt_idx" ON "Like"("userId", "targetType", "createdAt");

-- CreateIndex
CREATE INDEX "Like_postId_idx" ON "Like"("postId");

-- CreateIndex
CREATE INDEX "Like_commentId_idx" ON "Like"("commentId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLog_userId_createdAt_idx" ON "PointLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_authorId_status_createdAt_idx" ON "Post"("authorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PostTag_tagId_postId_idx" ON "PostTag"("tagId", "postId");

-- CreateIndex
CREATE INDEX "Report_reporterId_targetType_targetId_status_idx" ON "Report"("reporterId", "targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SensitiveWord_status_createdAt_idx" ON "SensitiveWord"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SensitiveWord_actionType_status_idx" ON "SensitiveWord"("actionType", "status");

-- CreateIndex
CREATE INDEX "Upload_userId_createdAt_idx" ON "Upload"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserCheckInLog_userId_createdAt_idx" ON "UserCheckInLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserLoginLog_userId_createdAt_idx" ON "UserLoginLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCode_channel_target_purpose_consumedAt_idx" ON "VerificationCode"("channel", "target", "purpose", "consumedAt");

-- CreateIndex
CREATE INDEX "VerificationCode_channel_target_purpose_consumedAt_createdA_idx" ON "VerificationCode"("channel", "target", "purpose", "consumedAt", "createdAt");

-- CreateIndex
CREATE INDEX "VipOrder_userId_createdAt_idx" ON "VipOrder"("userId", "createdAt");
