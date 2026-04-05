import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"
import type { ExternalAuthProvider, PendingPasskeyCredential } from "@/lib/external-auth-types"

type AuthStoreClient = Prisma.TransactionClient | typeof prisma

export interface ExternalAuthAccountRecord {
  id: string
  userId: number
  provider: ExternalAuthProvider
  providerAccountId: string
  providerUsername: string | null
  providerEmail: string | null
  metadataJson: string | null
  createdAt: Date
  updatedAt: Date
}

export interface StoredPasskeyCredential {
  id: string
  userId: number
  credentialId: string
  publicKey: string
  counter: number
  deviceType: string | null
  backedUp: boolean
  transports: string[]
  name: string | null
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function resolveClient(client?: AuthStoreClient) {
  return client ?? prisma
}

function mapAuthAccountRow(row: {
  id: string
  userId: number
  provider: string
  providerAccountId: string
  providerUsername: string | null
  providerEmail: string | null
  metadataJson: string | null
  createdAt: Date
  updatedAt: Date
}): ExternalAuthAccountRecord {
  return {
    ...row,
    provider: row.provider as ExternalAuthProvider,
  }
}

function mapPasskeyRow(row: {
  id: string
  userId: number
  credentialId: string
  credentialPublicKey: string
  counter: bigint | number
  deviceType: string | null
  backedUp: boolean
  transports: string | null
  name: string | null
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): StoredPasskeyCredential {
  return {
    id: row.id,
    userId: row.userId,
    credentialId: row.credentialId,
    publicKey: row.credentialPublicKey,
    counter: Number(row.counter),
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    transports: row.transports?.split(",").map((item) => item.trim()).filter(Boolean) ?? [],
    name: row.name,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findExternalAuthAccount(provider: ExternalAuthProvider, providerAccountId: string, client?: AuthStoreClient) {
  const row = await resolveClient(client).authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
  })

  return row ? mapAuthAccountRow(row) : null
}

export async function findExternalAuthAccountByUserIdAndProvider(userId: number, provider: ExternalAuthProvider, client?: AuthStoreClient) {
  const row = await resolveClient(client).authAccount.findFirst({
    where: {
      userId,
      provider,
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  return row ? mapAuthAccountRow(row) : null
}

export async function listExternalAuthAccountsByUserId(userId: number, client?: AuthStoreClient) {
  const rows = await resolveClient(client).authAccount.findMany({
    where: { userId },
    orderBy: {
      createdAt: "asc",
    },
  })

  return rows.map(mapAuthAccountRow)
}

export async function createExternalAuthAccount(input: {
  userId: number
  provider: ExternalAuthProvider
  providerAccountId: string
  providerUsername?: string | null
  providerEmail?: string | null
  metadataJson?: string | null
  client?: AuthStoreClient
}) {
  await resolveClient(input.client).authAccount.create({
    data: {
      id: crypto.randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      providerUsername: input.providerUsername ?? null,
      providerEmail: input.providerEmail ?? null,
      metadataJson: input.metadataJson ?? null,
    },
  })
}

export async function findPasskeyCredentialByCredentialId(credentialId: string, client?: AuthStoreClient) {
  const row = await resolveClient(client).authPasskey.findUnique({
    where: { credentialId },
  })

  return row ? mapPasskeyRow(row) : null
}

export async function listPasskeyCredentialsByUserId(userId: number, client?: AuthStoreClient) {
  const rows = await resolveClient(client).authPasskey.findMany({
    where: { userId },
    orderBy: {
      createdAt: "asc",
    },
  })

  return rows.map(mapPasskeyRow)
}

export async function createPasskeyCredential(input: {
  userId: number
  credential: PendingPasskeyCredential
  name?: string | null
  client?: AuthStoreClient
}) {
  await resolveClient(input.client).authPasskey.create({
    data: {
      id: crypto.randomUUID(),
      userId: input.userId,
      credentialId: input.credential.credentialId,
      credentialPublicKey: input.credential.publicKey,
      counter: BigInt(input.credential.counter),
      deviceType: input.credential.deviceType || null,
      backedUp: input.credential.backedUp,
      transports: input.credential.transports.join(",") || null,
      name: input.name ?? null,
    },
  })
}

export async function updatePasskeyCredentialUsage(input: {
  id: string
  counter: number
  deviceType?: string | null
  backedUp?: boolean
  client?: AuthStoreClient
}) {
  await resolveClient(input.client).authPasskey.update({
    where: { id: input.id },
    data: {
      counter: BigInt(input.counter),
      deviceType: input.deviceType ?? null,
      backedUp: input.backedUp ?? false,
      lastUsedAt: new Date(),
    },
  })
}

export async function deleteExternalAuthAccountsByUserIdAndProvider(userId: number, provider: ExternalAuthProvider, client?: AuthStoreClient) {
  const result = await resolveClient(client).authAccount.deleteMany({
    where: {
      userId,
      provider,
    },
  })

  return result.count
}

export async function deletePasskeyCredentialByIdAndUserId(id: string, userId: number, client?: AuthStoreClient) {
  const result = await resolveClient(client).authPasskey.deleteMany({
    where: {
      id,
      userId,
    },
  })

  return result.count
}
