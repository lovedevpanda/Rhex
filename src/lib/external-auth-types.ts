export type BuiltinExternalAuthProvider = "github" | "google"
export type ExternalAuthProvider =
  | BuiltinExternalAuthProvider
  | (string & {})
export type ExternalAuthFlowMethod = "oauth" | "passkey"
export type ExternalAuthEntryMode = "login" | "register"
export type ExternalAuthOAuthMode = ExternalAuthEntryMode | "connect"

export interface PendingPasskeyCredential {
  credentialId: string
  publicKey: string
  counter: number
  deviceType: string
  backedUp: boolean
  transports: string[]
}

export interface ExternalAuthIdentity {
  method: ExternalAuthFlowMethod
  provider?: ExternalAuthProvider
  providerLabel: string
  providerAccountId?: string
  providerUsername?: string | null
  providerEmail?: string | null
  emailVerified?: boolean
  displayName?: string | null
  avatarUrl?: string | null
  passkeyCredential?: PendingPasskeyCredential
}

export interface UsernameRequiredPendingAuthState extends ExternalAuthIdentity {
  kind: "username_required"
  usernameCandidate: string
  usernameSuggestions: string[]
  inviteCodeRequired?: boolean
}

export interface EmailBindRequiredPendingAuthState extends ExternalAuthIdentity {
  kind: "email_bind_required"
  conflictUserId: number
  conflictEmail: string
  usernameCandidate: string
  usernameSuggestions: string[]
}

export type PendingExternalAuthState =
  | UsernameRequiredPendingAuthState
  | EmailBindRequiredPendingAuthState

export interface OAuthFlowState {
  provider: ExternalAuthProvider
  state: string
  codeVerifier?: string | null
  mode?: ExternalAuthOAuthMode
  redirectTo?: string | null
  connectUserId?: number
}

export interface PasskeyCeremonyState {
  flow: "register" | "login" | "connect"
  challenge: string
  usernameCandidate?: string
  emailCandidate?: string
  displayName?: string | null
  connectUserId?: number
}

export interface ExternalOAuthProfile {
  provider: ExternalAuthProvider
  providerAccountId: string
  providerUsername?: string | null
  providerEmail?: string | null
  emailVerified: boolean
  displayName?: string | null
  avatarUrl?: string | null
}
