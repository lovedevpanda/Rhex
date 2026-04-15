export interface ServerSiteSettingsSensitiveData {
  githubClientId?: string | null
  githubClientSecret?: string | null
  googleClientId?: string | null
  googleClientSecret?: string | null
  passkeyRpId?: string | null
  passkeyRpName?: string | null
  passkeyOrigin?: string | null
  turnstileSecretKey?: string | null
  uploadS3AccessKeyId?: string | null
  uploadS3SecretAccessKey?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure: boolean
}
