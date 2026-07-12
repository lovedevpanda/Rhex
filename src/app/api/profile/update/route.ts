import { prisma } from "@/db/client"
import { findUserByNicknameInsensitive } from "@/db/user-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"

import type { AddonUserProfileRecord } from "@/addons-host/types"
import { executeAddonActionHook, executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"
import { resolveHookedOptionalStringValue, resolveHookedStringValue } from "@/lib/addon-hook-values"
import { verifySmsVerificationCodeWithAddonProviders } from "@/lib/addon-sms-verification"
import { resolveUserProfileIntroductionPermission } from "@/lib/addon-user-profile-introduction-permissions"
import { enforceSensitiveText } from "@/lib/content-safety"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { validateProfilePayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSiteSettings } from "@/lib/site-settings"
import { findUsernameSensitiveWord } from "@/lib/username-sensitive-words"
import { revalidateUserProfileMutation } from "@/lib/user-profile-revalidation"
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors"
import { isUserProfileVisibility, mapLegacyVisibilityBoolean, mergeUserProfileSettings, resolveUserProfileSettings, type UserProfileVisibility } from "@/lib/user-profile-settings"
import { withRequestWriteGuard } from "@/lib/write-guard"
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
  phone: string
  phoneVerifiedAt?: string | null
  activityVisibility: UserProfileVisibility
  introductionVisibility: UserProfileVisibility
  points: number
  avatarPointCost: number
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
  phone: string | null
  phoneVerifiedAt?: Date | string | null
  activityVisibility: UserProfileVisibility
  introductionVisibility: UserProfileVisibility
  points: number
}, avatarPointCost = 0): ProfileUpdateResponse {
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
    phone: input.phone ?? "",
    phoneVerifiedAt: typeof input.phoneVerifiedAt === "string"
      ? input.phoneVerifiedAt
      : input.phoneVerifiedAt?.toISOString() ?? null,
    activityVisibility: input.activityVisibility,
    introductionVisibility: input.introductionVisibility,
    points: input.points,
    avatarPointCost,
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
  phone: string | null
  phoneVerifiedAt?: Date | string | null
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
    phone: input.phone,
    phoneVerifiedAt: typeof input.phoneVerifiedAt === "string"
      ? input.phoneVerifiedAt
      : input.phoneVerifiedAt?.toISOString() ?? null,
    activityVisibility: input.activityVisibility,
    introductionVisibility: input.introductionVisibility,
    points: input.points,
  }
}

