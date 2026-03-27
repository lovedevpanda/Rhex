import { VerificationChannel, ChangeType, RelatedType } from "@/db/types"

import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { enforceSensitiveText } from "@/lib/content-safety"
import { getRequestIp } from "@/lib/request-ip"
import { validateProfilePayload } from "@/lib/validators"
import { verifyCode } from "@/lib/verification"

type ProfileUpdateResponse = {
  username: string
  nickname: string
  bio: string
  avatarPath: string
  email: string
  emailVerifiedAt?: string | null
  points: number
}

function toProfileUpdateResponse(input: {
  username: string
  nickname: string | null
  bio: string | null
  avatarPath: string | null
  email: string | null
  emailVerifiedAt?: Date | string | null
  points: number
}): ProfileUpdateResponse {
  return {
    username: input.username,
    nickname: input.nickname ?? "",
    bio: input.bio ?? "",
    avatarPath: input.avatarPath ?? "",
    email: input.email ?? "",
    emailVerifiedAt: typeof input.emailVerifiedAt === "string"
      ? input.emailVerifiedAt
      : input.emailVerifiedAt?.toISOString() ?? null,
    points: input.points,
  }
}

export const POST = createUserRouteHandler<ProfileUpdateResponse>(async ({ request, currentUser }) => {

  const body = await request.json()
  const validated = validateProfilePayload(body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const nicknameSafety = await enforceSensitiveText({ scene: "profile.nickname", text: validated.data.nickname })
  const bioSafety = await enforceSensitiveText({ scene: "profile.bio", text: validated.data.bio })
  const email = validated.data.email
  const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath.trim() : ""
  const emailCode = typeof body.emailCode === "string" ? body.emailCode.trim() : ""




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
    apiError(404, "用户不存在")
  }

  const nextNickname = nicknameSafety.sanitizedText
  const nextEmail = email || null
  const emailChanged = (dbUser.email ?? null) !== nextEmail
  const currentNickname = (dbUser.nickname ?? "").trim()
  const nicknameChanged = currentNickname !== nextNickname
  const nicknameChangePointCost = Math.max(0, settings?.nicknameChangePointCost ?? 0)
  const pointName = settings?.pointName?.trim() || "积分"

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
        email: nextEmail,
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
    apiError(409, "昵称已被使用")
  }

  if (nicknameChanged && nicknameChangePointCost > 0 && dbUser.points < nicknameChangePointCost) {
    apiError(400, `修改昵称需要 ${nicknameChangePointCost} ${pointName}，当前余额不足`)
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

  return apiSuccess(toProfileUpdateResponse(updated), messageParts.join("，"))

}, {
  errorMessage: "保存资料失败",
  logPrefix: "[api/profile/update] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})

