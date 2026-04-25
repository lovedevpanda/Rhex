import {
  createDefaultUserNotificationPreferences,
  mergeUserNotificationPreferences,
  resolveUserNotificationPreferences,
  type UserNotificationPreferences,
  type UserNotificationPreferencesInput,
} from "@/lib/user-notification-preferences"

const PROFILE_SETTINGS_KEY = "__profileSettings"
const RAW_SIGNATURE_KEY = "__rawSignatureText"

export type UserProfileVisibility = "PUBLIC" | "MEMBERS" | "PRIVATE"

export const USER_PROFILE_VISIBILITY_VALUES = ["PUBLIC", "MEMBERS", "PRIVATE"] as const

export interface UserProfileSettings {
  activityVisibility: UserProfileVisibility
  introductionVisibility: UserProfileVisibility
  introduction: string
  notificationPreferences: UserNotificationPreferences
}

interface UserProfileSettingsInput {
  activityVisibility?: UserProfileVisibility
  introductionVisibility?: UserProfileVisibility
  introduction?: string
  notificationPreferences?: UserNotificationPreferencesInput
}

function createDefaultUserProfileSettings(): UserProfileSettings {
  const notificationPreferences = createDefaultUserNotificationPreferences()

  return {
    activityVisibility: "PUBLIC",
    introductionVisibility: "PUBLIC",
    introduction: "",
    notificationPreferences,
  }
}

export function isUserProfileVisibility(value: unknown): value is UserProfileVisibility {
  return typeof value === "string" && USER_PROFILE_VISIBILITY_VALUES.includes(value as UserProfileVisibility)
}

export function mapLegacyVisibilityBoolean(value: boolean): UserProfileVisibility {
  return value ? "PUBLIC" : "PRIVATE"
}

export function canViewUserProfileVisibility(
  visibility: UserProfileVisibility,
  options: { isOwner: boolean; isLoggedIn: boolean },
) {
  if (options.isOwner) {
    return true
  }

  if (visibility === "PUBLIC") {
    return true
  }

  if (visibility === "MEMBERS") {
    return options.isLoggedIn
  }

  return false
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readSignatureEnvelope(signature: string | null | undefined) {
  if (!signature) {
    return { envelope: {} as Record<string, unknown>, rawSignatureText: "" }
  }

  try {
    const parsed = JSON.parse(signature)

    if (isPlainObject(parsed)) {
      return {
        envelope: parsed,
        rawSignatureText: typeof parsed[RAW_SIGNATURE_KEY] === "string" ? parsed[RAW_SIGNATURE_KEY] : "",
      }
    }
  } catch {
    // Keep plain text signatures intact by preserving them in a side channel.
  }

  return {
    envelope: {},
    rawSignatureText: signature,
  }
}

export function resolveUserProfileSettings(signature: string | null | undefined): UserProfileSettings {
  const { envelope, rawSignatureText } = readSignatureEnvelope(signature)
  const rawSettings = envelope[PROFILE_SETTINGS_KEY]
  const defaults = createDefaultUserProfileSettings()

  if (!isPlainObject(rawSettings)) {
    return {
      ...defaults,
      introduction: rawSignatureText,
    }
  }

  const notificationPreferences = resolveUserNotificationPreferences(rawSettings)

  return {
    activityVisibility:
      isUserProfileVisibility(rawSettings.activityVisibility)
        ? rawSettings.activityVisibility
        : typeof rawSettings.activityVisibilityPublic === "boolean"
          ? mapLegacyVisibilityBoolean(rawSettings.activityVisibilityPublic)
          : defaults.activityVisibility,
    introductionVisibility:
      isUserProfileVisibility(rawSettings.introductionVisibility)
        ? rawSettings.introductionVisibility
        : defaults.introductionVisibility,
    introduction:
      typeof rawSettings.introduction === "string"
        ? rawSettings.introduction
        : rawSignatureText,
    notificationPreferences,
  }
}

export function mergeUserProfileSettings(signature: string | null | undefined, input: UserProfileSettingsInput) {
  const { envelope, rawSignatureText } = readSignatureEnvelope(signature)
  const current = resolveUserProfileSettings(signature)
  const nextNotificationPreferences = mergeUserNotificationPreferences(current.notificationPreferences, input.notificationPreferences)

  const nextSettings: UserProfileSettings = {
    activityVisibility: input.activityVisibility ?? current.activityVisibility,
    introductionVisibility: input.introductionVisibility ?? current.introductionVisibility,
    introduction: typeof input.introduction === "string" ? input.introduction.trim() : current.introduction,
    notificationPreferences: nextNotificationPreferences,
  }

  return JSON.stringify({
    ...envelope,
    ...(rawSignatureText ? { [RAW_SIGNATURE_KEY]: rawSignatureText } : {}),
    [PROFILE_SETTINGS_KEY]: {
      activityVisibility: nextSettings.activityVisibility,
      introductionVisibility: nextSettings.introductionVisibility,
      introduction: nextSettings.introduction,
      notificationPreferences: nextSettings.notificationPreferences,
    },
  })
}
