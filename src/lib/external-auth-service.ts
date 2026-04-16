import { compare, hashSync } from "bcryptjs"

import type { NextResponse } from "next/server"

import {
  createExternalAuthUserRecord,
  createUserLoginLogEntry,
  findAuthenticatedUserSummaryById,
  findAuthUserStatusById,
  findExternalAuthLoginCandidate,
  findInviteCodeRegistrationContext,
  findUserIdByEmail,
  findUserIdByUsername,
  incrementUserInviteCount,
  markInviteCodeAsUsed,
  recordSuccessfulExternalLoginByUserId,
  runExternalAuthTransaction,
} from "@/db/external-auth-user-queries"
import { maybeEnqueueLoginIpChangeAlert } from "@/lib/account-security"
import { findUserByNicknameInsensitive } from "@/db/user-queries"
import { apiError } from "@/lib/api-route"
import { getExternalAuthProviderLabel } from "@/lib/auth-provider-config"
import { isEmailInWhitelist } from "@/lib/email"
import { createSystemNotification } from "@/lib/notification-writes"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getRequestIp } from "@/lib/request-ip"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import {
  buildExternalAuthMetadataJson,
  buildPendingExternalAuthState,
  buildRandomPassword,
  buildUsernameSuggestions,
  createOAuthIdentity,
  createPasskeyIdentity,
  isValidExternalUsername,
  normalizeExternalUsernameCandidate,
  resolveExternalUsernameBase,
  trimNormalizedEmail,
} from "@/lib/external-auth-helpers"
import { createExternalAuthAccount, createPasskeyCredential, deleteExternalAuthAccountsByUserIdAndProvider, deletePasskeyCredentialByIdAndUserId, findExternalAuthAccount, findExternalAuthAccountByUserIdAndProvider, findPasskeyCredentialByCredentialId } from "@/lib/external-auth-store"
import type { ExternalAuthIdentity, PendingExternalAuthState } from "@/lib/external-auth-types"
import type { SiteSettingsData } from "@/lib/site-settings"
import type { StoredPasskeyCredential } from "@/lib/external-auth-store"
import type { ExternalAuthProvider } from "@/lib/external-auth-types"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

interface AuthenticatedUserSummary {
  id: number
  username: string
  lastLoginIp?: string | null
}

function createAddonHookInput(request?: Request, throwOnError = false) {
  if (!request) {
    return throwOnError ? { throwOnError: true } : undefined
  }

  const requestUrl = new URL(request.url)
  return {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    ...(throwOnError ? { throwOnError: true } : {}),
  }
}

interface ExternalAuthPendingResult {
  kind: "pending"
  state: PendingExternalAuthState
}

interface ExternalAuthAuthenticatedResult {
  kind: "authenticated"
  user: AuthenticatedUserSummary
  created: boolean
}

export type ExternalAuthResolutionResult = ExternalAuthPendingResult | ExternalAuthAuthenticatedResult

function assertUserCanUseAuth(status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE", action: string) {
  if (status === "BANNED") {
    apiError(403, `该账号已被拉黑，无法${action}`)
  }

  if (status === "INACTIVE") {
    apiError(403, `该账号未激活，无法${action}`)
  }
}
export { buildUsernameSuggestions, createOAuthIdentity, createPasskeyIdentity, normalizeExternalUsernameCandidate }

async function isUsernameAvailable(username: string) {
  const existing = await findUserIdByUsername(username)
  return !existing
}

