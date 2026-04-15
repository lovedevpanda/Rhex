import { VerificationCenter } from "@/components/verification-center"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

export function VerificationsSettingsSection({ data }: { data: SettingsPageData }) {
  return <VerificationCenter types={data.verificationData.types ?? []} approvedVerification={data.verificationData.approvedVerification ?? null} />
}
