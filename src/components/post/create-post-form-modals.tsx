"use client"

import {
  CoverConfigModal,
  PostRewardPoolModal,
  TagConfigModal,
} from "@/components/post/create-post-form-modals-ui"
import { HiddenContentModal } from "@/components/post/hidden-content-modal"
import { PostAttachmentModal } from "@/components/post/post-attachment-modal"
import { PostViewLevelModal } from "@/components/post/post-view-level-modal"
import type { AccessThresholdOption } from "@/lib/access-threshold-options"
import type { CreatePostDraftController } from "@/components/post/use-create-post-draft"

interface CreatePostFormModalsProps {
  pointName: string
  viewLevelOptions: AccessThresholdOption[]
  viewVipLevelOptions: AccessThresholdOption[]
  postJackpotMaxInitialPoints: number
  draftController: CreatePostDraftController
}

export function CreatePostFormModals({
  pointName,
  viewLevelOptions,
  viewVipLevelOptions,
  postJackpotMaxInitialPoints,
  draftController,
}: CreatePostFormModalsProps) {
  const {
    draft,
    tagInput,
    tagModalOpen,
    coverModalOpen,
    rewardPoolModalOpen,
    attachmentModalOpen,
    tagEditingIndex,
    tagEditingValue,
    activeModal,
    coverUploading,
    attachmentUploading,
    fixedRedPacketTotalPoints,
    effectiveRewardPoolOptions,
    autoExtractedTags,
    canManageAttachments,
    canAddAttachments,
    currentUser,
    attachmentFeature,
    isEditMode,
    postRedPacketMaxPoints,
    postJackpotMinInitialPoints,
    setTagInput,
    setTagEditingValue,
    setCoverModalOpen,
    setRewardPoolModalOpen,
    setAttachmentModalOpen,
    setActiveModal,
    updateDraftField,
    patchDraft,
    handleCloseTagModal,
    handleCoverUpload,
    handleAttachmentUpload,
    handleTagInputConfirm,
    applyAutoTagsToManual,
    addManualTag,
    clearManualTags,
    startEditingTag,
    commitEditingTag,
    cancelEditingTag,
    removeManualTag,
    addExternalAttachment,
    removeAttachment,
    updateAttachment,
    resolveAvailableRewardPoolMode,
  } = draftController

  return (
    <>
      <CoverConfigModal
        open={coverModalOpen}
        coverPath={draft.coverPath}
        coverUploading={coverUploading}
        onClose={() => setCoverModalOpen(false)}
        onCoverUpload={handleCoverUpload}
        onCoverPathChange={(value) => updateDraftField("coverPath", value)}
        onCoverClear={() => updateDraftField("coverPath", "")}
      />

      <TagConfigModal
        open={tagModalOpen}
        autoExtractedTags={autoExtractedTags}
        manualTags={draft.manualTags}
        tagInput={tagInput}
        tagEditingIndex={tagEditingIndex}
        tagEditingValue={tagEditingValue}
        onClose={handleCloseTagModal}
        onTagInputChange={setTagInput}
        onTagInputConfirm={handleTagInputConfirm}
        onApplyAutoTagsToManual={applyAutoTagsToManual}
        onAddManualTag={addManualTag}
        onClearManualTags={clearManualTags}
        onStartEditingTag={startEditingTag}
        onTagEditingValueChange={setTagEditingValue}
        onCommitEditingTag={commitEditingTag}
        onCancelEditingTag={cancelEditingTag}
        onRemoveManualTag={removeManualTag}
      />

      <PostAttachmentModal
        open={attachmentModalOpen}
        attachments={draft.attachments}
        pointName={pointName}
        levelOptions={viewLevelOptions}
        vipLevelOptions={viewVipLevelOptions}
        attachmentFeature={{
          siteUploadEnabled: attachmentFeature.uploadEnabled,
          canManage: canManageAttachments,
          canAddNew: canAddAttachments,
          minUploadLevel: attachmentFeature.minUploadLevel,
          minUploadVipLevel: attachmentFeature.minUploadVipLevel,
          allowedExtensions: attachmentFeature.allowedExtensions,
          maxFileSizeMb: attachmentFeature.maxFileSizeMb,
        }}
        uploading={attachmentUploading}
        onClose={() => setAttachmentModalOpen(false)}
        onUpload={handleAttachmentUpload}
        onAddExternal={addExternalAttachment}
        onRemove={removeAttachment}
        onAttachmentChange={updateAttachment}
      />

      <PostRewardPoolModal
        open={rewardPoolModalOpen}
        pointName={pointName}
        redPacketEnabled={effectiveRewardPoolOptions.postRedPacketEnabled}
        redPacketMaxPoints={postRedPacketMaxPoints}
        jackpotEnabled={effectiveRewardPoolOptions.postJackpotEnabled}
        jackpotMinInitialPoints={postJackpotMinInitialPoints}
        jackpotMaxInitialPoints={postJackpotMaxInitialPoints}
        jackpotReplyIncrementPoints={draftController.postJackpotReplyIncrementPoints}
        currentUserPoints={currentUser.points}
        value={{
          enabled: draft.redPacketEnabled,
          mode: draft.redPacketMode,
          grantMode: draft.redPacketGrantMode,
          claimOrderMode: draft.redPacketClaimOrderMode,
          triggerType: draft.redPacketTriggerType,
          jackpotInitialPoints: draft.jackpotInitialPoints,
          unitPoints: draft.redPacketUnitPoints,
          totalPoints: draft.redPacketTotalPoints,
          packetCount: draft.redPacketPacketCount,
          fixedTotalPoints: fixedRedPacketTotalPoints,
        }}
        disabled={isEditMode}
        onClose={() => setRewardPoolModalOpen(false)}
        onChange={{
          onEnabledChange: (checked) =>
            patchDraft({
              redPacketEnabled: checked,
              ...(checked
                ? {
                    redPacketMode: resolveAvailableRewardPoolMode(
                      draft.redPacketMode,
                      effectiveRewardPoolOptions,
                    ),
                  }
                : {}),
            }),
          onModeChange: (value) => updateDraftField("redPacketMode", value),
          onGrantModeChange: (value) =>
            updateDraftField("redPacketGrantMode", value),
          onClaimOrderModeChange: (value) =>
            updateDraftField("redPacketClaimOrderMode", value),
          onTriggerTypeChange: (value) =>
            updateDraftField("redPacketTriggerType", value),
          onJackpotInitialPointsChange: (value) =>
            updateDraftField("jackpotInitialPoints", value),
          onUnitPointsChange: (value) =>
            updateDraftField("redPacketUnitPoints", value),
          onTotalPointsChange: (value) =>
            updateDraftField("redPacketTotalPoints", value),
          onPacketCountChange: (value) =>
            updateDraftField("redPacketPacketCount", value),
        }}
      />

      <HiddenContentModal
        open={activeModal === "login"}
        title="配置登录后可看"
        description="这部分内容仅登录用户可见。适合给游客隐藏附件说明、站内资源入口或成员补充内容。"
        value={draft.loginUnlockContent}
        onChange={(value) => updateDraftField("loginUnlockContent", value)}
        onClose={() => setActiveModal(null)}
      />

      <HiddenContentModal
        open={activeModal === "reply"}
        title="配置回复后可看"
        description="用户在本帖回复 1 次后即可解锁。详细说明已收进这里，页面主区域只保留一行入口。"
        value={draft.replyUnlockContent}
        onChange={(value) => updateDraftField("replyUnlockContent", value)}
        onClose={() => setActiveModal(null)}
      />

      <PostViewLevelModal
        open={activeModal === "view-level"}
        value={{
          minViewLevel: draft.minViewLevel,
          minViewVipLevel: draft.minViewVipLevel,
        }}
        levelOptions={viewLevelOptions}
        vipLevelOptions={viewVipLevelOptions}
        onChange={({ minViewLevel, minViewVipLevel }) =>
          patchDraft({ minViewLevel, minViewVipLevel })}
        onClose={() => setActiveModal(null)}
      />

      <HiddenContentModal
        open={activeModal === "purchase"}
        title="配置购买后可看"
        description={`用户支付后才可查看这部分内容。适合资料、附件说明、完整版教程等付费内容，价格单位为 ${pointName}。`}
        value={draft.purchaseUnlockContent}
        onChange={(value) => updateDraftField("purchaseUnlockContent", value)}
        onClose={() => setActiveModal(null)}
        price={draft.purchasePrice}
        onPriceChange={(value) => updateDraftField("purchasePrice", value)}
        priceLabel={`购买价格（${pointName}）`}
      />
    </>
  )
}
