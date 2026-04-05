import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import {
  mergeAuthProviderSettings,
  mergeRegistrationRewardSettings,
  resolveRegistrationRewardSettings,
} from "@/lib/site-settings-app-state"
import { mergeAuthProviderSensitiveConfig, mergeCaptchaSensitiveConfig } from "@/lib/site-settings-sensitive-state"
import { normalizeCaptchaMode } from "@/lib/shared/config-parsers"

export async function updateRegistrationSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "site-registration") {
    return null
  }

  const inviteRewardInviter = Math.max(0, readOptionalNumberField(body, "inviteRewardInviter") ?? 0)
  const inviteRewardInvitee = Math.max(0, readOptionalNumberField(body, "inviteRewardInvitee") ?? 0)
  const existingRegistrationRewardSettings = resolveRegistrationRewardSettings({
    appStateJson: existing.appStateJson,
    initialPointsFallback: 0,
  })
  const registerInitialPoints = Math.max(0, readOptionalNumberField(body, "registerInitialPoints") ?? existingRegistrationRewardSettings.initialPoints)
  const registrationEnabled = Boolean(body.registrationEnabled)
  const registrationRequireInviteCode = Boolean(body.registrationRequireInviteCode)
  const registerInviteCodeEnabled = Boolean(body.registerInviteCodeEnabled)
  const inviteCodePurchaseEnabled = Boolean(body.inviteCodePurchaseEnabled)
  const registerCaptchaMode = normalizeCaptchaMode(body.registerCaptchaMode)
  const loginCaptchaMode = normalizeCaptchaMode(body.loginCaptchaMode)
  const turnstileSiteKey = readOptionalStringField(body, "turnstileSiteKey") || null
  const turnstileSecretKey = readOptionalStringField(body, "turnstileSecretKey") || null
  const registerEmailEnabled = Boolean(body.registerEmailEnabled)
  const registerEmailRequired = registerEmailEnabled && Boolean(body.registerEmailRequired)
  const registerEmailVerification = registerEmailEnabled && Boolean(body.registerEmailVerification)
  const registerPhoneEnabled = Boolean(body.registerPhoneEnabled)
  const registerPhoneRequired = registerPhoneEnabled && Boolean(body.registerPhoneRequired)
  const registerPhoneVerification = registerPhoneEnabled && Boolean(body.registerPhoneVerification)
  const registerNicknameEnabled = Boolean(body.registerNicknameEnabled)
  const registerNicknameRequired = registerNicknameEnabled && Boolean(body.registerNicknameRequired)
  const registerGenderEnabled = Boolean(body.registerGenderEnabled)
  const registerGenderRequired = registerGenderEnabled && Boolean(body.registerGenderRequired)
  const registerInviterEnabled = Boolean(body.registerInviterEnabled)
  const authGithubEnabled = Boolean(body.authGithubEnabled)
  const authGoogleEnabled = Boolean(body.authGoogleEnabled)
  const authPasskeyEnabled = Boolean(body.authPasskeyEnabled)
  const githubClientId = readOptionalStringField(body, "githubClientId") || null
  const githubClientSecret = readOptionalStringField(body, "githubClientSecret") || null
  const googleClientId = readOptionalStringField(body, "googleClientId") || null
  const googleClientSecret = readOptionalStringField(body, "googleClientSecret") || null
  const passkeyRpId = readOptionalStringField(body, "passkeyRpId") || null
  const passkeyRpName = readOptionalStringField(body, "passkeyRpName") || null
  const passkeyOrigin = readOptionalStringField(body, "passkeyOrigin") || null
  const smtpEnabled = Boolean(body.smtpEnabled)
  const smtpHost = readOptionalStringField(body, "smtpHost") || null
  const smtpPortRaw = readOptionalNumberField(body, "smtpPort") ?? 0
  const smtpPort = smtpPortRaw > 0 ? smtpPortRaw : null
  const smtpUser = readOptionalStringField(body, "smtpUser") || null
  const smtpPass = readOptionalStringField(body, "smtpPass") || null
  const smtpFrom = readOptionalStringField(body, "smtpFrom") || null
  const smtpSecure = Boolean(body.smtpSecure)

  if (registrationRequireInviteCode && !registerInviteCodeEnabled) {
    apiError(400, "注册要求必须填写邀请码时，不能关闭邀请码输入框显示")
  }

  if ((registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE") && (!turnstileSiteKey || !turnstileSecretKey)) {
    apiError(400, "启用 Turnstile 验证码时，必须同时填写 Turnstile Site Key 和 Secret Key")
  }

  if (smtpEnabled && (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom)) {
    apiError(400, "开启 SMTP 时请完整填写主机、端口、账号、密码和发件人地址")
  }

  const appStateWithRegistrationRewards = mergeRegistrationRewardSettings(existing.appStateJson, {
    initialPoints: registerInitialPoints,
  })
  const appStateJson = mergeAuthProviderSettings(appStateWithRegistrationRewards, {
    githubEnabled: authGithubEnabled,
    googleEnabled: authGoogleEnabled,
    passkeyEnabled: authPasskeyEnabled,
  })
  const currentSensitiveStateJson = ("sensitiveStateJson" in existing ? existing.sensitiveStateJson : null) ?? null
  const sensitiveStateWithAuthProvider = mergeAuthProviderSensitiveConfig(currentSensitiveStateJson, {
    githubClientId,
    githubClientSecret,
    googleClientId,
    googleClientSecret,
    passkeyRpId,
    passkeyRpName,
    passkeyOrigin,
  })
  const sensitiveStateJson = mergeCaptchaSensitiveConfig(sensitiveStateWithAuthProvider, {
    turnstileSecretKey: registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE"
      ? turnstileSecretKey
      : null,
  })

  const settings = await updateSiteSettingsRecord(existing.id, {
    inviteRewardInviter,
    inviteRewardInvitee,
    registrationEnabled,
    registrationRequireInviteCode,
    registerInviteCodeEnabled,
    inviteCodePurchaseEnabled,
    registerCaptchaMode,
    loginCaptchaMode,
    turnstileSiteKey: registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE" ? turnstileSiteKey : null,
    registerEmailEnabled,
    registerEmailRequired,
    registerEmailVerification,
    registerPhoneEnabled,
    registerPhoneRequired,
    registerPhoneVerification,
    registerNicknameEnabled,
    registerNicknameRequired,
    registerGenderEnabled,
    registerGenderRequired,
    registerInviterEnabled,
    appStateJson,
    sensitiveStateJson,
    smtpEnabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "注册与邀请设置已保存",
  })
}

