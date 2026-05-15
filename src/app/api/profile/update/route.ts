import { prisma } from "@/db/client"
import { findUserByNicknameInsensitive } from "@/db/user-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"

import type { AddonUserProfileRecord } from "@/addons-host/types"
import { executeAddonActionHook, executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { resolveHookedOptionalStringValue, resolveHookedStringValue } from "@/lib/addon-hook-values"
import { enforceSensitiveText } from "@/lib/content-safety"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { validateProfilePayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { findUsernameSensitiveWord } from "@/lib/username-sensitive-words"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { isUserProfileVisibility, mapLegacyVisibilityBoolean, mergeUserProfileSettings, resolveUserProfileSettings, type UserProfileVisibility } from "@/lib/user-profile-settings"
import { VerificationChannel } from "@/lib/shared/verification-channel"
import { resolveVipTierPrice } from "@/lib/vip-tier-pricing"

type ProfileUpdateResponse = {
  username: string
  nickname: string
  bio: string
  introduction: string
  gender: string
  avatarPath: string
  email: string
  emailVerifiedAt?: string | null
  activityVisibility: UserProfileVisibility
  introductionVisibility: UserProfileVisibility
  points: number
}

function toProfileUpdateResponse(input: {
  username: string
  nickname: string | null
  bio: string | null
  introduction: string
  gender: string | null
  avatarPath: string | null
  email: string | null
  emailVerifiedAt?: Date | string | null
  activityVisibility: UserProfileVisibility
  introductionVisibility: UserProfileVisibility
  points: number
}): ProfileUpdateResponse {
  return {
    username: input.username,
    nickname: input.nickname ?? "",
    bio: input.bio ?? "",
    introduction: input.introduction,
    gender: input.gender ?? "unknown",
    avatarPath: input.avatarPath ?? "",
    email: input.email ?? "",
    emailVerifiedAt: typeof input.emailVerifiedAt === "string"
      ? input.emailVerifiedAt
      : input.emailVerifiedAt?.toISOString() ?? null,
    activityVisibility: input.activityVisibility,
    introductionVisibility: input.introductionVisibility,
    points: input.points,
  }
}

function mapAddonUserProfileRecord(input: {
  id: number
  username: string
  nickname: string | null
  bio: string | null
  introduction: string
  gender: string | null
  avatarPath: string | null
  email: string | null
  emailVerifiedAt?: Date | string | null
  activityVisibility: UserProfileVisibility
  introductionVisibility: UserProfileVisibility
  points: number
}): AddonUserProfileRecord {
  return {
    id: input.id,
    username: input.username,
    nickname: input.nickname,
    bio: input.bio,
    introduction: input.introduction,
    gender: input.gender,
    avatarPath: input.avatarPath,
    email: input.email,
    emailVerifiedAt: typeof input.emailVerifiedAt === "string"
      ? input.emailVerifiedAt
      : input.emailVerifiedAt?.toISOString() ?? null,
    activityVisibility: input.activityVisibility,
    introductionVisibility: input.introductionVisibility,
    points: input.points,
  }
}

export const POST = createUserRouteHandler<ProfileUpdateResponse>(async ({ request, currentUser }) => {

  const body = await readJsonBody(request)
  const requestUrl = new URL(request.url)
  const settings = await getSiteSettings()

  const validated = validateProfilePayload(body, {
    nicknameMinLength: settings.registerNicknameMinLength,
    nicknameMaxLength: settings.registerNicknameMaxLength,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const email = validated.data.email
  const gender = validated.data.gender || "unknown"
  const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath.trim() : ""
  const emailCode = typeof body.emailCode === "string" ? body.emailCode.trim() : ""

  const dbUser = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      username: true,
      nickname: true,
      bio: true,
      gender: true,
      avatarPath: true,
      email: true,
      emailVerifiedAt: true,
      signature: true,
      points: true,
    },
  })

  if (!dbUser) {
    apiError(404, "用户不存在")
  }

  const nextEmail = email || null
  const currentProfileSettings = resolveUserProfileSettings(dbUser.signature)
  const activityVisibilityInput = typeof body.activityVisibility === "string" ? body.activityVisibility.trim().toUpperCase() : null
  const introductionVisibilityInput = typeof body.introductionVisibility === "string" ? body.introductionVisibility.trim().toUpperCase() : null

  if (activityVisibilityInput && !isUserProfileVisibility(activityVisibilityInput)) {
    apiError(400, "活动轨迹可见范围参数不正确")
  }

  if (introductionVisibilityInput && !isUserProfileVisibility(introductionVisibilityInput)) {
    apiError(400, "介绍可见范围参数不正确")
  }

  const activityVisibility = (activityVisibilityInput && isUserProfileVisibility(activityVisibilityInput) ? activityVisibilityInput : null)
    ?? (typeof body.activityVisibilityPublic === "boolean" ? mapLegacyVisibilityBoolean(body.activityVisibilityPublic) : null)
    ?? currentProfileSettings.activityVisibility
  const introductionVisibility = (introductionVisibilityInput && isUserProfileVisibility(introductionVisibilityInput) ? introductionVisibilityInput : null)
    ?? currentProfileSettings.introductionVisibility
  const currentProfile = mapAddonUserProfileRecord({
    id: dbUser.id,
    username: dbUser.username,
    nickname: dbUser.nickname,
    bio: dbUser.bio,
    introduction: currentProfileSettings.introduction,
    gender: dbUser.gender,
    avatarPath: dbUser.avatarPath,
    email: dbUser.email,
    emailVerifiedAt: dbUser.emailVerifiedAt,
    activityVisibility: currentProfileSettings.activityVisibility,
    introductionVisibility: currentProfileSettings.introductionVisibility,
    points: dbUser.points,
  })
  const profileHookPayload = {
    userId: currentUser.id,
    username: dbUser.username,
    currentProfile,
    nextGender: gender,
    nextAvatarPath: avatarPath,
    nextEmail,
    nextActivityVisibility: activityVisibility,
    nextIntroductionVisibility: introductionVisibility,
  }
  const nicknameHookResult = await executeAddonWaterfallHook("user.profile.nickname.value", validated.data.nickname, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    payload: profileHookPayload,
  })
  const bioHookResult = await executeAddonWaterfallHook("user.profile.bio.value", validated.data.bio, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    payload: profileHookPayload,
  })
  const introductionHookResult = await executeAddonWaterfallHook("user.profile.introduction.value", validated.data.introduction, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    payload: profileHookPayload,
  })
  const { value: hookedNickname, changed: nicknameHookAdjusted } = resolveHookedStringValue(validated.data.nickname, nicknameHookResult.value)
  const { value: hookedBio, changed: bioHookAdjusted } = resolveHookedOptionalStringValue(validated.data.bio, bioHookResult.value)
  const { value: hookedIntroduction, changed: introductionHookAdjusted } = resolveHookedOptionalStringValue(validated.data.introduction, introductionHookResult.value)
  const nicknameSafety = await enforceSensitiveText({ scene: "profile.nickname", text: hookedNickname })
  const bioSafety = await enforceSensitiveText({ scene: "profile.bio", text: hookedBio })
  const introductionSafety = await enforceSensitiveText({ scene: "profile.introduction", text: hookedIntroduction })
  const nextNickname = nicknameSafety.sanitizedText
  const nextBio = bioSafety.sanitizedText
  const nextIntroduction = introductionSafety.sanitizedText
  const nextSignature = mergeUserProfileSettings(dbUser.signature, {
    activityVisibility,
    introductionVisibility,
    introduction: nextIntroduction,
  })
  const emailChanged = (dbUser.email ?? null) !== nextEmail
  const currentNickname = (dbUser.nickname ?? "").trim()
  const currentBio = (dbUser.bio ?? "").trim()
  const currentIntroduction = currentProfileSettings.introduction.trim()
  const currentAvatarPath = (dbUser.avatarPath ?? "").trim()
  const nicknameChanged = currentNickname !== nextNickname

  if (nicknameChanged) {
    const matchedNicknameSensitiveWord = findUsernameSensitiveWord(hookedNickname, settings)
    if (matchedNicknameSensitiveWord) {
      apiError(400, `昵称包含敏感词：${matchedNicknameSensitiveWord}`)
    }
  }

  const bioChanged = currentBio !== nextBio
  const introductionChanged = currentIntroduction !== nextIntroduction
  const avatarChanged = currentAvatarPath !== avatarPath
  const contentAdjusted = Boolean(
    nicknameHookAdjusted
    || bioHookAdjusted
    || introductionHookAdjusted
    || nicknameSafety.wasReplaced
    || bioSafety.wasReplaced
    || introductionSafety.wasReplaced
  )
  const avatarRequiresPointCost = avatarChanged && currentAvatarPath.length > 0
  const nicknameChangePointCost = Math.max(0, resolveVipTierPrice(currentUser, {
    normal: settings.nicknameChangePointCost,
    vip1: settings.nicknameChangeVip1PointCost,
    vip2: settings.nicknameChangeVip2PointCost,
    vip3: settings.nicknameChangeVip3PointCost,
  }))
  const introductionChangePointCost = Math.max(0, resolveVipTierPrice(currentUser, {
    normal: settings.introductionChangePointCost,
    vip1: settings.introductionChangeVip1PointCost,
    vip2: settings.introductionChangeVip2PointCost,
    vip3: settings.introductionChangeVip3PointCost,
  }))
  const avatarChangePointCost = Math.max(0, resolveVipTierPrice(currentUser, {
    normal: settings.avatarChangePointCost,
    vip1: settings.avatarChangeVip1PointCost,
    vip2: settings.avatarChangeVip2PointCost,
    vip3: settings.avatarChangeVip3PointCost,
  }))
  const pointName = settings.pointName?.trim() || "积分"
  const nicknameCostDelta = nicknameChanged
    ? await prepareScopedPointDelta({
        scopeKey: "NICKNAME_CHANGE",
        baseDelta: -nicknameChangePointCost,
        userId: currentUser.id,
      })
    : { scopeKey: "NICKNAME_CHANGE" as const, baseDelta: 0, finalDelta: 0, appliedRules: [] }
  const introductionCostDelta = introductionChanged
    ? await prepareScopedPointDelta({
        scopeKey: "INTRODUCTION_CHANGE",
        baseDelta: -introductionChangePointCost,
        userId: currentUser.id,
      })
    : { scopeKey: "INTRODUCTION_CHANGE" as const, baseDelta: 0, finalDelta: 0, appliedRules: [] }
  const avatarCostDelta = avatarRequiresPointCost
    ? await prepareScopedPointDelta({
        scopeKey: "AVATAR_CHANGE",
        baseDelta: -avatarChangePointCost,
        userId: currentUser.id,
      })
    : { scopeKey: "AVATAR_CHANGE" as const, baseDelta: 0, finalDelta: 0, appliedRules: [] }
  const totalRequiredPoints = [
    nicknameCostDelta.finalDelta,
    introductionCostDelta.finalDelta,
    avatarCostDelta.finalDelta,
  ].filter((item) => item < 0).reduce((sum, item) => sum + Math.abs(item), 0)

  if (dbUser.emailVerifiedAt && emailChanged) {
    apiError(400, "邮箱已验证，不能再修改邮箱地址")
  }

  let emailVerifiedAt = dbUser.emailVerifiedAt

  if (!dbUser.emailVerifiedAt && nextEmail && emailCode) {
    await verifyCode({
      channel: VerificationChannel.EMAIL,
      target: nextEmail,
      code: emailCode,
    })
    emailVerifiedAt = new Date()
  }

  if (nextEmail) {
    const existingEmailUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: nextEmail,
          mode: "insensitive",
        },
        id: {
          not: currentUser.id,
        },
      },
      select: { id: true },
    })

    if (existingEmailUser) {
      apiError(409, "邮箱已被使用")
    }
  }

  const existingNicknameUser = await findUserByNicknameInsensitive(nextNickname, currentUser.id)

  if (existingNicknameUser) {
    apiError(409, "昵称已被使用")
  }

  if (totalRequiredPoints > 0 && dbUser.points < totalRequiredPoints) {
    apiError(400, `保存资料需要 ${totalRequiredPoints} ${pointName}，当前余额不足`)
  }

  await executeAddonActionHook("user.update.before", {
    userId: currentUser.id,
    username: dbUser.username,
    currentProfile,
    nickname: nextNickname,
    bio: nextBio,
    introduction: nextIntroduction,
    gender,
    avatarPath,
    email: nextEmail,
    activityVisibility,
    introductionVisibility,
    nicknameChanged,
    bioChanged,
    introductionChanged,
    avatarChanged,
    emailChanged,
    contentAdjusted,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: currentUser.id },
      data: {
        nickname: nextNickname,
        bio: nextBio || null,
        gender,
        avatarPath: avatarPath || null,
        email: nextEmail,
        emailVerifiedAt,
        signature: nextSignature,
      },
    })

    let pointBalanceCursor = dbUser.points

    if (nicknameChanged && nicknameCostDelta.finalDelta !== 0) {
      const nicknameResult = await applyPointDelta({
        tx,
        userId: currentUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: nicknameCostDelta,
        pointName,
        reason: "修改昵称",
      })
      pointBalanceCursor = nicknameResult.afterBalance
    }

    if (introductionChanged && introductionCostDelta.finalDelta !== 0) {
      const introductionResult = await applyPointDelta({
        tx,
        userId: currentUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: introductionCostDelta,
        pointName,
        reason: "修改介绍",
      })
      pointBalanceCursor = introductionResult.afterBalance
    }

    if (avatarRequiresPointCost && avatarCostDelta.finalDelta !== 0) {
      await applyPointDelta({
        tx,
        userId: currentUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: avatarCostDelta,
        pointName,
        reason: "修改头像",
      })
    }

    return tx.user.findUniqueOrThrow({
      where: { id: currentUser.id },
      select: {
        id: true,
        username: true,
        nickname: true,
        bio: true,
        gender: true,
        avatarPath: true,
        email: true,
        emailVerifiedAt: true,
        signature: true,
        points: true,
      },
    })
  })

  const messageParts: string[] = []
  if (contentAdjusted) {
    messageParts.push("资料已更新，部分内容已按规则替换")
  } else {
    messageParts.push("资料已更新")
  }

  if (
    (nicknameChanged && nicknameCostDelta.finalDelta !== 0)
    || (introductionChanged && introductionCostDelta.finalDelta !== 0)
    || (avatarRequiresPointCost && avatarCostDelta.finalDelta !== 0)
  ) {
    messageParts.push(`相关${pointName}已结算`)
  }

  logRouteWriteSuccess({
    scope: "profile-update",
    action: "update-profile",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
    extra: {
      nicknameChanged,
      bioChanged,
      introductionChanged,
      avatarChanged,
      avatarRequiresPointCost,
      emailChanged,
      activityVisibility,
      introductionVisibility,
    },
  })

  revalidateUserSurfaceCache(currentUser.id)

  const updatedProfileSettings = resolveUserProfileSettings(updated.signature)
  const updatedProfile = mapAddonUserProfileRecord({
    ...updated,
    introduction: updatedProfileSettings.introduction,
    activityVisibility: updatedProfileSettings.activityVisibility,
    introductionVisibility: updatedProfileSettings.introductionVisibility,
  })

  await executeAddonActionHook("user.update.after", {
    userId: currentUser.id,
    username: updated.username,
    nicknameChanged,
    bioChanged,
    introductionChanged,
    avatarChanged,
    emailChanged,
    contentAdjusted,
    profile: updatedProfile,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })

  return apiSuccess(toProfileUpdateResponse(updatedProfile), messageParts.join("，"))


}, {
  errorMessage: "保存资料失败",
  logPrefix: "[api/profile/update] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