export const POST = createUserRouteHandler<ProfileUpdateResponse>(async ({ request, currentUser }) => {

  const body = await readJsonBody(request)

  return withRequestWriteGuard({
    scope: "profile-update",
    request,
    userId: currentUser.id,
    cooldownMs: 750,
    cooldownMessage: "资料保存操作过于频繁，请稍后再试",
    dedupeKey: JSON.stringify(body),
    dedupeWindowMs: 10_000,
    releaseOnError: true,
  }, async () => {
    const requestUrl = new URL(request.url)
    const settings = await getSiteSettings()
    const updateScope = typeof body.updateScope === "string" ? body.updateScope.trim() : ""

    if (updateScope === "avatar") {
      const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath.trim() : ""

      if (avatarPath.length > 1024) {
        apiError(400, "头像地址过长")
      }

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
          phone: true,
          phoneVerifiedAt: true,
          signature: true,
          points: true,
        },
      })

      if (!dbUser) {
        apiError(404, "用户不存在")
      }

      const currentProfileSettings = resolveUserProfileSettings(dbUser.signature)
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
        phone: dbUser.phone,
        phoneVerifiedAt: dbUser.phoneVerifiedAt,
        activityVisibility: currentProfileSettings.activityVisibility,
        introductionVisibility: currentProfileSettings.introductionVisibility,
        points: dbUser.points,
      })
      const currentAvatarPath = (dbUser.avatarPath ?? "").trim()
      const avatarChanged = currentAvatarPath !== avatarPath
      const avatarRequiresPointCost = avatarChanged && currentAvatarPath.length > 0
      const avatarChangePointCost = Math.max(0, resolveVipTierPrice(currentUser, {
        normal: settings.avatarChangePointCost,
        vip1: settings.avatarChangeVip1PointCost,
        vip2: settings.avatarChangeVip2PointCost,
        vip3: settings.avatarChangeVip3PointCost,
      }))
      const avatarCostDelta = avatarRequiresPointCost
        ? await prepareScopedPointDelta({
            scopeKey: "AVATAR_CHANGE",
            baseDelta: -avatarChangePointCost,
            userId: currentUser.id,
          })
        : { scopeKey: "AVATAR_CHANGE" as const, baseDelta: 0, finalDelta: 0, appliedRules: [] }
      const avatarPointCost = Math.max(0, -avatarCostDelta.finalDelta)
      const pointName = settings.pointName?.trim() || "积分"

      if (avatarPointCost > 0 && dbUser.points < avatarPointCost) {
        apiError(400, `保存头像需要 ${avatarPointCost} ${pointName}，当前余额不足`)
      }

      await executeAddonActionHook("user.update.before", {
        userId: currentUser.id,
        username: dbUser.username,
        currentProfile,
        nickname: dbUser.nickname ?? "",
        bio: dbUser.bio ?? "",
        introduction: currentProfileSettings.introduction,
        gender: dbUser.gender ?? "unknown",
        avatarPath,
        email: dbUser.email,
        phone: dbUser.phone,
        activityVisibility: currentProfileSettings.activityVisibility,
        introductionVisibility: currentProfileSettings.introductionVisibility,
        nicknameChanged: false,
        bioChanged: false,
        introductionChanged: false,
        avatarChanged,
        emailChanged: false,
        phoneChanged: false,
        contentAdjusted: false,
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
            avatarPath: avatarPath || null,
          },
        })

        if (avatarRequiresPointCost && avatarCostDelta.finalDelta !== 0) {
          await applyPointDelta({
            tx,
            userId: currentUser.id,
            beforeBalance: dbUser.points,
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
            phone: true,
            phoneVerifiedAt: true,
            signature: true,
            points: true,
          },
        })
      })

      logRouteWriteSuccess({
        scope: "profile-update",
        action: "update-avatar",
      }, {
        userId: currentUser.id,
        targetId: String(currentUser.id),
        extra: {
          avatarChanged,
          avatarRequiresPointCost,
        },
      })

      revalidateUserProfileMutation({
        userId: currentUser.id,
        username: updated.username,
      })

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
        nicknameChanged: false,
        bioChanged: false,
        introductionChanged: false,
        avatarChanged,
        emailChanged: false,
        phoneChanged: false,
        contentAdjusted: false,
        profile: updatedProfile,
      }, {
        request,
        pathname: requestUrl.pathname,
        searchParams: requestUrl.searchParams,
      })

      const message = avatarPointCost > 0
        ? `头像已保存，相关${pointName}已结算`
        : "头像已保存"

      return apiSuccess(toProfileUpdateResponse(updatedProfile, avatarPointCost), message)
    }

  const profileIntroductionEditPermission = settings.userProfileIntroductionEnabled
    ? await resolveUserProfileIntroductionPermission({
        action: "edit",
        owner: currentUser,
        viewer: currentUser,
        request,
      })
    : { allowed: false, reason: "个人介绍功能已关闭。" }
  const profileIntroductionEnabled = settings.userProfileIntroductionEnabled && profileIntroductionEditPermission.allowed
  const introductionSubmitted = Object.prototype.hasOwnProperty.call(body, "introduction")
  const introductionVisibilitySubmitted = Object.prototype.hasOwnProperty.call(body, "introductionVisibility")

  if (
    settings.userProfileIntroductionEnabled
    && !profileIntroductionEditPermission.allowed
    && (introductionSubmitted || introductionVisibilitySubmitted)
  ) {
    apiError(403, profileIntroductionEditPermission.reason || "当前账号暂不可使用个人介绍。")
  }

  const profileValidationBody = profileIntroductionEnabled
    ? body
    : { ...body, introduction: "" }

  const validated = validateProfilePayload(profileValidationBody, {
    nicknameMinLength: settings.registerNicknameMinLength,
    nicknameMaxLength: settings.registerNicknameMaxLength,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const email = validated.data.email
  const phone = validated.data.phone
  const gender = validated.data.gender || "unknown"
  const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath.trim() : ""
  const emailCode = typeof body.emailCode === "string" ? body.emailCode.trim() : ""
  const phoneCode = typeof body.phoneCode === "string" ? body.phoneCode.trim() : ""

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
      phone: true,
      phoneVerifiedAt: true,
      signature: true,
      points: true,
    },
  })

  if (!dbUser) {
    apiError(404, "用户不存在")
  }

  const nextEmail = email || null
  const nextPhone = phone || null
  const currentProfileSettings = resolveUserProfileSettings(dbUser.signature)
  const activityVisibilityInput = typeof body.activityVisibility === "string" ? body.activityVisibility.trim().toUpperCase() : null
  const introductionVisibilityInput = profileIntroductionEnabled && typeof body.introductionVisibility === "string" ? body.introductionVisibility.trim().toUpperCase() : null

  if (activityVisibilityInput && !isUserProfileVisibility(activityVisibilityInput)) {
    apiError(400, "活动轨迹可见范围参数不正确")
  }

  if (introductionVisibilityInput && !isUserProfileVisibility(introductionVisibilityInput)) {
    apiError(400, "介绍可见范围参数不正确")
  }

  const activityVisibility = (activityVisibilityInput && isUserProfileVisibility(activityVisibilityInput) ? activityVisibilityInput : null)
    ?? (typeof body.activityVisibilityPublic === "boolean" ? mapLegacyVisibilityBoolean(body.activityVisibilityPublic) : null)
    ?? currentProfileSettings.activityVisibility
  const introductionVisibility = profileIntroductionEnabled
    ? (introductionVisibilityInput && isUserProfileVisibility(introductionVisibilityInput) ? introductionVisibilityInput : null)
      ?? currentProfileSettings.introductionVisibility
    : currentProfileSettings.introductionVisibility
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
    phone: dbUser.phone,
    phoneVerifiedAt: dbUser.phoneVerifiedAt,
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
    nextPhone,
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
  let hookedIntroduction = currentProfileSettings.introduction
  let introductionHookAdjusted = false

  if (profileIntroductionEnabled) {
    const introductionHookResult = await executeAddonWaterfallHook("user.profile.introduction.value", validated.data.introduction, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      payload: profileHookPayload,
    })
    const resolvedIntroduction = resolveHookedOptionalStringValue(validated.data.introduction, introductionHookResult.value)
    hookedIntroduction = resolvedIntroduction.value
    introductionHookAdjusted = resolvedIntroduction.changed
  }

  const { value: hookedNickname, changed: nicknameHookAdjusted } = resolveHookedStringValue(validated.data.nickname, nicknameHookResult.value)
  const { value: hookedBio, changed: bioHookAdjusted } = resolveHookedOptionalStringValue(validated.data.bio, bioHookResult.value)
  const nicknameSafety = await enforceSensitiveText({ scene: "profile.nickname", text: hookedNickname })
  const bioSafety = await enforceSensitiveText({ scene: "profile.bio", text: hookedBio })
  let nextIntroduction = currentProfileSettings.introduction
  let introductionSafetyWasReplaced = false

  if (profileIntroductionEnabled) {
    const introductionSafety = await enforceSensitiveText({ scene: "profile.introduction", text: hookedIntroduction })
    nextIntroduction = introductionSafety.sanitizedText
    introductionSafetyWasReplaced = introductionSafety.wasReplaced
  }

  const nextNickname = nicknameSafety.sanitizedText
  const nextBio = bioSafety.sanitizedText
  const nextSignature = mergeUserProfileSettings(dbUser.signature, {
    activityVisibility,
    ...(profileIntroductionEnabled ? {
      introductionVisibility,
      introduction: nextIntroduction,
    } : {}),
  })
  const emailChanged = (dbUser.email ?? null) !== nextEmail
  const phoneChanged = (dbUser.phone ?? null) !== nextPhone
  const currentNickname = (dbUser.nickname ?? "").trim()
  const currentBio = (dbUser.bio ?? "").trim()
  const currentIntroduction = currentProfileSettings.introduction.trim()
  const currentAvatarPath = (dbUser.avatarPath ?? "").trim()
  const nicknameChanged = currentNickname !== nextNickname

  if (nicknameChanged) {
    const matchedNicknameSensitiveWord = findUsernameSensitiveWord(nextNickname, settings)
    if (matchedNicknameSensitiveWord) {
      apiError(400, `昵称包含敏感词：${matchedNicknameSensitiveWord}`)
    }
  }

  const bioChanged = currentBio !== nextBio
  const introductionChanged = profileIntroductionEnabled && currentIntroduction !== nextIntroduction
  const avatarChanged = currentAvatarPath !== avatarPath
  const contentAdjusted = Boolean(
    nicknameHookAdjusted
    || bioHookAdjusted
    || introductionHookAdjusted
    || nicknameSafety.wasReplaced
    || bioSafety.wasReplaced
    || introductionSafetyWasReplaced
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
  const avatarPointCost = Math.max(0, -avatarCostDelta.finalDelta)
  const totalRequiredPoints = [
    nicknameCostDelta.finalDelta,
    introductionCostDelta.finalDelta,
    avatarCostDelta.finalDelta,
  ].filter((item) => item < 0).reduce((sum, item) => sum + Math.abs(item), 0)

  if (dbUser.emailVerifiedAt && emailChanged) {
    apiError(400, "邮箱已验证，不能再修改邮箱地址")
  }

  if (dbUser.phoneVerifiedAt && phoneChanged) {
    apiError(400, "手机号已验证，不能再修改手机号")
  }

  let emailVerifiedAt = dbUser.emailVerifiedAt
  let phoneVerifiedAt = dbUser.phoneVerifiedAt

  if (!dbUser.emailVerifiedAt && nextEmail && emailCode) {
    await verifyCode({
      channel: VerificationChannel.EMAIL,
      target: nextEmail,
      code: emailCode,
    })
    emailVerifiedAt = new Date()
  }

  if (!dbUser.phoneVerifiedAt && nextPhone && phoneCode) {
    await verifySmsVerificationCodeWithAddonProviders({
      request,
      phone: nextPhone,
      code: phoneCode,
      purpose: "register",
      userId: currentUser.id,
    })
    phoneVerifiedAt = new Date()
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

  if (nextPhone) {
    const existingPhoneUser = await prisma.user.findFirst({
      where: {
        phone: nextPhone,
        id: {
          not: currentUser.id,
        },
      },
      select: { id: true },
    })

    if (existingPhoneUser) {
      apiError(409, "手机号已被使用")
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
    phone: nextPhone,
    activityVisibility,
    introductionVisibility,
    nicknameChanged,
    bioChanged,
    introductionChanged,
    avatarChanged,
    emailChanged,
    phoneChanged,
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
        phone: nextPhone,
        phoneVerifiedAt,
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
        phone: true,
        phoneVerifiedAt: true,
        signature: true,
        points: true,
      },
    })
  }).catch((error: unknown) => {
    if (isPrismaUniqueConstraintError(error, "email")) {
      apiError(409, "邮箱已被使用")
    }

    if (isPrismaUniqueConstraintError(error, "phone")) {
      apiError(409, "手机号已被使用")
    }

    if (isPrismaUniqueConstraintError(error, "nickname")) {
      apiError(409, "昵称已被使用")
    }

    throw error
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
      phoneChanged,
      activityVisibility,
      introductionVisibility,
    },
  })

  revalidateUserProfileMutation({
    userId: currentUser.id,
    username: updated.username,
  })

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
    phoneChanged,
    contentAdjusted,
    profile: updatedProfile,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })

    return apiSuccess(toProfileUpdateResponse(updatedProfile, avatarPointCost), messageParts.join("，"))
  })
}, {
  errorMessage: "保存资料失败",
  logPrefix: "[api/profile/update] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
