export const USER_NOTIFICATION_CHANNELS = ["webhook", "email"] as const
export const USER_NOTIFICATION_EVENTS = ["systemNotification", "privateMessage"] as const

export type UserNotificationChannel = typeof USER_NOTIFICATION_CHANNELS[number]
export type UserNotificationEvent = typeof USER_NOTIFICATION_EVENTS[number]

export interface UserNotificationEventPreferences {
  systemNotification: boolean
  privateMessage: boolean
}

export interface UserNotificationWebhookPreferences {
  enabled: boolean
  url: string
  events: UserNotificationEventPreferences
}

export interface UserNotificationEmailPreferences {
  enabled: boolean
  events: UserNotificationEventPreferences
}

export interface UserNotificationPreferences {
  webhook: UserNotificationWebhookPreferences
  email: UserNotificationEmailPreferences
}

export interface UserNotificationEventPreferencesInput {
  systemNotification?: boolean
  privateMessage?: boolean
}

export interface UserNotificationWebhookPreferencesInput {
  enabled?: boolean
  url?: string
  events?: UserNotificationEventPreferencesInput
}

export interface UserNotificationEmailPreferencesInput {
  enabled?: boolean
  events?: UserNotificationEventPreferencesInput
}

export interface UserNotificationPreferencesInput {
  webhook?: UserNotificationWebhookPreferencesInput
  email?: UserNotificationEmailPreferencesInput
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function resolveBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function resolveString(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback
}

export function createDefaultUserNotificationEventPreferences(): UserNotificationEventPreferences {
  return {
    systemNotification: false,
    privateMessage: false,
  }
}

export function createDefaultUserNotificationPreferences(): UserNotificationPreferences {
  return {
    webhook: {
      enabled: false,
      url: "",
      events: createDefaultUserNotificationEventPreferences(),
    },
    email: {
      enabled: false,
      events: createDefaultUserNotificationEventPreferences(),
    },
  }
}

export function resolveUserNotificationPreferences(rawSettings: unknown): UserNotificationPreferences {
  const defaults = createDefaultUserNotificationPreferences()
  const root = isPlainObject(rawSettings) ? rawSettings : {}
  const rawPreferences = isPlainObject(root.notificationPreferences) ? root.notificationPreferences : {}
  const rawWebhook = isPlainObject(rawPreferences.webhook) ? rawPreferences.webhook : {}
  const rawEmail = isPlainObject(rawPreferences.email) ? rawPreferences.email : {}
  const rawWebhookEvents = isPlainObject(rawWebhook.events) ? rawWebhook.events : {}
  const rawEmailEvents = isPlainObject(rawEmail.events) ? rawEmail.events : {}

  return {
    webhook: {
      enabled: resolveBoolean(rawWebhook.enabled, defaults.webhook.enabled),
      url: resolveString(rawWebhook.url, defaults.webhook.url),
      events: {
        systemNotification: resolveBoolean(rawWebhookEvents.systemNotification, defaults.webhook.events.systemNotification),
        privateMessage: resolveBoolean(rawWebhookEvents.privateMessage, defaults.webhook.events.privateMessage),
      },
    },
    email: {
      enabled: resolveBoolean(rawEmail.enabled, defaults.email.enabled),
      events: {
        systemNotification: resolveBoolean(rawEmailEvents.systemNotification, defaults.email.events.systemNotification),
        privateMessage: resolveBoolean(rawEmailEvents.privateMessage, defaults.email.events.privateMessage),
      },
    },
  }
}

function mergeUserNotificationEventPreferences(
  current: UserNotificationEventPreferences,
  input?: UserNotificationEventPreferencesInput,
) {
  return {
    systemNotification: input?.systemNotification ?? current.systemNotification,
    privateMessage: input?.privateMessage ?? current.privateMessage,
  } satisfies UserNotificationEventPreferences
}

export function mergeUserNotificationPreferences(
  current: UserNotificationPreferences,
  input?: UserNotificationPreferencesInput,
): UserNotificationPreferences {
  return {
    webhook: {
      enabled: input?.webhook?.enabled ?? current.webhook.enabled,
      url: typeof input?.webhook?.url === "string" ? input.webhook.url.trim() : current.webhook.url,
      events: mergeUserNotificationEventPreferences(current.webhook.events, input?.webhook?.events),
    },
    email: {
      enabled: input?.email?.enabled ?? current.email.enabled,
      events: mergeUserNotificationEventPreferences(current.email.events, input?.email?.events),
    },
  }
}

export function isUserNotificationChannelEnabled(
  preferences: UserNotificationPreferences,
  channel: UserNotificationChannel,
  event: UserNotificationEvent,
) {
  if (channel === "webhook") {
    return preferences.webhook.enabled
      && Boolean(preferences.webhook.url.trim())
      && preferences.webhook.events[event]
  }

  return preferences.email.enabled && preferences.email.events[event]
}
