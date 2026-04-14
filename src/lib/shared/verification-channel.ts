export const VerificationChannel = {
  EMAIL: "EMAIL",
  PHONE: "PHONE",
} as const

export type VerificationChannel = (typeof VerificationChannel)[keyof typeof VerificationChannel]

export const VERIFICATION_CHANNEL_VALUES: VerificationChannel[] = Object.values(VerificationChannel)

const verificationChannelValueSet = new Set<string>(VERIFICATION_CHANNEL_VALUES)

export function isVerificationChannel(value: string): value is VerificationChannel {
  return verificationChannelValueSet.has(value)
}
