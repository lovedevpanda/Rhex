import type { RegistrationEmailTemplateSettings } from "@/lib/site-settings-app-state"

export interface SiteSettingsRegistrationData {
  registrationEnabled: boolean
  authPageShowcaseEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  registerInviteCodeHelpEnabled: boolean
  registerInviteCodeHelpTitle: string
  registerInviteCodeHelpUrl: string
  inviteCodePurchaseEnabled: boolean
  boardApplicationEnabled: boolean
  inviteCodePrice: number
  registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  turnstileSiteKey?: string | null
  registerEmailEnabled: boolean
  registerEmailRequired: boolean
  registerEmailVerification: boolean
  loginIpChangeEmailAlertEnabled: boolean
  passwordChangeRequireEmailVerification: boolean
  registerEmailWhitelistEnabled: boolean
  registerEmailWhitelistDomains: string[]
  registerPhoneEnabled: boolean
  registerPhoneRequired: boolean
  registerPhoneVerification: boolean
  registerNicknameEnabled: boolean
  registerNicknameRequired: boolean
  registerNicknameMinLength: number
  registerNicknameMaxLength: number
  registerGenderEnabled: boolean
  registerGenderRequired: boolean
  registerInviterEnabled: boolean
  registrationEmailTemplates: RegistrationEmailTemplateSettings
  authGithubEnabled: boolean
  authGoogleEnabled: boolean
  authPasskeyEnabled: boolean
  smtpEnabled: boolean
}
