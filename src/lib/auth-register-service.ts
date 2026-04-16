import { VerificationChannel } from "@/lib/shared/verification-channel"
import { hashSync } from "bcryptjs"

import {
  createRegisteredUserRecord,
  findRegisterInviterByUsername,
  findRegistrationConflict,
  runRegisterTransaction,
} from "@/db/auth-register-queries"
import {
  createUserLoginLogEntry,
  findInviteCodeRegistrationContext,
  incrementUserInviteCount,
  markInviteCodeAsUsed,
} from "@/db/external-auth-user-queries"
import { readAddonAuthFieldsFromBody } from "@/lib/addon-auth-fields"
import { validateRegisterWithAddonProviders } from "@/lib/addon-auth-providers"
import { apiError } from "@/lib/api-route"
import { verifyRegisterCaptchaWithAddonProviders } from "@/lib/addon-captcha-providers"
import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { enforceSensitiveText } from "@/lib/content-safety"
import { isEmailInWhitelist } from "@/lib/email"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { verifyPowCaptchaSolution } from "@/lib/pow-captcha"
import { getRequestIp } from "@/lib/request-ip"
import { getServerSiteSettings } from "@/lib/site-settings"
import { isEquivalentNickname } from "@/lib/nickname"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { validateAuthPayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

interface RegisterFlowOptions {
  request: Request
  body: unknown
}

interface RegisterFlowResult {
  user: {
    id: number
    username: string
  }
  registerIp: string | null
  invited: boolean
  successMessage?: string
}


interface RegisterPayload {
  username: string
  password: string
  nickname: string
  inviterUsername: string
  inviteCode: string
  email: string
  emailCode: string
  phone: string
  phoneCode: string
  gender: string
}

interface RegisterContext {
  request: Request
  payload: RegisterPayload
  addonFields: ReturnType<typeof readAddonAuthFieldsFromBody>
  body: Record<string, unknown>
  settings: Awaited<ReturnType<typeof getServerSiteSettings>>
  registerIp: string | null
  userAgent: string | null
  nicknameSafety: Awaited<ReturnType<typeof enforceSensitiveText>> | null
}


function assertRegisterPayload(body: unknown, options: { nicknameMinLength: number; nicknameMaxLength: number }): RegisterPayload {
  const validated = validateAuthPayload(body, options)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  return validated.data
}

async function verifyRegisterCaptcha(context: RegisterContext) {
  const captchaToken = typeof context.body.captchaToken === "string" ? context.body.captchaToken.trim() : ""
  const builtinCaptchaCode = typeof context.body.builtinCaptchaCode === "string" ? context.body.builtinCaptchaCode.trim() : ""
  const powNonce = typeof context.body.powNonce === "string" ? context.body.powNonce.trim() : ""

  if (context.settings.registerCaptchaMode === "TURNSTILE") {
    if (!context.settings.turnstileSiteKey || !context.settings.turnstileSecretKey) {
      apiError(500, "站点未完成 Turnstile 验证码配置，请联系管理员")
    }

    if (!captchaToken) {
      apiError(400, "请先完成验证码验证")
    }

    await verifyTurnstileToken(captchaToken, context.registerIp, context.settings.turnstileSecretKey)
  }

  if (context.settings.registerCaptchaMode === "BUILTIN") {
    if (!captchaToken || !builtinCaptchaCode) {
      apiError(400, "请先完成图形验证码验证")
    }

    await verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
  }

  if (context.settings.registerCaptchaMode === "POW") {
    if (!captchaToken || !powNonce) {
      apiError(400, "请先完成工作量证明验证")
    }

    await verifyPowCaptchaSolution({
      challenge: captchaToken,
      nonce: powNonce,
      scope: "register",
      requestIp: context.registerIp,
    })
  }

  await verifyRegisterCaptchaWithAddonProviders({
    request: context.request,
    payload: {
      username: context.payload.username,
      nickname: context.payload.nickname,
      inviterUsername: context.payload.inviterUsername,
      inviteCode: context.payload.inviteCode,
      email: context.payload.email,
      emailCode: context.payload.emailCode,
      phone: context.payload.phone,
      phoneCode: context.payload.phoneCode,
      gender: context.payload.gender,
    },
    registerIp: context.registerIp,
    addonFields: context.addonFields,
  })
}

function verifyRequiredRegisterFields(context: RegisterContext) {
  const { payload, settings } = context

  if (!settings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  if (settings.registerEmailEnabled && settings.registerEmailRequired && !payload.email) {
    apiError(400, "请填写邮箱")
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneRequired && !payload.phone) {
    apiError(400, "请填写手机号")
  }

  if (settings.registerNicknameEnabled && settings.registerNicknameRequired && !payload.nickname) {
    apiError(400, "请填写昵称")
  }

  if (settings.registerGenderEnabled && settings.registerGenderRequired && payload.gender === "unknown") {
    apiError(400, "请选择性别")
  }

  if (settings.registrationRequireInviteCode && !payload.inviteCode) {
    apiError(400, "当前注册必须填写邀请码")
  }

  if (settings.registerEmailEnabled && settings.registerEmailVerification) {
    if (!payload.email) {
      apiError(400, "当前注册要求邮箱验证，请填写邮箱")
    }

    if (!payload.emailCode) {
      apiError(400, "请填写邮箱验证码")
    }
  }

  if (settings.registerEmailWhitelistEnabled && payload.email && !isEmailInWhitelist(payload.email, settings.registerEmailWhitelistDomains)) {
    apiError(400, "该邮箱后缀不在注册白名单内")
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneVerification) {
    if (!payload.phone) {
      apiError(400, "当前注册要求手机验证，请填写手机号")
    }

    if (!payload.phoneCode) {
      apiError(400, "请填写手机验证码")
    }
  }
}

async function ensureRegisterTargetsAvailable(context: RegisterContext) {
  const { payload, nicknameSafety } = context
  const sanitizedNickname = nicknameSafety?.sanitizedText ?? payload.nickname

  const existingUser = await findRegistrationConflict({
    username: payload.username,
    email: payload.email || undefined,
    phone: payload.phone || undefined,
    nickname: payload.nickname ? sanitizedNickname : undefined,
  })

  if (existingUser?.username === payload.username) {
    apiError(409, "用户名已存在")
  }

  if (payload.email && existingUser?.email === payload.email) {
    apiError(409, "邮箱已被使用")
  }

  if (payload.phone && existingUser?.phone === payload.phone) {
    apiError(409, "手机号已被使用")
  }

  if (payload.nickname && existingUser?.nickname && isEquivalentNickname(existingUser.nickname, sanitizedNickname)) {
    apiError(409, "昵称已被使用")
  }
}

async function verifyRegisterContactCodes(context: RegisterContext) {
  const { payload, settings } = context

  if (settings.registerEmailEnabled && settings.registerEmailVerification && payload.email && payload.emailCode) {
    await verifyCode({
      channel: VerificationChannel.EMAIL,
      target: payload.email,
      code: payload.emailCode,
    })
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneVerification && payload.phone && payload.phoneCode) {
    await verifyCode({
      channel: VerificationChannel.PHONE,
      target: payload.phone,
      code: payload.phoneCode,
    })
  }
}

export async function createRegisterFlow(options: RegisterFlowOptions): Promise<RegisterFlowResult> {
  const settings = await getServerSiteSettings()
  const payload = assertRegisterPayload(options.body, {
    nicknameMinLength: settings.registerNicknameMinLength,
    nicknameMaxLength: settings.registerNicknameMaxLength,
  })
  const body = options.body as Record<string, unknown>
  const addonFields = readAddonAuthFieldsFromBody(options.body)
  const registerIp = getRequestIp(options.request)
  const userAgent = options.request.headers.get("user-agent")
  const nicknameSafety = payload.nickname
    ? await enforceSensitiveText({ scene: "profile.nickname", text: payload.nickname })
    : null

  const context: RegisterContext = {
    request: options.request,
    payload,
    addonFields,
    body,
    settings,
    registerIp,
    userAgent,
    nicknameSafety,
  }

  verifyRequiredRegisterFields(context)
  await verifyRegisterCaptcha(context)
  await ensureRegisterTargetsAvailable(context)
  await verifyRegisterContactCodes(context)
  await validateRegisterWithAddonProviders({
    request: options.request,
    payload: {
      username: payload.username,
      nickname: payload.nickname,
      inviterUsername: payload.inviterUsername,
      inviteCode: payload.inviteCode,
      email: payload.email,
      emailCode: payload.emailCode,
      phone: payload.phone,
      phoneCode: payload.phoneCode,
      gender: payload.gender,
    },
    registerIp,
    addonFields,
  })
  const sanitizedNickname = nicknameSafety?.sanitizedText || payload.username
  const requestUrl = new URL(options.request.url)

  await executeAddonActionHook("auth.register.before", {
    username: payload.username,
    nickname: sanitizedNickname,
    inviterUsername: payload.inviterUsername,
    inviteCode: payload.inviteCode,
    email: payload.email,
    phone: payload.phone,
    gender: payload.gender,
    registerIp,
  }, {
    request: options.request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })

  const inviterReward = Math.max(0, settings.inviteRewardInviter)
  const inviteeReward = Math.max(0, settings.inviteRewardInvitee)
  const registerInitialPoints = Math.max(0, settings.registerInitialPoints)

  const user = await runRegisterTransaction(async (tx) => {
    let inviter: null | { id: number; username: string; points: number } = null
    let inviteCodeRecord: null | { id: string; code: string } = null

    if (payload.inviterUsername) {
      inviter = await findRegisterInviterByUsername(payload.inviterUsername, tx)

      if (!inviter) {
        apiError(404, "邀请人不存在")
      }

      if (inviter.username === payload.username) {
        apiError(400, "邀请人不能填写自己")
      }
    }

    if (payload.inviteCode) {
      const foundCode = await findInviteCodeRegistrationContext(payload.inviteCode, tx)

      if (!foundCode) {
        apiError(404, "邀请码不存在")
      }

      if (foundCode.usedById) {
        apiError(409, "邀请码已被使用")
      }

      inviteCodeRecord = { id: foundCode.id, code: foundCode.code }

      if (!inviter && foundCode.createdBy) {
        if (foundCode.createdBy.username === payload.username) {
          apiError(400, "不能使用自己生成的邀请码注册")
        }

        inviter = {
          id: foundCode.createdBy.id,
          username: foundCode.createdBy.username,
          points: foundCode.createdBy.points,
        }
      }
    }

    const inviteeRegisterReward = inviter && inviteeReward > 0 ? inviteeReward : 0

    const createdUser = await createRegisteredUserRecord({
      tx,
      username: payload.username,
      email: settings.registerEmailEnabled ? payload.email || null : null,
      phone: settings.registerPhoneEnabled ? payload.phone || null : null,
      emailVerifiedAt: settings.registerEmailEnabled && settings.registerEmailVerification ? new Date() : null,
      phoneVerifiedAt: settings.registerPhoneEnabled && settings.registerPhoneVerification ? new Date() : null,
      passwordHash: hashSync(payload.password, 10),
      nickname: settings.registerNicknameEnabled ? sanitizedNickname : payload.username,
      gender: settings.registerGenderEnabled ? payload.gender : null,
      inviterId: inviter?.id,
      lastLoginAt: new Date(),
      lastLoginIp: registerIp,
    })

    if (inviteCodeRecord) {
      await markInviteCodeAsUsed(inviteCodeRecord.id, createdUser.id, tx)
    }

    if (inviter) {
      await incrementUserInviteCount(inviter.id, tx)
    }

    await createUserLoginLogEntry(createdUser.id, registerIp, userAgent, tx)

    if (inviter && inviterReward > 0) {
      const preparedInviterReward = await prepareScopedPointDelta({
        scopeKey: "INVITE_REWARD_INVITER",
        baseDelta: inviterReward,
        userId: inviter.id,
      })

      await applyPointDelta({
        tx,
        userId: inviter.id,
        beforeBalance: inviter.points,
        prepared: preparedInviterReward,
        pointName: settings.pointName,
        reason: `邀请用户 ${createdUser.username} 注册奖励`,
      })
    }

    let pointBalanceCursor = 0

    if (registerInitialPoints > 0) {
      const preparedRegisterInitialReward = await prepareScopedPointDelta({
        scopeKey: "REGISTER_INITIAL_REWARD",
        baseDelta: registerInitialPoints,
        userId: createdUser.id,
      })

      const registerInitialRewardResult = await applyPointDelta({
        tx,
        userId: createdUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: preparedRegisterInitialReward,
        pointName: settings.pointName,
        reason: "新用户注册赠送积分",
      })

      pointBalanceCursor = registerInitialRewardResult.afterBalance
    }

    if (inviter && inviteeRegisterReward > 0) {
      const preparedInviteeReward = await prepareScopedPointDelta({
        scopeKey: "INVITE_REWARD_INVITEE",
        baseDelta: inviteeRegisterReward,
        userId: createdUser.id,
      })

      const inviteeRewardResult = await applyPointDelta({
        tx,
        userId: createdUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: preparedInviteeReward,
        pointName: settings.pointName,
        reason: `通过 ${inviter.username} 的邀请注册奖励`,
      })

      pointBalanceCursor = inviteeRewardResult.afterBalance
    }

    return createdUser
  })

  return {
    user,
    registerIp,
    invited: Boolean(payload.inviterUsername || payload.inviteCode),
    successMessage: nicknameSafety?.wasReplaced ? "注册成功，昵称已按规则替换" : "注册成功",
  }
}