async function createUserFromIdentity(input: {
  identity: ExternalAuthIdentity
  username: string
  inviteCode?: string
  request: Request
  siteSettings: Pick<SiteSettingsData, "inviteRewardInvitee" | "inviteRewardInviter" | "pointName" | "registerEmailWhitelistDomains" | "registerEmailWhitelistEnabled" | "registerInitialPoints" | "registrationEnabled" | "registrationRequireInviteCode">
}) {
  if (!input.siteSettings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  const inviteCode = input.inviteCode?.trim().toUpperCase() ?? ""

  if (input.siteSettings.registrationRequireInviteCode && !inviteCode) {
    apiError(400, "当前注册必须填写邀请码")
  }

  if (!isValidExternalUsername(input.username)) {
    apiError(400, "用户名需为 3-20 位字母、数字或下划线")
  }

  if (!(await isUsernameAvailable(input.username))) {
    apiError(409, "用户名已存在")
  }

  if (await findUserByNicknameInsensitive(input.username)) {
    apiError(409, "昵称已被使用，请更换用户名")
  }

  const email = trimNormalizedEmail(input.identity.providerEmail)
  if (email) {
    const emailOwner = await findUserIdByEmail(email)

    if (emailOwner) {
      apiError(409, "邮箱已被使用，请绑定已有账户")
    }

    if (input.siteSettings.registerEmailWhitelistEnabled && !isEmailInWhitelist(email, input.siteSettings.registerEmailWhitelistDomains)) {
      apiError(400, "该邮箱后缀不在注册白名单内")
    }
  }

  const randomPassword = buildRandomPassword()
  const loginIp = getRequestIp(input.request)
  const userAgent = input.request.headers.get("user-agent")
  const inviterReward = Math.max(0, input.siteSettings.inviteRewardInviter)
  const inviteeReward = Math.max(0, input.siteSettings.inviteRewardInvitee)
  const registerInitialPoints = Math.max(0, input.siteSettings.registerInitialPoints)

  const user = await runExternalAuthTransaction(async (tx) => {
    let inviter: null | { id: number; username: string; points: number } = null
    let inviteCodeRecord: null | { id: string; code: string } = null

    if (inviteCode) {
      const foundCode = await findInviteCodeRegistrationContext(inviteCode, tx)

      if (!foundCode) {
        apiError(404, "邀请码不存在")
      }

      if (foundCode.usedById) {
        apiError(409, "邀请码已被使用")
      }

      inviteCodeRecord = { id: foundCode.id, code: foundCode.code }

      if (foundCode.createdBy) {
        if (foundCode.createdBy.username === input.username) {
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

    const createdUser = await createExternalAuthUserRecord({
      client: tx,
      username: input.username,
      passwordHash: hashSync(randomPassword, 10),
      email,
      emailVerifiedAt: email && input.identity.emailVerified ? new Date() : null,
      nickname: input.username,
      lastLoginAt: new Date(),
      lastLoginIp: loginIp,
      inviterId: inviter?.id,
    })

    if (input.identity.method === "oauth" && input.identity.provider && input.identity.providerAccountId) {
      await createExternalAuthAccount({
        client: tx,
        userId: createdUser.id,
        provider: input.identity.provider,
        providerAccountId: input.identity.providerAccountId,
        providerUsername: input.identity.providerUsername ?? null,
        providerEmail: email,
        metadataJson: buildExternalAuthMetadataJson(input.identity),
      })
    }

    if (input.identity.method === "passkey" && input.identity.passkeyCredential) {
      await createPasskeyCredential({
        client: tx,
        userId: createdUser.id,
        credential: input.identity.passkeyCredential,
      })
    }

    if (inviteCodeRecord) {
      await markInviteCodeAsUsed(inviteCodeRecord.id, createdUser.id, tx)
    }

    if (inviter) {
      await incrementUserInviteCount(inviter.id, tx)
    }

    await createUserLoginLogEntry(createdUser.id, loginIp, userAgent, tx)

    await createSystemNotification({
      client: tx,
      userId: createdUser.id,
      relatedType: "USER",
      relatedId: String(createdUser.id),
      title: "已为你生成随机登录密码",
      content: `你刚刚通过 ${input.identity.providerLabel} 创建了账户。系统已自动生成一组强密码：${randomPassword}。如需使用账号密码登录，请登录后尽快前往设置页面修改密码。`,
    })

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
        pointName: input.siteSettings.pointName,
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
        pointName: input.siteSettings.pointName,
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
        pointName: input.siteSettings.pointName,
        reason: `通过 ${inviter.username} 的邀请注册奖励`,
      })

      pointBalanceCursor = inviteeRewardResult.afterBalance
    }

    return createdUser
  })

  revalidateHomeSidebarStatsCache()

  return user
}

async function linkIdentityToUser(input: {
  identity: ExternalAuthIdentity
  userId: number
}) {
  if (input.identity.method === "oauth" && input.identity.provider && input.identity.providerAccountId) {
    const existingProviderBinding = await findExternalAuthAccountByUserIdAndProvider(input.userId, input.identity.provider)

    if (existingProviderBinding && existingProviderBinding.providerAccountId !== input.identity.providerAccountId) {
      apiError(409, `你已经绑定了其它 ${input.identity.providerLabel} 账户，请先解绑后再试`)
    }

    const existing = await findExternalAuthAccount(input.identity.provider, input.identity.providerAccountId)

    if (existing && existing.userId !== input.userId) {
      apiError(409, `${input.identity.providerLabel} 账户已绑定其它站内账户`)
    }

    if (!existing) {
      await createExternalAuthAccount({
        userId: input.userId,
        provider: input.identity.provider,
        providerAccountId: input.identity.providerAccountId,
        providerUsername: input.identity.providerUsername ?? null,
        providerEmail: trimNormalizedEmail(input.identity.providerEmail),
        metadataJson: buildExternalAuthMetadataJson(input.identity),
      })
    }
  }

  if (input.identity.method === "passkey" && input.identity.passkeyCredential) {
    const existing = await findPasskeyCredentialByCredentialId(input.identity.passkeyCredential.credentialId)

    if (existing && existing.userId !== input.userId) {
      apiError(409, "该 Passkey 已绑定其它站内账户")
    }

    if (!existing) {
      await createPasskeyCredential({
        userId: input.userId,
        credential: input.identity.passkeyCredential,
      })
    }
  }
}

export async function connectExternalAuthIdentityToUser(input: {
  identity: ExternalAuthIdentity
  userId: number
  request?: Request
}) {
  const user = await findAuthUserStatusById(input.userId)

  if (!user) {
    apiError(404, "站内账户不存在")
  }

  assertUserCanUseAuth(user.status, "绑定新的登录方式")

  await executeAddonActionHook("auth.identity.bind.before", {
    userId: user.id,
    username: user.username,
    method: input.identity.method,
    provider: input.identity.provider ?? null,
    providerLabel: input.identity.providerLabel,
  }, createAddonHookInput(input.request, true))

  await linkIdentityToUser(input)

  await executeAddonActionHook("auth.identity.bind.after", {
    userId: user.id,
    username: user.username,
    method: input.identity.method,
    provider: input.identity.provider ?? null,
    providerLabel: input.identity.providerLabel,
  }, createAddonHookInput(input.request))
}

export async function disconnectExternalAuthProviderFromUser(userId: number, provider: ExternalAuthProvider, request?: Request) {
  const user = await findAuthUserStatusById(userId)

  if (!user) {
    apiError(404, "站内账户不存在")
  }

  await executeAddonActionHook("auth.identity.unbind.before", {
    userId: user.id,
    username: user.username,
    method: "oauth",
    provider,
    providerLabel: getExternalAuthProviderLabel(provider),
  }, createAddonHookInput(request, true))

  const deletedCount = await deleteExternalAuthAccountsByUserIdAndProvider(userId, provider)

  if (deletedCount < 1) {
    apiError(404, `${getExternalAuthProviderLabel(provider)} 尚未绑定`)
  }

  await executeAddonActionHook("auth.identity.unbind.after", {
    userId: user.id,
    username: user.username,
    method: "oauth",
    provider,
    providerLabel: getExternalAuthProviderLabel(provider),
  }, createAddonHookInput(request))
}

export async function disconnectPasskeyCredentialFromUser(userId: number, credentialId: string, request?: Request) {
  const user = await findAuthUserStatusById(userId)

  if (!user) {
    apiError(404, "站内账户不存在")
  }

  await executeAddonActionHook("auth.identity.unbind.before", {
    userId: user.id,
    username: user.username,
    method: "passkey",
    provider: null,
    providerLabel: "Passkey",
    credentialId,
  }, createAddonHookInput(request, true))

  const deletedCount = await deletePasskeyCredentialByIdAndUserId(credentialId, userId)

  if (deletedCount < 1) {
    apiError(404, "指定的 Passkey 不存在或不属于当前账户")
  }

  await executeAddonActionHook("auth.identity.unbind.after", {
    userId: user.id,
    username: user.username,
    method: "passkey",
    provider: null,
    providerLabel: "Passkey",
    credentialId,
  }, createAddonHookInput(request))
}

export async function resolveExternalAuth(identity: ExternalAuthIdentity, siteSettings: Pick<SiteSettingsData, "inviteRewardInvitee" | "inviteRewardInviter" | "pointName" | "registerEmailWhitelistDomains" | "registerEmailWhitelistEnabled" | "registerInitialPoints" | "registrationEnabled" | "registrationRequireInviteCode">, request: Request): Promise<ExternalAuthResolutionResult> {
  if (identity.method === "oauth" && identity.provider && identity.providerAccountId) {
    const existingAccount = await findExternalAuthAccount(identity.provider, identity.providerAccountId)

    if (existingAccount) {
      const linkedUser = await findAuthenticatedUserSummaryById(existingAccount.userId)

      if (!linkedUser) {
        apiError(404, "关联的站内账户不存在")
      }

      assertUserCanUseAuth(linkedUser.status, "登录")

      return {
        kind: "authenticated",
        user: {
          id: linkedUser.id,
          username: linkedUser.username,
        },
        created: false,
      }
    }
  }

  const email = trimNormalizedEmail(identity.providerEmail)

  if (email) {
    const emailOwner = await findUserIdByEmail(email)

    if (emailOwner) {
      return {
        kind: "pending",
        state: await buildPendingExternalAuthState(identity, { emailConflictUserId: emailOwner.id }),
      }
    }

    if (siteSettings.registerEmailWhitelistEnabled && !isEmailInWhitelist(email, siteSettings.registerEmailWhitelistDomains)) {
      apiError(400, "该邮箱后缀不在注册白名单内")
    }
  }

  if (!siteSettings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  if (siteSettings.registrationRequireInviteCode) {
    return {
      kind: "pending",
      state: await buildPendingExternalAuthState(identity, { inviteCodeRequired: true }),
    }
  }

  const usernameCandidate = normalizeExternalUsernameCandidate(resolveExternalUsernameBase(identity))
  if (usernameCandidate && await isUsernameAvailable(usernameCandidate)) {
    const user = await createUserFromIdentity({
      identity,
      username: usernameCandidate,
      request,
      siteSettings,
    })

    return {
      kind: "authenticated",
      user,
      created: true,
    }
  }

  return {
    kind: "pending",
    state: await buildPendingExternalAuthState(identity),
  }
}

export async function completePendingExternalAuthUsername(input: {
  state: PendingExternalAuthState
  username: string
  inviteCode?: string
  siteSettings: Pick<SiteSettingsData, "inviteRewardInvitee" | "inviteRewardInviter" | "pointName" | "registerEmailWhitelistDomains" | "registerEmailWhitelistEnabled" | "registerInitialPoints" | "registrationEnabled" | "registrationRequireInviteCode">
  request: Request
}) {
  if (input.state.kind !== "username_required") {
    apiError(400, "当前流程不需要补充用户名")
  }

  return createUserFromIdentity({
    identity: input.state,
    username: input.username,
    inviteCode: input.inviteCode,
    request: input.request,
    siteSettings: input.siteSettings,
  })
}

export async function completePendingExternalAuthBind(input: {
  state: PendingExternalAuthState
  login: string
  password: string
  request?: Request
}) {
  if (input.state.kind !== "email_bind_required") {
    apiError(400, "当前流程不需要绑定已有账户")
  }

  const login = input.login.trim()
  if (!login || !input.password.trim()) {
    apiError(400, "请输入用户名/邮箱和密码")
  }

  const matchedUser = await findExternalAuthLoginCandidate(login)

  if (!matchedUser || matchedUser.id !== input.state.conflictUserId) {
    apiError(409, `该 ${input.state.providerLabel} 邮箱已对应其它站内账户，请绑定正确的已有账户`)
  }

  if (!await compare(input.password, matchedUser.passwordHash)) {
    apiError(401, "用户名/邮箱或密码错误")
  }

  assertUserCanUseAuth(matchedUser.status, "绑定第三方登录")

  await executeAddonActionHook("auth.identity.bind.before", {
    userId: matchedUser.id,
    username: matchedUser.username,
    method: input.state.method,
    provider: input.state.provider ?? null,
    providerLabel: input.state.providerLabel,
  }, createAddonHookInput(input.request, true))

  await linkIdentityToUser({
    identity: input.state,
    userId: matchedUser.id,
  })

  await executeAddonActionHook("auth.identity.bind.after", {
    userId: matchedUser.id,
    username: matchedUser.username,
    method: input.state.method,
    provider: input.state.provider ?? null,
    providerLabel: input.state.providerLabel,
  }, createAddonHookInput(input.request))

  return {
    id: matchedUser.id,
    username: matchedUser.username,
  }
}

export async function recordSuccessfulExternalLogin(request: Request, user: AuthenticatedUserSummary) {
  const loginIp = getRequestIp(request)
  await recordSuccessfulExternalLoginByUserId(user.id, loginIp, request.headers.get("user-agent"))
  void maybeEnqueueLoginIpChangeAlert({
    userId: user.id,
    previousIp: user.lastLoginIp,
    currentIp: loginIp,
    userAgent: request.headers.get("user-agent"),
  })
}

export async function attachAuthenticatedSession(response: NextResponse, request: Request, user: AuthenticatedUserSummary) {
  const loginIp = getRequestIp(request)
  const requestUrl = new URL(request.url)

  await executeAddonActionHook("auth.login.before", {
    userId: user.id,
    username: user.username,
    loginIp,
    method: "external",
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })

  const sessionToken = await createSessionToken(user.username, loginIp)
  response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())
  await executeAddonActionHook("auth.login.after", {
    userId: user.id,
    username: user.username,
    loginIp,
    method: "external",
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })
}

export async function findPasskeyLinkedUserByCredentialId(credentialId: string): Promise<{ credential: StoredPasskeyCredential; user: AuthenticatedUserSummary } | null> {
  const credential = await findPasskeyCredentialByCredentialId(credentialId)

  if (!credential) {
    return null
  }

  const user = await findAuthenticatedUserSummaryById(credential.userId)

  if (!user) {
    apiError(404, "Passkey 绑定的站内账户不存在")
  }

  assertUserCanUseAuth(user.status, "使用 Passkey 登录")

  return {
    credential,
    user,
  }
}
