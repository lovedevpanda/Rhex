import { ChangeType, VerificationChannel } from "@/db/types"
import { hashSync } from "bcryptjs"
import { NextResponse } from "next/server"

import { prisma } from "@/db/client"
import { apiError, apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"

import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { enforceSensitiveText } from "@/lib/content-safety"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { getSiteSettings } from "@/lib/site-settings"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { validateAuthPayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"


export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const validated = validateAuthPayload(body)


  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { username, password, nickname, inviterUsername, inviteCode, email, emailCode, phone, phoneCode, gender } = validated.data
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken.trim() : ""
  const builtinCaptchaCode = typeof body.builtinCaptchaCode === "string" ? body.builtinCaptchaCode.trim() : ""
  const nicknameSafety = nickname ? await enforceSensitiveText({ scene: "profile.nickname", text: nickname }) : null

  const settings = await getSiteSettings()

  if (!settings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  if (settings.registerCaptchaMode === "TURNSTILE") {
    if (!settings.turnstileSiteKey || !process.env.TURNSTILE_SECRET_KEY?.trim()) {
      apiError(500, "站点未完成 Turnstile 验证码配置，请联系管理员")
    }

    if (!captchaToken) {
      apiError(400, "请先完成验证码验证")
    }

    await verifyTurnstileToken(captchaToken, getRequestIp(request))
  }

  if (settings.registerCaptchaMode === "BUILTIN") {
    if (!captchaToken || !builtinCaptchaCode) {
      apiError(400, "请先完成图形验证码验证")
    }

    verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
  }

  if (settings.registerEmailEnabled && settings.registerEmailRequired && !email) {
    apiError(400, "请填写邮箱")
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneRequired && !phone) {
    apiError(400, "请填写手机号")
  }

  if (settings.registerNicknameEnabled && settings.registerNicknameRequired && !nickname) {
    apiError(400, "请填写昵称")
  }

  if (settings.registerGenderEnabled && settings.registerGenderRequired && gender === "unknown") {
    apiError(400, "请选择性别")
  }

  if (settings.registrationRequireInviteCode && !inviteCode) {
    apiError(400, "当前注册必须填写邀请码")
  }

  if (settings.registerEmailEnabled && settings.registerEmailVerification) {
    if (!email) {
      apiError(400, "当前注册要求邮箱验证，请填写邮箱")
    }

    if (!emailCode) {
      apiError(400, "请填写邮箱验证码")
    }
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneVerification) {
    if (!phone) {
      apiError(400, "当前注册要求手机验证，请填写手机号")
    }

    if (!phoneCode) {
      apiError(400, "请填写手机验证码")
    }
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
        ...(nickname ? [{ nickname: nicknameSafety?.sanitizedText ?? nickname }] : []),
      ],
    },
    select: {
      username: true,
      email: true,
      phone: true,
      nickname: true,
    },
  })

  if (existingUser?.username === username) {
    apiError(409, "用户名已存在")
  }

  if (email && existingUser?.email === email) {
    apiError(409, "邮箱已被使用")
  }

  if (phone && existingUser?.phone === phone) {
    apiError(409, "手机号已被使用")
  }

  if (nickname && existingUser?.nickname === (nicknameSafety?.sanitizedText ?? nickname)) {
    apiError(409, "昵称已被使用")
  }

  if (settings.registerEmailEnabled && settings.registerEmailVerification && email && emailCode) {
    await verifyCode({
      channel: VerificationChannel.EMAIL,
      target: email,
      code: emailCode,
    })
  }

  if (settings.registerPhoneEnabled && settings.registerPhoneVerification && phone && phoneCode) {
    await verifyCode({
      channel: VerificationChannel.PHONE,
      target: phone,
      code: phoneCode,
    })
  }

  const registerIp = getRequestIp(request)
  const userAgent = request.headers.get("user-agent")
  const inviterReward = Math.max(0, settings.inviteRewardInviter)
  const inviteeReward = Math.max(0, settings.inviteRewardInvitee)

  const user = await prisma.$transaction(async (tx) => {
    let inviter = null as null | { id: number; username: string }
    let inviteCodeRecord = null as null | { id: string; code: string }

    if (inviterUsername) {
      inviter = await tx.user.findUnique({
        where: { username: inviterUsername },
        select: { id: true, username: true },
      })

      if (!inviter) {
        throw new Error("邀请人不存在")
      }

      if (inviter.username === username) {
        throw new Error("邀请人不能填写自己")
      }
    }

    if (inviteCode) {
      const foundCode = await tx.inviteCode.findUnique({
        where: { code: inviteCode },
        select: { id: true, code: true, usedById: true, createdById: true, createdBy: { select: { username: true, id: true } } },
      })

      if (!foundCode) {
        throw new Error("邀请码不存在")
      }

      if (foundCode.usedById) {
        throw new Error("邀请码已被使用")
      }

      inviteCodeRecord = { id: foundCode.id, code: foundCode.code }

      if (!inviter && foundCode.createdBy) {
        if (foundCode.createdBy.username === username) {
          throw new Error("不能使用自己生成的邀请码注册")
        }

        inviter = { id: foundCode.createdBy.id, username: foundCode.createdBy.username }
      }
    }

    const createdUser = await tx.user.create({
      data: {
        username,
        email: settings.registerEmailEnabled ? email || null : null,
        phone: settings.registerPhoneEnabled ? phone || null : null,
        emailVerifiedAt: settings.registerEmailEnabled && settings.registerEmailVerification ? new Date() : null,
        phoneVerifiedAt: settings.registerPhoneEnabled && settings.registerPhoneVerification ? new Date() : null,
        passwordHash: hashSync(password, 10),
        nickname: settings.registerNicknameEnabled ? (nicknameSafety?.sanitizedText || username) : username,
        gender: settings.registerGenderEnabled ? gender : null,
        status: "ACTIVE",
        role: "USER",
        inviterId: inviter?.id,
        lastLoginAt: new Date(),
        lastLoginIp: registerIp,
        points: inviteeReward,
      },
    })

    if (inviteCodeRecord) {
      await tx.inviteCode.update({
        where: { id: inviteCodeRecord.id },
        data: {
          usedById: createdUser.id,
          usedAt: new Date(),
        },
      })
    }

    if (inviter) {
      await tx.user.update({
        where: { id: inviter.id },
        data: {
          inviteCount: {
            increment: 1,
          },
          points: {
            increment: inviterReward,
          },
        },
      })
    }

    await tx.userLoginLog.create({
      data: {
        userId: createdUser.id,
        ip: registerIp,
        userAgent,
      },
    })

    if (inviter && inviterReward > 0) {
      await tx.pointLog.create({
        data: {
          userId: inviter.id,
          changeType: ChangeType.INCREASE,
          changeValue: inviterReward,
          reason: `邀请用户 ${createdUser.username} 注册奖励${settings.pointName}`,
        },
      })
    }

    if (inviter && inviteeReward > 0) {
      await tx.pointLog.create({
        data: {
          userId: createdUser.id,
          changeType: ChangeType.INCREASE,
          changeValue: inviteeReward,
          reason: `通过 ${inviter.username} 的邀请注册奖励${settings.pointName}`,
        },
      })
    }

    return createdUser
  })

  const response = NextResponse.json(apiSuccess({ username: user.username }, nicknameSafety?.shouldReview ? "注册成功，昵称已按规则处理" : "success"))
  const sessionToken = await createSessionToken(user.username)
  response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())

  logRouteWriteSuccess({
    scope: "auth-register",
    action: "register",
  }, {
    userId: user.id,
    targetId: user.username,
    extra: {
      registerIp,
      invited: Boolean(inviterUsername || inviteCode),
    },
  })

  return response

}, {
  errorMessage: "注册失败",
  logPrefix: "[api/auth/register] unexpected error",
})

