import { ChangeType, VerificationChannel } from "@/db/types"
import { hashSync } from "bcryptjs"
import { NextResponse } from "next/server"

import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { ContentSafetyError, enforceSensitiveText } from "@/lib/content-safety"
import { hasDatabaseUrl } from "@/lib/db-status"
import { prisma } from "@/db/client"
import { getRequestIp } from "@/lib/request-ip"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { getSiteSettings } from "@/lib/site-settings"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { validateAuthPayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = validateAuthPayload(body)

    if (!validated.success || !validated.data) {
      return NextResponse.json({ code: 400, message: validated.message ?? "参数错误" }, { status: 400 })
    }

    const { username, password, nickname, inviterUsername, inviteCode, email, emailCode, phone, phoneCode, gender } = validated.data
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken.trim() : ""
    const builtinCaptchaCode = typeof body.builtinCaptchaCode === "string" ? body.builtinCaptchaCode.trim() : ""
    const nicknameSafety = nickname ? await enforceSensitiveText({ scene: "profile.nickname", text: nickname }) : null

    if (!hasDatabaseUrl()) {
      return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可注册" }, { status: 503 })
    }

    const settings = await getSiteSettings()

    if (!settings.registrationEnabled) {
      return NextResponse.json({ code: 403, message: "当前站点已关闭注册" }, { status: 403 })
    }

    if (settings.registerCaptchaMode === "TURNSTILE") {
      if (!settings.turnstileSiteKey || !process.env.TURNSTILE_SECRET_KEY?.trim()) {
        return NextResponse.json({ code: 500, message: "站点未完成 Turnstile 验证码配置，请联系管理员" }, { status: 500 })
      }

      if (!captchaToken) {
        return NextResponse.json({ code: 400, message: "请先完成验证码验证" }, { status: 400 })
      }

      await verifyTurnstileToken(captchaToken, getRequestIp(request))
    }

    if (settings.registerCaptchaMode === "BUILTIN") {
      if (!captchaToken || !builtinCaptchaCode) {
        return NextResponse.json({ code: 400, message: "请先完成图形验证码验证" }, { status: 400 })
      }

      verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
    }

    if (settings.registerEmailEnabled && settings.registerEmailRequired && !email) {
      return NextResponse.json({ code: 400, message: "请填写邮箱" }, { status: 400 })
    }

    if (settings.registerPhoneEnabled && settings.registerPhoneRequired && !phone) {
      return NextResponse.json({ code: 400, message: "请填写手机号" }, { status: 400 })
    }

    if (settings.registerNicknameEnabled && settings.registerNicknameRequired && !nickname) {
      return NextResponse.json({ code: 400, message: "请填写昵称" }, { status: 400 })
    }

    if (settings.registerGenderEnabled && settings.registerGenderRequired && gender === "unknown") {
      return NextResponse.json({ code: 400, message: "请选择性别" }, { status: 400 })
    }

    if (settings.registrationRequireInviteCode && !inviteCode) {
      return NextResponse.json({ code: 400, message: "当前注册必须填写邀请码" }, { status: 400 })
    }

    if (settings.registerEmailEnabled && settings.registerEmailVerification) {
      if (!email) {
        return NextResponse.json({ code: 400, message: "当前注册要求邮箱验证，请填写邮箱" }, { status: 400 })
      }

      if (!emailCode) {
        return NextResponse.json({ code: 400, message: "请填写邮箱验证码" }, { status: 400 })
      }
    }

    if (settings.registerPhoneEnabled && settings.registerPhoneVerification) {
      if (!phone) {
        return NextResponse.json({ code: 400, message: "当前注册要求手机验证，请填写手机号" }, { status: 400 })
      }

      if (!phoneCode) {
        return NextResponse.json({ code: 400, message: "请填写手机验证码" }, { status: 400 })
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
      return NextResponse.json({ code: 409, message: "用户名已存在" }, { status: 409 })
    }

    if (email && existingUser?.email === email) {
      return NextResponse.json({ code: 409, message: "邮箱已被使用" }, { status: 409 })
    }

    if (phone && existingUser?.phone === phone) {
      return NextResponse.json({ code: 409, message: "手机号已被使用" }, { status: 409 })
    }

    if (nickname && existingUser?.nickname === (nicknameSafety?.sanitizedText ?? nickname)) {
      return NextResponse.json({ code: 409, message: "昵称已被使用" }, { status: 409 })
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

    const response = NextResponse.json({
      code: 0,
      message: nicknameSafety?.shouldReview ? "注册成功，昵称已按规则处理" : "success",
      data: { username: user.username },
    })

    const sessionToken = await createSessionToken(user.username)
    response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())

    return response
  } catch (error) {
    console.error(error)
    if (error instanceof ContentSafetyError) {
      return NextResponse.json({ code: 400, message: error.message }, { status: error.statusCode })
    }
    const message = error instanceof Error && error.message ? error.message : "注册失败"
    return NextResponse.json({ code: 500, message }, { status: 500 })
  }
}
