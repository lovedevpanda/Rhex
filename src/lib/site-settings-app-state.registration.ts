import {
  buildDefaultRegistrationEmailTemplateSettings,
  normalizeRegistrationEmailTemplateSettings,
} from "@/lib/email-template-settings"
import { parseEmailWhitelistDomains } from "@/lib/email"
import {
  isRecord,
  normalizeNonNegativeInteger,
  readSiteSettingsState,
  writeSiteSettingsState,
} from "@/lib/site-settings-app-state.types"
import type {
  AuthPageShowcaseSettings,
  AuthProviderSettings,
  AvatarChangePointCostSettings,
  CheckInMakeUpPriceSettings,
  CheckInRewardSettings,
  CheckInStreakSettings,
  IntroductionChangePointCostSettings,
  InviteCodePurchasePriceSettings,
  NicknameChangePointCostSettings,
  RedeemCodeHelpSettings,
  RegisterEmailWhitelistSettings,
  RegisterInviteCodeHelpSettings,
  RegisterNicknameLengthSettings,
  RegistrationEmailTemplateSettings,
  RegistrationRewardSettings,
  SiteSecuritySettings,
} from "@/lib/site-settings-app-state.types"

export function resolveCheckInRewardSettings(options: {
  appStateJson?: string | null
  normalReward: number
}): CheckInRewardSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInRewards = isRecord(siteSettingsState.checkInRewards)
    ? siteSettingsState.checkInRewards
    : {}
  const normal = normalizeNonNegativeInteger(options.normalReward, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(checkInRewards.vip1, normal),
    vip2: normalizeNonNegativeInteger(checkInRewards.vip2, normal),
    vip3: normalizeNonNegativeInteger(checkInRewards.vip3, normal),
  }
}

export function mergeCheckInRewardSettings(
  appStateJson: string | null | undefined,
  input: Pick<CheckInRewardSettings, "vip1" | "vip2" | "vip3">,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    checkInRewards: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  })
}

export function resolveCheckInMakeUpPriceSettings(options: {
  appStateJson?: string | null
  normalPrice: number
  vipFallbackPrice: number
}): CheckInMakeUpPriceSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInMakeUpPrices = isRecord(siteSettingsState.checkInMakeUpPrices)
    ? siteSettingsState.checkInMakeUpPrices
    : {}
  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)
  const vipFallbackPrice = normalizeNonNegativeInteger(options.vipFallbackPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(checkInMakeUpPrices.vip1, vipFallbackPrice),
    vip2: normalizeNonNegativeInteger(checkInMakeUpPrices.vip2, vipFallbackPrice),
    vip3: normalizeNonNegativeInteger(checkInMakeUpPrices.vip3, vipFallbackPrice),
  }
}

export function mergeCheckInMakeUpPriceSettings(
  appStateJson: string | null | undefined,
  input: Pick<CheckInMakeUpPriceSettings, "vip1" | "vip2" | "vip3">,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    checkInMakeUpPrices: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  })
}

export function resolveNicknameChangePointCostSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): NicknameChangePointCostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const nicknameChangePointCosts = isRecord(siteSettingsState.nicknameChangePointCosts)
    ? siteSettingsState.nicknameChangePointCosts
    : {}
  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(nicknameChangePointCosts.vip1, normal),
    vip2: normalizeNonNegativeInteger(nicknameChangePointCosts.vip2, normal),
    vip3: normalizeNonNegativeInteger(nicknameChangePointCosts.vip3, normal),
  }
}

export function mergeNicknameChangePointCostSettings(
  appStateJson: string | null | undefined,
  input: Pick<NicknameChangePointCostSettings, "vip1" | "vip2" | "vip3">,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    nicknameChangePointCosts: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  })
}

export function resolveIntroductionChangePointCostSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): IntroductionChangePointCostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const introductionChangePointCosts = isRecord(siteSettingsState.introductionChangePointCosts)
    ? siteSettingsState.introductionChangePointCosts
    : {}
  const normal = normalizeNonNegativeInteger(
    introductionChangePointCosts.normal,
    normalizeNonNegativeInteger(options.normalPrice, 0),
  )

  return {
    normal,
    vip1: normalizeNonNegativeInteger(introductionChangePointCosts.vip1, normal),
    vip2: normalizeNonNegativeInteger(introductionChangePointCosts.vip2, normal),
    vip3: normalizeNonNegativeInteger(introductionChangePointCosts.vip3, normal),
  }
}

