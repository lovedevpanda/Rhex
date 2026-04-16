"use client"

import {
  type CreatePostFormProps,
} from "@/components/post/create-post-form.shared"
import { CreatePostFormModals } from "@/components/post/create-post-form-modals"
import { CreatePostFormShell } from "@/components/post/create-post-form-shell"
import { useCreatePostDraft } from "@/components/post/use-create-post-draft"
import { useCreatePostSubmit } from "@/components/post/use-create-post-submit"

export function CreatePostForm({
  boardOptions,
  pointName,
  addonCaptcha,
  addonFormBefore,
  addonFormAfter,
  addonToolsBefore,
  addonToolsAfter,
  addonEditorBefore,
  addonEditorAfter,
  addonEnhancementsBefore,
  addonEnhancementsAfter,
  addonSubmitBefore,
  addonSubmitAfter,
  anonymousPostEnabled = false,
  anonymousPostPrice = 0,
  postRedPacketEnabled = false,
  postRedPacketMaxPoints = 100,
  postJackpotEnabled = false,
  postJackpotMinInitialPoints = 100,
  postJackpotMaxInitialPoints = 1000,
  postJackpotReplyIncrementPoints = 25,
  postJackpotHitProbability = 15,
  markdownEmojiMap,
  currentUser,
  attachmentFeature = {
    uploadEnabled: false,
    minUploadLevel: 0,
    minUploadVipLevel: 0,
    allowedExtensions: [],
    maxFileSizeMb: 20,
  },
  viewLevelOptions,
  viewVipLevelOptions,
  mode = "create",
  postId,
  successSlug,
  postLinkDisplayMode = "SLUG",
  initialValues,
}: CreatePostFormProps) {
  const draftController = useCreatePostDraft({
    boardOptions,
    pointName,
    anonymousPostEnabled,
    anonymousPostPrice,
    postRedPacketEnabled,
    postRedPacketMaxPoints,
    postJackpotEnabled,
    postJackpotMinInitialPoints,
    postJackpotReplyIncrementPoints,
    currentUser,
    attachmentFeature,
    mode,
    postId,
    initialValues,
  })

  const submitController = useCreatePostSubmit({
    mode,
    postId,
    successSlug,
    postLinkDisplayMode,
    draft: draftController.draft,
  })

  return (
    <>
      <CreatePostFormShell
        boardOptions={boardOptions}
        pointName={pointName}
        addonCaptcha={addonCaptcha}
        addonFormBefore={addonFormBefore}
        addonFormAfter={addonFormAfter}
        addonToolsBefore={addonToolsBefore}
        addonToolsAfter={addonToolsAfter}
        addonEditorBefore={addonEditorBefore}
        addonEditorAfter={addonEditorAfter}
        addonEnhancementsBefore={addonEnhancementsBefore}
        addonEnhancementsAfter={addonEnhancementsAfter}
        addonSubmitBefore={addonSubmitBefore}
        addonSubmitAfter={addonSubmitAfter}
        markdownEmojiMap={markdownEmojiMap}
        viewLevelOptions={viewLevelOptions}
        viewVipLevelOptions={viewVipLevelOptions}
        postJackpotHitProbability={postJackpotHitProbability}
        draftController={draftController}
        submitController={submitController}
      />

      <CreatePostFormModals
        pointName={pointName}
        viewLevelOptions={viewLevelOptions}
        viewVipLevelOptions={viewVipLevelOptions}
        postJackpotMaxInitialPoints={postJackpotMaxInitialPoints}
        draftController={draftController}
      />
    </>
  )
}
