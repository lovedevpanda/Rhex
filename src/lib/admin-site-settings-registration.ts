import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { parseEmailWhitelistDomains } from "@/lib/email"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import {
  mergeRegisterEmailWhitelistSettings,
  mergeAuthPageShowcaseSettings,
  mergeAuthProviderSettings,
  mergeRegisterInviteCodeHelpSettings,
  mergeRegisterNicknameLengthSettings,
  mergeRegistrationEmailTemplateSettings,
  mergeRegistrationRewardSettings,
  mergeSiteSecuritySettings,
  resolveRegisterInviteCodeHelpSettings,
  resolveRegisterEmailWhitelistSettings,
  resolveRegistrationEmailTemplateSettings,
  resolveRegisterNicknameLengthSettings,
  resolveRegistrationRewardSettings,
  resolveSiteSecuritySettings,
} from "@/lib/site-settings-app-state"
import { mergeAuthProviderSensitiveConfig, mergeCaptchaSensitiveConfig } from "@/lib/site-settings-sensitive-state"
import { normalizeCaptchaMode } from "@/lib/shared/config-parsers"

function isSupportedInviteCodeHelpUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value)
}

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
  const existingRegistrationEmailTemplateSettings = resolveRegistrationEmailTemplateSettings({
    appStateJson: existing.appStateJson,
    siteNameFallback: existing.siteName,
  })
  const existingRegisterInviteCodeHelpSettings = resolveRegisterInviteCodeHelpSettings({
    appStateJson: existing.appStateJson,
  })
  const existingRegisterEmailWhitelistSettings = resolveRegisterEmailWhitelistSettings({
    appStateJson: existing.appStateJson,
  })
  const registerInitialPoints = Math.max(0, readOptionalNumberField(body, "registerInitialPoints") ?? existingRegistrationRewardSettings.initialPoints)
  const existingRegisterNicknameLengthSettings = resolveRegisterNicknameLengthSettings({
    appStateJson: existing.appStateJson,
    minLengthFallback: 1,
    maxLengthFallback: 20,
  })
  const registrationEnabled = Boolean(body.registrationEnabled)
  const authPageShowcaseEnabled = "authPageShowcaseEnabled" in body ? Boolean(body.authPageShowcaseEnabled) : true
  const registrationRequireInviteCode = Boolean(body.registrationRequireInviteCode)
  const registerInviteCodeEnabled = Boolean(body.registerInviteCodeEnabled)
  const registerInviteCodeHelpEnabled = registerInviteCodeEnabled && Boolean(body.registerInviteCodeHelpEnabled)
  const registerInviteCodeHelpTitle = readOptionalStringField(body, "registerInviteCodeHelpTitle") || existingRegisterInviteCodeHelpSettings.title
  const registerInviteCodeHelpUrl = readOptionalStringField(body, "registerInviteCodeHelpUrl") || existingRegisterInviteCodeHelpSettings.url
  const inviteCodePurchaseEnabled = Boolean(body.inviteCodePurchaseEnabled)
  const registerCaptchaMode = normalizeCaptchaMode(body.registerCaptchaMode)
  const loginCaptchaMode = normalizeCaptchaMode(body.loginCaptchaMode)
  const turnstileSiteKey = readOptionalStringField(body, "turnstileSiteKey") || null
  const turnstileSecretKey = readOptionalStringField(body, "turnstileSecretKey") || null
  const registerEmailEnabled = Boolean(body.registerEmailEnabled)
  const registerEmailRequired = registerEmailEnabled && Boolean(body.registerEmailRequired)
  const registerEmailVerification = registerEmailEnabled && Boolean(body.registerEmailVerification)
  const registerEmailWhitelistEnabled = registerEmailEnabled && Boolean(body.registerEmailWhitelistEnabled)
  const existingSiteSecuritySettings = resolveSiteSecuritySettings({
    appStateJson: existing.appStateJson,
  })
  const loginIpChangeEmailAlertEnabled = "loginIpChangeEmailAlertEnabled" in body
    ? Boolean(body.loginIpChangeEmailAlertEnabled)
    : existingSiteSecuritySettings.loginIpChangeEmailAlertEnabled
  const passwordChangeRequireEmailVerification = "passwordChangeRequireEmailVerification" in body
    ? Boolean(body.passwordChangeRequireEmailVerification)
    : existingSiteSecuritySettings.passwordChangeRequireEmailVerification
  const registerEmailWhitelistDomainsInput = "registerEmailWhitelistDomains" in body
    ? readOptionalStringField(body, "registerEmailWhitelistDomains")
    : existingRegisterEmailWhitelistSettings.domains.join("\n")
  const {
    domains: registerEmailWhitelistDomains,
    invalidDomains: invalidRegisterEmailWhitelistDomains,
  } = parseEmailWhitelistDomains(registerEmailWhitelistDomainsInput)
  const registerPhoneEnabled = Boolean(body.registerPhoneEnabled)
  const registerPhoneRequired = registerPhoneEnabled && Boolean(body.registerPhoneRequired)
  const registerPhoneVerification = registerPhoneEnabled && Boolean(body.registerPhoneVerification)
  const registerNicknameEnabled = Boolean(body.registerNicknameEnabled)
  const registerNicknameRequired = registerNicknameEnabled && Boolean(body.registerNicknameRequired)
  const registerNicknameMinLength = Math.max(1, readOptionalNumberField(body, "registerNicknameMinLength") ?? existingRegisterNicknameLengthSettings.minLength)
  const registerNicknameMaxLength = Math.max(1, readOptionalNumberField(body, "registerNicknameMaxLength") ?? existingRegisterNicknameLengthSettings.maxLength)
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
  const registerVerificationEmailSubject = readOptionalStringField(body, "registerVerificationEmailSubject") || existingRegistrationEmailTemplateSettings.registerVerification.subject
  const registerVerificationEmailText = readOptionalStringField(body, "registerVerificationEmailText") || existingRegistrationEmailTemplateSettings.registerVerification.text
  const registerVerificationEmailHtml = readOptionalStringField(body, "registerVerificationEmailHtml") || existingRegistrationEmailTemplateSettings.registerVerification.html
  const resetPasswordEmailSubject = readOptionalStringField(body, "resetPasswordEmailSubject") || existingRegistrationEmailTemplateSettings.resetPasswordVerification.subject
  const resetPasswordEmailText = readOptionalStringField(body, "resetPasswordEmailText") || existingRegistrationEmailTemplateSettings.resetPasswordVerification.text
  const resetPasswordEmailHtml = readOptionalStringField(body, "resetPasswordEmailHtml") || existingRegistrationEmailTemplateSettings.resetPasswordVerification.html
  const passwordChangeEmailSubject = readOptionalStringField(body, "passwordChangeEmailSubject") || existingRegistrationEmailTemplateSettings.passwordChangeVerification.subject
  const passwordChangeEmailText = readOptionalStringField(body, "passwordChangeEmailText") || existingRegistrationEmailTemplateSettings.passwordChangeVerification.text
  const passwordChangeEmailHtml = readOptionalStringField(body, "passwordChangeEmailHtml") || existingRegistrationEmailTemplateSettings.passwordChangeVerification.html
  const loginIpChangeAlertEmailSubject = readOptionalStringField(body, "loginIpChangeAlertEmailSubject") || existingRegistrationEmailTemplateSettings.loginIpChangeAlert.subject
  const loginIpChangeAlertEmailText = readOptionalStringField(body, "loginIpChangeAlertEmailText") || existingRegistrationEmailTemplateSettings.loginIpChangeAlert.text
  const loginIpChangeAlertEmailHtml = readOptionalStringField(body, "loginIpChangeAlertEmailHtml") || existingRegistrationEmailTemplateSettings.loginIpChangeAlert.html
  const paymentOrderSuccessEmailSubject = readOptionalStringField(body, "paymentOrderSuccessEmailSubject") || existingRegistrationEmailTemplateSettings.paymentOrderSuccessNotification.subject
  const paymentOrderSuccessEmailText = readOptionalStringField(body, "paymentOrderSuccessEmailText") || existingRegistrationEmailTemplateSettings.paymentOrderSuccessNotification.text
  const paymentOrderSuccessEmailHtml = readOptionalStringField(body, "paymentOrderSuccessEmailHtml") || existingRegistrationEmailTemplateSettings.paymentOrderSuccessNotification.html

  if (registrationRequireInviteCode && !registerInviteCodeEnabled) {
    apiError(400, "注册要求必须填写邀请码时，不能关闭邀请码输入框显示")
  }

  if (registerInviteCodeHelpEnabled && !registerInviteCodeHelpUrl) {
    apiError(400, "开启邀请码输入框链接时，必须填写链接地址")
  }

  if (registerInviteCodeHelpUrl && !isSupportedInviteCodeHelpUrl(registerInviteCodeHelpUrl)) {
    apiError(400, "邀请码输入框链接仅支持以 /、http:// 或 https:// 开头")
  }

  if ((registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE") && (!turnstileSiteKey || !turnstileSecretKey)) {
    apiError(400, "启用 Turnstile 验证码时，必须同时填写 Turnstile Site Key 和 Secret Key")
  }

  if (invalidRegisterEmailWhitelistDomains.length > 0) {
    apiError(400, `邮箱白名单后缀格式不正确：${invalidRegisterEmailWhitelistDomains.slice(0, 5).join("、")}`)
  }

  if (registerEmailWhitelistEnabled && registerEmailWhitelistDomains.length === 0) {
    apiError(400, "开启邮箱白名单时，至少填写一个邮箱后缀")
  }

  if (smtpEnabled && (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom)) {
    apiError(400, "开启 SMTP 时请完整填写主机、端口、账号、密码和发件人地址")
  }

  if (registerNicknameMaxLength < registerNicknameMinLength) {
    apiError(400, "昵称最大字符数不能小于最小字符数")
  }

  const appStateWithRegistrationRewards = mergeRegistrationRewardSettings(existing.appStateJson, {
    initialPoints: registerInitialPoints,
  })
  const appStateWithRegistrationEmailTemplates = mergeRegistrationEmailTemplateSettings(appStateWithRegistrationRewards, {
    registerVerification: {
      subject: registerVerificationEmailSubject,
      text: registerVerificationEmailText,
      html: registerVerificationEmailHtml,
    },
    resetPasswordVerification: {
      subject: resetPasswordEmailSubject,
      text: resetPasswordEmailText,
      html: resetPasswordEmailHtml,
    },
    passwordChangeVerification: {
      subject: passwordChangeEmailSubject,
      text: passwordChangeEmailText,
      html: passwordChangeEmailHtml,
    },
    loginIpChangeAlert: {
      subject: loginIpChangeAlertEmailSubject,
      text: loginIpChangeAlertEmailText,
      html: loginIpChangeAlertEmailHtml,
    },
    paymentOrderSuccessNotification: {
      subject: paymentOrderSuccessEmailSubject,
      text: paymentOrderSuccessEmailText,
      html: paymentOrderSuccessEmailHtml,
    },
  })
  const appStateWithAuthProviders = mergeAuthProviderSettings(appStateWithRegistrationEmailTemplates, {
    githubEnabled: authGithubEnabled,
    googleEnabled: authGoogleEnabled,
    passkeyEnabled: authPasskeyEnabled,
  })
  const appStateWithAuthPageShowcase = mergeAuthPageShowcaseSettings(appStateWithAuthProviders, {
    enabled: authPageShowcaseEnabled,
  })
  const appStateWithRegisterNicknameLengths = mergeRegisterNicknameLengthSettings(appStateWithAuthPageShowcase, {
    minLength: registerNicknameMinLength,
    maxLength: registerNicknameMaxLength,
  })
  const appStateWithRegisterInviteCodeHelp = mergeRegisterInviteCodeHelpSettings(appStateWithRegisterNicknameLengths, {
    enabled: registerInviteCodeHelpEnabled,
    title: registerInviteCodeHelpTitle,
    url: registerInviteCodeHelpUrl,
  })
  const appStateWithSiteSecurity = mergeSiteSecuritySettings(appStateWithRegisterInviteCodeHelp, {
    loginIpChangeEmailAlertEnabled,
    passwordChangeRequireEmailVerification,
  })
  const appStateJson = mergeRegisterEmailWhitelistSettings(appStateWithSiteSecurity, {
    enabled: registerEmailWhitelistEnabled,
    domains: registerEmailWhitelistDomains,
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