export function mergeIntroductionChangePointCostSettings(
  appStateJson: string | null | undefined,
  input: IntroductionChangePointCostSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    introductionChangePointCosts: {
      normal: normalizeNonNegativeInteger(input.normal, 0),
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  })
}

export function resolveAvatarChangePointCostSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): AvatarChangePointCostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const avatarChangePointCosts = isRecord(siteSettingsState.avatarChangePointCosts)
    ? siteSettingsState.avatarChangePointCosts
    : {}
  const normal = normalizeNonNegativeInteger(
    avatarChangePointCosts.normal,
    normalizeNonNegativeInteger(options.normalPrice, 0),
  )

  return {
    normal,
    vip1: normalizeNonNegativeInteger(avatarChangePointCosts.vip1, normal),
    vip2: normalizeNonNegativeInteger(avatarChangePointCosts.vip2, normal),
    vip3: normalizeNonNegativeInteger(avatarChangePointCosts.vip3, normal),
  }
}

export function mergeAvatarChangePointCostSettings(
  appStateJson: string | null | undefined,
  input: AvatarChangePointCostSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    avatarChangePointCosts: {
      normal: normalizeNonNegativeInteger(input.normal, 0),
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  })
}

export function resolveInviteCodePurchasePriceSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): InviteCodePurchasePriceSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const inviteCodePurchasePrices = isRecord(siteSettingsState.inviteCodePurchasePrices)
    ? siteSettingsState.inviteCodePurchasePrices
    : {}
  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip1, normal),
    vip2: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip2, normal),
    vip3: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip3, normal),
  }
}

export function mergeInviteCodePurchasePriceSettings(
  appStateJson: string | null | undefined,
  input: Pick<InviteCodePurchasePriceSettings, "vip1" | "vip2" | "vip3">,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    inviteCodePurchasePrices: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  })
}

export function resolveRegistrationEmailTemplateSettings(options: {
  appStateJson?: string | null
  siteNameFallback?: string
} = {}): RegistrationEmailTemplateSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const defaults = buildDefaultRegistrationEmailTemplateSettings(options.siteNameFallback ?? "社区站点")

  return normalizeRegistrationEmailTemplateSettings(
    siteSettingsState.registrationEmailTemplates,
    defaults,
  )
}

export function mergeRegistrationEmailTemplateSettings(
  appStateJson: string | null | undefined,
  input: RegistrationEmailTemplateSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const defaults = buildDefaultRegistrationEmailTemplateSettings("社区站点")
  const normalized = normalizeRegistrationEmailTemplateSettings(input, defaults)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    registrationEmailTemplates: normalized,
  })
}

export function resolveRegisterNicknameLengthSettings(options: {
  appStateJson?: string | null
  minLengthFallback?: number
  maxLengthFallback?: number
} = {}): RegisterNicknameLengthSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registerNicknameLengths = isRecord(siteSettingsState.registerNicknameLengths)
    ? siteSettingsState.registerNicknameLengths
    : {}
  const minLength = Math.min(
    50,
    Math.max(
      1,
      normalizeNonNegativeInteger(
        registerNicknameLengths.minLength,
        normalizeNonNegativeInteger(options.minLengthFallback, 1),
      ),
    ),
  )

  return {
    minLength,
    maxLength: Math.min(
      50,
      Math.max(
        minLength,
        normalizeNonNegativeInteger(
          registerNicknameLengths.maxLength,
          normalizeNonNegativeInteger(options.maxLengthFallback, 20),
        ),
      ),
    ),
  }
}

export function mergeRegisterNicknameLengthSettings(
  appStateJson: string | null | undefined,
  input: RegisterNicknameLengthSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const minLength = Math.min(50, Math.max(1, normalizeNonNegativeInteger(input.minLength, 1)))

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    registerNicknameLengths: {
      minLength,
      maxLength: Math.min(50, Math.max(minLength, normalizeNonNegativeInteger(input.maxLength, 20))),
    },
  })
}

export function resolveRegisterEmailWhitelistSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  domainsFallback?: string[]
} = {}): RegisterEmailWhitelistSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registerEmailWhitelist = isRecord(siteSettingsState.registerEmailWhitelist)
    ? siteSettingsState.registerEmailWhitelist
    : {}
  const { domains } = parseEmailWhitelistDomains(
    Array.isArray(registerEmailWhitelist.domains)
      ? registerEmailWhitelist.domains
      : options.domainsFallback ?? [],
  )

  return {
    enabled:
      typeof registerEmailWhitelist.enabled === "boolean"
        ? registerEmailWhitelist.enabled
        : options.enabledFallback ?? false,
    domains,
  }
}

export function mergeRegisterEmailWhitelistSettings(
  appStateJson: string | null | undefined,
  input: RegisterEmailWhitelistSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const { domains } = parseEmailWhitelistDomains(input.domains)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    registerEmailWhitelist: {
      enabled: Boolean(input.enabled),
      domains,
    },
  })
}

export function resolveSiteSecuritySettings(options: {
  appStateJson?: string | null
  sessionIpMismatchLogoutEnabledFallback?: boolean
  loginIpChangeEmailAlertEnabledFallback?: boolean
  passwordChangeRequireEmailVerificationFallback?: boolean
} = {}): SiteSecuritySettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const siteSecurity = isRecord(siteSettingsState.siteSecurity)
    ? siteSettingsState.siteSecurity
    : {}

  return {
    sessionIpMismatchLogoutEnabled:
      typeof siteSecurity.sessionIpMismatchLogoutEnabled === "boolean"
        ? siteSecurity.sessionIpMismatchLogoutEnabled
        : options.sessionIpMismatchLogoutEnabledFallback ?? true,
    loginIpChangeEmailAlertEnabled:
      typeof siteSecurity.loginIpChangeEmailAlertEnabled === "boolean"
        ? siteSecurity.loginIpChangeEmailAlertEnabled
        : options.loginIpChangeEmailAlertEnabledFallback ?? false,
    passwordChangeRequireEmailVerification:
      typeof siteSecurity.passwordChangeRequireEmailVerification === "boolean"
        ? siteSecurity.passwordChangeRequireEmailVerification
        : options.passwordChangeRequireEmailVerificationFallback ?? false,
  }
}

export function mergeSiteSecuritySettings(
  appStateJson: string | null | undefined,
  input: SiteSecuritySettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    siteSecurity: {
      sessionIpMismatchLogoutEnabled: Boolean(input.sessionIpMismatchLogoutEnabled),
      loginIpChangeEmailAlertEnabled: Boolean(input.loginIpChangeEmailAlertEnabled),
      passwordChangeRequireEmailVerification: Boolean(input.passwordChangeRequireEmailVerification),
    },
  })
}

export function resolveAuthProviderSettings(options: {
  appStateJson?: string | null
  githubEnabledFallback?: boolean
  googleEnabledFallback?: boolean
  passkeyEnabledFallback?: boolean
} = {}): AuthProviderSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const authProviders = isRecord(siteSettingsState.authProviders)
    ? siteSettingsState.authProviders
    : {}

  return {
    githubEnabled: typeof authProviders.githubEnabled === "boolean" ? authProviders.githubEnabled : options.githubEnabledFallback ?? false,
    googleEnabled: typeof authProviders.googleEnabled === "boolean" ? authProviders.googleEnabled : options.googleEnabledFallback ?? false,
    passkeyEnabled: typeof authProviders.passkeyEnabled === "boolean" ? authProviders.passkeyEnabled : options.passkeyEnabledFallback ?? false,
  }
}

export function mergeAuthProviderSettings(
  appStateJson: string | null | undefined,
  input: AuthProviderSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    authProviders: {
      githubEnabled: input.githubEnabled,
      googleEnabled: input.googleEnabled,
      passkeyEnabled: input.passkeyEnabled,
    },
  })
}

export function resolveAuthPageShowcaseSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): AuthPageShowcaseSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const authPageShowcase = isRecord(siteSettingsState.authPageShowcase)
    ? siteSettingsState.authPageShowcase
    : {}

  return {
    enabled:
      typeof authPageShowcase.enabled === "boolean"
        ? authPageShowcase.enabled
        : options.enabledFallback ?? true,
  }
}

export function mergeAuthPageShowcaseSettings(
  appStateJson: string | null | undefined,
  input: AuthPageShowcaseSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    authPageShowcase: {
      enabled: Boolean(input.enabled),
    },
  })
}

