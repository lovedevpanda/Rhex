import { getExternalAuthProviderLabel } from "@/lib/auth-provider-config"
import { listAddonExternalAuthEntries } from "@/lib/addon-external-auth-providers"
import { listExternalAuthAccountsByUserId, listPasskeyCredentialsByUserId } from "@/lib/external-auth-store"
import type { ExternalAuthProvider } from "@/lib/external-auth-types"
import type { SiteSettingsData } from "@/lib/site-settings"

interface ExternalAuthMetadata {
  providerLabel?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  emailVerified?: boolean
}

function parseExternalAuthMetadata(metadataJson?: string | null): ExternalAuthMetadata {
  if (!metadataJson) {
    return {}
  }

  try {
    const parsed = JSON.parse(metadataJson) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return parsed as ExternalAuthMetadata
  } catch {
    return {}
  }
}

function getEnabledBuiltinProviderFlag(
  settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled">,
  provider: ExternalAuthProvider,
) {
  return provider === "github" ? settings.authGithubEnabled : settings.authGoogleEnabled
}

export async function getUserAccountBindingView(
  userId: number,
  settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled" | "authPasskeyEnabled">,
) {
  const [accounts, passkeys] = await Promise.all([
    listExternalAuthAccountsByUserId(userId),
    listPasskeyCredentialsByUserId(userId),
  ])
  const addonEntries = await listAddonExternalAuthEntries()

  const builtinProviders = (["github", "google"] as const).map((provider) => {
    const account = accounts.find((item) => item.provider === provider) ?? null
    const metadata = parseExternalAuthMetadata(account?.metadataJson)

    return {
      provider,
      label: getExternalAuthProviderLabel(provider),
      enabled: getEnabledBuiltinProviderFlag(settings, provider),
      accountId: account?.id ?? null,
      connected: Boolean(account),
      connectMode: "url" as const,
      loginUrl: null,
      registerUrl: null,
      connectUrl: `/api/auth/oauth/${provider}/start?mode=connect`,
      providerUsername: account?.providerUsername ?? null,
      providerEmail: account?.providerEmail ?? null,
      providerLabel: metadata.providerLabel ?? null,
      displayName: metadata.displayName ?? null,
      avatarUrl: metadata.avatarUrl ?? null,
      connectedAt: account?.createdAt.toISOString() ?? null,
    }
  })

  const addonEntryMap = new Map(addonEntries.map((entry) => [entry.provider, entry]))
  const addonProviders = Array.from(new Set([
    ...addonEntries.map((entry) => entry.provider),
    ...accounts
      .filter((item) => item.provider !== "github" && item.provider !== "google")
      .map((item) => item.provider),
  ]))
    .map((provider) => {
      const account = accounts.find((item) => item.provider === provider) ?? null
      const entry = addonEntryMap.get(provider) ?? null
      const metadata = parseExternalAuthMetadata(account?.metadataJson)

      if (!account && !entry) {
        return null
      }

      return {
        provider,
        label: entry?.label || metadata.providerLabel?.trim() || getExternalAuthProviderLabel(provider),
        enabled: true,
        accountId: account?.id ?? null,
        connected: Boolean(account),
        connectMode: entry?.connectUrl ? "url" as const : "connected-only" as const,
        loginUrl: entry?.loginUrl ?? null,
        registerUrl: entry?.registerUrl ?? null,
        connectUrl: entry?.connectUrl ?? null,
        providerUsername: account?.providerUsername ?? null,
        providerEmail: account?.providerEmail ?? null,
        providerLabel: metadata.providerLabel ?? null,
        displayName: metadata.displayName ?? null,
        avatarUrl: metadata.avatarUrl ?? null,
        connectedAt: account?.createdAt.toISOString() ?? null,
      }
    })
    .filter((item): item is {
      provider: string
      label: string
      enabled: true
      accountId: string | null
      connected: boolean
      connectMode: "url" | "connected-only"
      loginUrl: string | null
      registerUrl: string | null
      connectUrl: string | null
      providerUsername: string | null
      providerEmail: string | null
      providerLabel: string | null
      displayName: string | null
      avatarUrl: string | null
      connectedAt: string | null
    } => Boolean(item))
    .sort((left, right) => {
      const byLabel = left.label.localeCompare(right.label, "zh-CN")
      if (byLabel !== 0) {
        return byLabel
      }

      return left.provider.localeCompare(right.provider, "zh-CN")
    })

  return {
    providers: [...builtinProviders, ...addonProviders],
    passkey: {
      enabled: settings.authPasskeyEnabled,
      items: passkeys.map((credential, index) => ({
        id: credential.id,
        name: credential.name?.trim() || `Passkey ${index + 1}`,
        deviceType: credential.deviceType,
        backedUp: credential.backedUp,
        lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
        createdAt: credential.createdAt.toISOString(),
      })),
    },
  }
}
