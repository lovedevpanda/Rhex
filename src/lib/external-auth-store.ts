export {
  createExternalAuthAccount,
  createPasskeyCredential,
  deleteExternalAuthAccountsByUserIdAndProvider,
  deletePasskeyCredentialByIdAndUserId,
  findExternalAuthAccount,
  findExternalAuthAccountByUserIdAndProvider,
  findPasskeyCredentialByCredentialId,
  listExternalAuthAccountsByUserId,
  listPasskeyCredentialsByUserId,
  updatePasskeyCredentialUsage,
} from "@/db/external-auth-store-queries"
export type {
  ExternalAuthAccountRecord,
  StoredPasskeyCredential,
} from "@/db/external-auth-store-queries"
