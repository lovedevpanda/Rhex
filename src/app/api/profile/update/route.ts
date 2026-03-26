import { VerificationChannel, ChangeType, RelatedType } from "@/db/types"
import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { ContentSafetyError, enforceSensitiveText } from "@/lib/content-safety"
import { hasDatabaseUrl } from "@/lib/db-status"
import { prisma } from "@/db/client"
import { getRequestIp } from "@/lib/request-ip"
import { validateProfilePayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"
import { isPublicRouteError } from "@/lib/public-route-error"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  const body = await request.json()
  const validated = validateProfilePayload(body)

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  if (!validated.success || !validated.data) {
    return NextResponse.json({ code: 400, message: validated.message ?? "参数错误" }, { status: 400 })
  }

  try {
    const nicknameSafety = await enforceSensitiveText({ scene: "profile.nickname", text: validated.data.nickname })
    const bioSafety = await enforceSensitiveText({ scene: "profile.bio", text: validated.data.bio })
    const email = validated.data.email
    const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath.trim() : ""
    const emailCode = typeof body.emailCode === "string" ? body.emailCode.trim() : ""

    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        code: 0,
        message: "success",
        data: {
          username: currentUser.username,
          nickname: nicknameSafety.sanitizedText,
          bio: bioSafety.sanitizedText,
          avatarPath,
          email,
          points: currentUser.points,
        },
      })
    }

    const [dbUser, settings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: currentUser.id },
        select: {
          id: true,
          username: true,
          nickname: true,
          email: true,
          emailVerifiedAt: true,
          points: true,
        },
      }),
      prisma.siteSetting.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          pointName: true,
          nicknameChangePointCost: true,
        },
      }),
    ])

    if (!dbUser) {
      return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 })
    }

    const nextNickname = nicknameSafety.sanitizedText
    const nextEmail = email || null
    const emailChanged = (dbUser.email ?? null) !== nextEmail
    const currentNickname = (dbUser.nickname ?? "").trim()
    const nicknameChanged = currentNickname !== nextNickname
    const nicknameChangePointCost = Math.max(0, settings?.nicknameChangePointCost ?? 0)
    const pointName = settings?.pointName?.trim() || "积分"

    if (dbUser.emailVerifiedAt && emailChanged) {
      return NextResponse.json({ code: 400, message: "邮箱已验证，不能再修改邮箱地址" }, { status: 400 })
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
          email: nextEmail,
          id: {
            not: currentUser.id,
          },
        },
        select: { id: true },
      })

      if (existingEmailUser) {
        return NextResponse.json({ code: 409, message: "邮箱已被使用" }, { status: 409 })
      }
    }

    const existingNicknameUser = await prisma.user.findFirst({
      where: {
        nickname: nextNickname,
        id: {
          not: currentUser.id,
        },
      },
      select: { id: true },
    })

    if (existingNicknameUser) {
      return NextResponse.json({ code: 409, message: "昵称已被使用" }, { status: 409 })
    }

    if (nicknameChanged && nicknameChangePointCost > 0 && dbUser.points < nicknameChangePointCost) {
      return NextResponse.json({ code: 400, message: `修改昵称需要 ${nicknameChangePointCost} ${pointName}，当前余额不足` }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: currentUser.id },
        data: {
          nickname: nextNickname,
          bio: bioSafety.sanitizedText || undefined,
          avatarPath: avatarPath || undefined,
          email: nextEmail,
          emailVerifiedAt,
          lastLoginIp: getRequestIp(request),
          ...(nicknameChanged && nicknameChangePointCost > 0 ? { points: { decrement: nicknameChangePointCost } } : {}),
        },
        select: {
          username: true,
          nickname: true,
          bio: true,
          avatarPath: true,
          email: true,
          emailVerifiedAt: true,
          points: true,
        },
      })

      if (nicknameChanged && nicknameChangePointCost > 0) {
        await tx.pointLog.create({
          data: {
            userId: currentUser.id,
            changeType: ChangeType.DECREASE,
            changeValue: nicknameChangePointCost,
            reason: `修改昵称扣除 ${nicknameChangePointCost} ${pointName}`,
            relatedType: RelatedType.ANNOUNCEMENT,

            relatedId: String(currentUser.id),
          },
        })
      }

      return user
    })

    const messageParts: string[] = []
    if (bioSafety.shouldReview || nicknameSafety.shouldReview) {
      messageParts.push("资料已更新，部分内容命中敏感词审核规则")
    } else {
      messageParts.push("资料已更新")
    }

    if (nicknameChanged && nicknameChangePointCost > 0) {
      messageParts.push(`已扣除 ${nicknameChangePointCost} ${pointName}`)
    }

    return NextResponse.json({
      code: 0,
      message: messageParts.join("，"),
      data: updated,
    })
  } catch (error) {
    if (error instanceof ContentSafetyError) {
      return NextResponse.json({ code: 400, message: error.message }, { status: error.statusCode })
    }
    if (isPublicRouteError(error)) {
      return NextResponse.json({ code: 400, message: error.message }, { status: error.statusCode })
    }
    console.error("[api/profile/update] unexpected error", error)
    const message = error instanceof Error && error.message ? error.message : "保存资料失败"
    return NextResponse.json({ code: 500, message }, { status: 500 })
  }
}
