import { GitHub, Google, generateCodeVerifier, generateState } from "arctic"

import type { ServerSiteSettingsData, SiteSettingsData } from "@/lib/site-settings"
import type {
  BuiltinExternalAuthProvider,
  ExternalAuthProvider,
  ExternalOAuthProfile,
} from "@/lib/external-auth-types"
import { resolveSiteOrigin } from "@/lib/site-origin"

const OAUTH_PROVIDER_LABELS: Record<BuiltinExternalAuthProvider, string> = {
  github: "GitHub",
  google: "Google",
}

export function isExternalAuthProvider(value: string): value is ExternalAuthProvider {
  return value === "github" || value === "google"
}

export function getExternalAuthProviderLabel(provider: ExternalAuthProvider) {
  if (provider === "github") {
    return OAUTH_PROVIDER_LABELS.github
  }

  if (provider === "google") {
    return OAUTH_PROVIDER_LABELS.google
  }

  return provider.trim() || "第三方账号"
}

export function isExternalAuthProviderEnabled(settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled">, provider: ExternalAuthProvider) {
  if (provider === "github") {
    return settings.authGithubEnabled
  }

  if (provider === "google") {
    return settings.authGoogleEnabled
  }

  return false
}

export function getEnabledExternalAuthProviders(settings: Pick<SiteSettingsData, "authGithubEnabled" | "authGoogleEnabled">) {
  return (["github", "google"] as const).filter((provider) => isExternalAuthProviderEnabled(settings, provider))
}

type OAuthProviderConfigSettings = Pick<
  ServerSiteSettingsData,
  "githubClientId" | "githubClientSecret" | "googleClientId" | "googleClientSecret"
>

function getRequiredConfigValue(providerLabel: string, fieldLabel: string, value: string | null | undefined) {
  const normalizedValue = typeof value === "string" ? value.trim() : ""

  if (!normalizedValue) {
    throw new Error(`已开启 ${providerLabel} 登录，但后台未填写 ${fieldLabel}`)
  }

  return normalizedValue
}

function getOAuthProviderCredentials(provider: ExternalAuthProvider, settings: OAuthProviderConfigSettings) {
  if (provider === "github") {
    return {
      clientId: getRequiredConfigValue("GitHub", "GitHub Client ID", settings.githubClientId),
      clientSecret: getRequiredConfigValue("GitHub", "GitHub Client Secret", settings.githubClientSecret),
    }
  }

  return {
    clientId: getRequiredConfigValue("Google", "Google Client ID", settings.googleClientId),
    clientSecret: getRequiredConfigValue("Google", "Google Client Secret", settings.googleClientSecret),
  }
}

async function getOAuthRedirectURI(provider: ExternalAuthProvider) {
  return `${await resolveSiteOrigin()}/api/auth/oauth/${provider}/callback`
}

export async function createOAuthAuthorizationRequest(provider: ExternalAuthProvider, settings: OAuthProviderConfigSettings) {
  const state = generateState()
  const credentials = getOAuthProviderCredentials(provider, settings)
  const redirectUri = await getOAuthRedirectURI(provider)

  if (provider === "github") {
    const client = new GitHub(
      credentials.clientId,
      credentials.clientSecret,
      redirectUri,
    )

    return {
      state,
      codeVerifier: null,
      url: client.createAuthorizationURL(state, ["read:user", "user:email"]),
    }
  }

  const codeVerifier = generateCodeVerifier()
  const client = new Google(
    credentials.clientId,
    credentials.clientSecret,
    redirectUri,
  )

  return {
    state,
    codeVerifier,
    url: client.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]),
  }
}

export async function validateOAuthAuthorizationCode(
  provider: ExternalAuthProvider,
  code: string,
  codeVerifier: string | null | undefined,
  settings: OAuthProviderConfigSettings,
) {
  const credentials = getOAuthProviderCredentials(provider, settings)
  const redirectUri = await getOAuthRedirectURI(provider)

  if (provider === "github") {
    const client = new GitHub(
      credentials.clientId,
      credentials.clientSecret,
      redirectUri,
    )

    return client.validateAuthorizationCode(code)
  }

  const client = new Google(
    credentials.clientId,
    credentials.clientSecret,
    redirectUri,
  )

  if (!codeVerifier) {
    throw new Error("Google OAuth 缺少 PKCE code verifier")
  }

  return client.validateAuthorizationCode(code, codeVerifier)
}

async function fetchGitHubProfile(accessToken: string): Promise<ExternalOAuthProfile> {
  const [userResponse, emailResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "bbs-site",
      },
      cache: "no-store",
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "bbs-site",
      },
      cache: "no-store",
    }),
  ])

  if (!userResponse.ok) {
    throw new Error(`GitHub 用户信息获取失败（${userResponse.status}）`)
  }

  const user = await userResponse.json() as {
    id?: number
    login?: string
    name?: string | null
    avatar_url?: string | null
    email?: string | null
  }

  const emails = emailResponse.ok
    ? await emailResponse.json() as Array<{ email?: string; primary?: boolean; verified?: boolean }>
    : []
  const verifiedEmail = emails.find((item) => item.primary && item.verified)?.email
    ?? emails.find((item) => item.verified)?.email
    ?? null

  if (!user.id) {
    throw new Error("GitHub 返回的用户标识无效")
  }

  return {
    provider: "github",
    providerAccountId: String(user.id),
    providerUsername: user.login?.trim() || null,
    providerEmail: verifiedEmail || null,
    emailVerified: Boolean(verifiedEmail),
    displayName: user.name?.trim() || user.login?.trim() || null,
    avatarUrl: user.avatar_url?.trim() || null,
  }
}

async function fetchGoogleProfile(accessToken: string): Promise<ExternalOAuthProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Google 用户信息获取失败（${response.status}）`)
  }

  const profile = await response.json() as {
    sub?: string
    email?: string | null
    email_verified?: boolean
    name?: string | null
    picture?: string | null
  }

  if (!profile.sub) {
    throw new Error("Google 返回的用户标识无效")
  }

  const email = profile.email_verified ? profile.email?.trim() || null : null

  return {
    provider: "google",
    providerAccountId: profile.sub,
    providerUsername: null,
    providerEmail: email,
    emailVerified: Boolean(email),
    displayName: profile.name?.trim() || null,
    avatarUrl: profile.picture?.trim() || null,
  }
}

export async function fetchOAuthUserProfile(provider: ExternalAuthProvider, accessToken: string) {
  if (provider === "github") {
    return fetchGitHubProfile(accessToken)
  }

  return fetchGoogleProfile(accessToken)
}
