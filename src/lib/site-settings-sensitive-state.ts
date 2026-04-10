const SITE_SETTINGS_SENSITIVE_KEY = "__siteSensitiveSettings"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseSensitiveStateRoot(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readSensitiveSiteSettingsState(raw: string | null | undefined) {
  const root = parseSensitiveStateRoot(raw)
  const state = root[SITE_SETTINGS_SENSITIVE_KEY]
  return isRecord(state) ? state : {}
}

export interface AuthProviderSensitiveConfig {
  githubClientId: string | null
  githubClientSecret: string | null
  googleClientId: string | null
  googleClientSecret: string | null
  passkeyRpId: string | null
  passkeyRpName: string | null
  passkeyOrigin: string | null
}

export interface CaptchaSensitiveConfig {
  turnstileSecretKey: string | null
}

export interface UploadStorageSensitiveConfig {
  accessKeyId: string | null
  secretAccessKey: string | null
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function resolveAuthProviderSensitiveConfig(sensitiveStateJson?: string | null): AuthProviderSensitiveConfig {
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)
  const authProviderConfig = isRecord(state.authProviderConfig)
    ? state.authProviderConfig
    : {}

  return {
    githubClientId: normalizeNullableString(authProviderConfig.githubClientId),
    githubClientSecret: normalizeNullableString(authProviderConfig.githubClientSecret),
    googleClientId: normalizeNullableString(authProviderConfig.googleClientId),
    googleClientSecret: normalizeNullableString(authProviderConfig.googleClientSecret),
    passkeyRpId: normalizeNullableString(authProviderConfig.passkeyRpId),
    passkeyRpName: normalizeNullableString(authProviderConfig.passkeyRpName),
    passkeyOrigin: normalizeNullableString(authProviderConfig.passkeyOrigin),
  }
}

export function resolveCaptchaSensitiveConfig(sensitiveStateJson?: string | null): CaptchaSensitiveConfig {
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)
  const captchaConfig = isRecord(state.captchaConfig)
    ? state.captchaConfig
    : {}

  return {
    turnstileSecretKey: normalizeNullableString(captchaConfig.turnstileSecretKey),
  }
}

export function resolveUploadStorageSensitiveConfig(sensitiveStateJson?: string | null): UploadStorageSensitiveConfig {
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)
  const uploadStorageConfig = isRecord(state.uploadStorageConfig)
    ? state.uploadStorageConfig
    : {}

  return {
    accessKeyId: normalizeNullableString(uploadStorageConfig.accessKeyId),
    secretAccessKey: normalizeNullableString(uploadStorageConfig.secretAccessKey),
  }
}

export function mergeAuthProviderSensitiveConfig(
  sensitiveStateJson: string | null | undefined,
  input: AuthProviderSensitiveConfig,
) {
  const root = parseSensitiveStateRoot(sensitiveStateJson)
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    authProviderConfig: {
      githubClientId: normalizeNullableString(input.githubClientId),
      githubClientSecret: normalizeNullableString(input.githubClientSecret),
      googleClientId: normalizeNullableString(input.googleClientId),
      googleClientSecret: normalizeNullableString(input.googleClientSecret),
      passkeyRpId: normalizeNullableString(input.passkeyRpId),
      passkeyRpName: normalizeNullableString(input.passkeyRpName),
      passkeyOrigin: normalizeNullableString(input.passkeyOrigin),
    },
  }

  return JSON.stringify(root)
}

export function mergeCaptchaSensitiveConfig(
  sensitiveStateJson: string | null | undefined,
  input: CaptchaSensitiveConfig,
) {
  const root = parseSensitiveStateRoot(sensitiveStateJson)
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    captchaConfig: {
      turnstileSecretKey: normalizeNullableString(input.turnstileSecretKey),
    },
  }

  return JSON.stringify(root)
}

export function mergeUploadStorageSensitiveConfig(
  sensitiveStateJson: string | null | undefined,
  input: UploadStorageSensitiveConfig,
) {
  const root = parseSensitiveStateRoot(sensitiveStateJson)
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    uploadStorageConfig: {
      accessKeyId: normalizeNullableString(input.accessKeyId),
      secretAccessKey: normalizeNullableString(input.secretAccessKey),
    },
  }

  return JSON.stringify(root)
}