export function resolveRegistrationRewardSettings(options: {
  appStateJson?: string | null
  initialPointsFallback?: number
} = {}): RegistrationRewardSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registrationRewards = isRecord(siteSettingsState.registrationRewards)
    ? siteSettingsState.registrationRewards
    : {}

  return {
    initialPoints: normalizeNonNegativeInteger(
      registrationRewards.initialPoints,
      normalizeNonNegativeInteger(options.initialPointsFallback, 0),
    ),
  }
}

export function mergeRegistrationRewardSettings(
  appStateJson: string | null | undefined,
  input: RegistrationRewardSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    registrationRewards: {
      initialPoints: normalizeNonNegativeInteger(input.initialPoints, 0),
    },
  })
}

export function resolveRegisterInviteCodeHelpSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  titleFallback?: string
  urlFallback?: string
} = {}): RegisterInviteCodeHelpSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registerInviteCodeHelp = isRecord(siteSettingsState.registerInviteCodeHelp)
    ? siteSettingsState.registerInviteCodeHelp
    : {}

  return {
    enabled:
      typeof registerInviteCodeHelp.enabled === "boolean"
        ? registerInviteCodeHelp.enabled
        : options.enabledFallback ?? false,
    title:
      typeof registerInviteCodeHelp.title === "string"
        ? registerInviteCodeHelp.title.trim()
        : options.titleFallback ?? "",
    url:
      typeof registerInviteCodeHelp.url === "string"
        ? registerInviteCodeHelp.url.trim()
        : options.urlFallback ?? "",
  }
}

export function mergeRegisterInviteCodeHelpSettings(
  appStateJson: string | null | undefined,
  input: RegisterInviteCodeHelpSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    registerInviteCodeHelp: {
      enabled: Boolean(input.enabled),
      title: input.title.trim(),
      url: input.url.trim(),
    },
  })
}

export function resolveRedeemCodeHelpSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  titleFallback?: string
  urlFallback?: string
} = {}): RedeemCodeHelpSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const redeemCodeHelp = isRecord(siteSettingsState.redeemCodeHelp)
    ? siteSettingsState.redeemCodeHelp
    : {}

  return {
    enabled:
      typeof redeemCodeHelp.enabled === "boolean"
        ? redeemCodeHelp.enabled
        : options.enabledFallback ?? false,
    title:
      typeof redeemCodeHelp.title === "string"
        ? redeemCodeHelp.title.trim()
        : options.titleFallback ?? "",
    url:
      typeof redeemCodeHelp.url === "string"
        ? redeemCodeHelp.url.trim()
        : options.urlFallback ?? "",
  }
}

export function mergeRedeemCodeHelpSettings(
  appStateJson: string | null | undefined,
  input: RedeemCodeHelpSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    redeemCodeHelp: {
      enabled: Boolean(input.enabled),
      title: input.title.trim(),
      url: input.url.trim(),
    },
  })
}

export function resolveCheckInStreakSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  makeUpCountsTowardStreakFallback?: boolean
  oldestDayLimitFallback?: number
} = {}): CheckInStreakSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInStreak = isRecord(siteSettingsState.checkInStreak)
    ? siteSettingsState.checkInStreak
    : {}

  return {
    enabled:
      typeof checkInStreak.enabled === "boolean"
        ? checkInStreak.enabled
        : options.enabledFallback ?? true,
    makeUpCountsTowardStreak:
      typeof checkInStreak.makeUpCountsTowardStreak === "boolean"
        ? checkInStreak.makeUpCountsTowardStreak
        : options.makeUpCountsTowardStreakFallback ?? true,
    oldestDayLimit:
      typeof checkInStreak.oldestDayLimit === "number" && Number.isFinite(checkInStreak.oldestDayLimit)
        ? Math.max(0, Math.floor(checkInStreak.oldestDayLimit))
        : Math.max(0, Math.floor(options.oldestDayLimitFallback ?? 0)),
  }
}

export function mergeCheckInStreakSettings(
  appStateJson: string | null | undefined,
  input: CheckInStreakSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    checkInStreak: {
      enabled: Boolean(input.enabled),
      makeUpCountsTowardStreak: input.makeUpCountsTowardStreak,
      oldestDayLimit: Math.max(0, Math.floor(input.oldestDayLimit)),
    },
  })
}
