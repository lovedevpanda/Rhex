import { OAuthClientStatus, Prisma, UserStatus } from "@/db/types"

import { prisma } from "@/db/client"

export const oauthClientPublicSelect = {
  id: true,
  ownerId: true,
  clientId: true,
  name: true,
  description: true,
  homepageUrl: true,
  logoUrl: true,
  redirectUris: true,
  scopes: true,
  status: true,
  reviewNote: true,
  reviewedById: true,
  reviewedAt: true,
  secretRotatedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      username: true,
      nickname: true,
      email: true,
      status: true,
    },
  },
  reviewer: {
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.OAuthClientSelect

export function createOAuthClientRecord(data: Prisma.OAuthClientUncheckedCreateInput) {
  return prisma.oAuthClient.create({
    data,
    select: oauthClientPublicSelect,
  })
}

export function findOAuthClientByClientId(clientId: string) {
  return prisma.oAuthClient.findUnique({
    where: { clientId },
    select: oauthClientPublicSelect,
  })
}

export function findOAuthClientById(id: string) {
  return prisma.oAuthClient.findUnique({
    where: { id },
    select: oauthClientPublicSelect,
  })
}

export function findOAuthClientSecretByClientId(clientId: string) {
  return prisma.oAuthClient.findUnique({
    where: { clientId },
    select: {
      clientId: true,
      clientSecretHash: true,
      status: true,
    },
  })
}

export function findOAuthClientByOwnerAndId(ownerId: number, id: string) {
  return prisma.oAuthClient.findFirst({
    where: { id, ownerId },
    select: oauthClientPublicSelect,
  })
}

export function findOAuthClientsByOwner(ownerId: number, take = 50) {
  return prisma.oAuthClient.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(take, 100)),
    select: oauthClientPublicSelect,
  })
}

export function findOAuthClientsForAdmin(options: {
  status?: OAuthClientStatus | "ALL"
  keyword?: string
  skip?: number
  take?: number
} = {}) {
  const keyword = options.keyword?.trim()
  const where: Prisma.OAuthClientWhereInput = {
    ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { homepageUrl: { contains: keyword, mode: "insensitive" } },
            { clientId: { contains: keyword, mode: "insensitive" } },
            { owner: { username: { contains: keyword, mode: "insensitive" } } },
            { owner: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  return prisma.oAuthClient.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
    skip: Math.max(0, options.skip ?? 0),
    take: Math.max(1, Math.min(options.take ?? 30, 100)),
    select: oauthClientPublicSelect,
  })
}

export function countOAuthClientsForAdmin(options: {
  status?: OAuthClientStatus | "ALL"
  keyword?: string
} = {}) {
  const keyword = options.keyword?.trim()
  const where: Prisma.OAuthClientWhereInput = {
    ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { homepageUrl: { contains: keyword, mode: "insensitive" } },
            { clientId: { contains: keyword, mode: "insensitive" } },
            { owner: { username: { contains: keyword, mode: "insensitive" } } },
            { owner: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  return prisma.oAuthClient.count({ where })
}

export function getOAuthClientSummary() {
  return prisma.oAuthClient.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  })
}

export function updateOAuthClientByOwner(params: {
  id: string
  ownerId: number
  data: Prisma.OAuthClientUncheckedUpdateInput
}) {
  return prisma.oAuthClient.updateMany({
    where: {
      id: params.id,
      ownerId: params.ownerId,
      status: {
        in: [OAuthClientStatus.PENDING, OAuthClientStatus.REJECTED],
      },
    },
    data: params.data,
  })
}

export function updateOAuthClientByAdmin(params: {
  id: string
  data: Prisma.OAuthClientUncheckedUpdateInput
}) {
  return prisma.oAuthClient.update({
    where: {
      id: params.id,
    },
    data: params.data,
    select: oauthClientPublicSelect,
  })
}

export function updateOAuthClientSecret(params: {
  id: string
  ownerId?: number
  secretHash: string
}) {
  return prisma.oAuthClient.updateMany({
    where: {
      id: params.id,
      ...(typeof params.ownerId === "number" ? { ownerId: params.ownerId } : {}),
    },
    data: {
      clientSecretHash: params.secretHash,
      secretRotatedAt: new Date(),
    },
  })
}

export function updateOAuthClientReview(params: {
  id: string
  reviewerId: number
  status: "APPROVED" | "REJECTED" | "DISABLED"
  reviewNote?: string | null
}) {
  return prisma.oAuthClient.update({
    where: { id: params.id },
    data: {
      status: params.status,
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
      reviewNote: params.reviewNote?.trim() || null,
    },
    select: oauthClientPublicSelect,
  })
}

export function createOAuthAuthorizationCode(data: Prisma.OAuthAuthorizationCodeUncheckedCreateInput) {
  return prisma.oAuthAuthorizationCode.create({
    data,
    select: {
      id: true,
      clientId: true,
      userId: true,
      redirectUri: true,
      scopes: true,
      expiresAt: true,
      createdAt: true,
    },
  })
}

export function findOAuthAuthorizationCodeByHash(codeHash: string) {
  return prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
    select: {
      id: true,
      codeHash: true,
      clientId: true,
      userId: true,
      redirectUri: true,
      scopes: true,
      codeChallenge: true,
      codeChallengeMethod: true,
      nonce: true,
      state: true,
      expiresAt: true,
      consumedAt: true,
      client: {
        select: {
          clientId: true,
          clientSecretHash: true,
          status: true,
          redirectUris: true,
          scopes: true,
        },
      },
    },
  })
}

export function consumeOAuthAuthorizationCode(id: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  return client.oAuthAuthorizationCode.updateMany({
    where: {
      id,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  })
}

export function upsertOAuthConsent(data: Prisma.OAuthConsentUncheckedCreateInput, client: Prisma.TransactionClient | typeof prisma = prisma) {
  return client.oAuthConsent.upsert({
    where: {
      clientId_userId: {
        clientId: data.clientId,
        userId: data.userId,
      },
    },
    create: data,
    update: {
      scopes: data.scopes,
    },
  })
}

export function findOAuthConsent(clientId: string, userId: number) {
  return prisma.oAuthConsent.findUnique({
    where: {
      clientId_userId: {
        clientId,
        userId,
      },
    },
    select: {
      id: true,
      clientId: true,
      userId: true,
      scopes: true,
      updatedAt: true,
    },
  })
}

export function findOAuthConsentsByUser(userId: number) {
  return prisma.oAuthConsent.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      clientId: true,
      userId: true,
      scopes: true,
      createdAt: true,
      updatedAt: true,
      client: {
        select: {
          ...oauthClientPublicSelect,
          _count: {
            select: {
              accessTokens: {
                where: {
                  userId,
                  revokedAt: null,
                  expiresAt: {
                    gt: new Date(),
                  },
                },
              },
              refreshTokens: {
                where: {
                  userId,
                  revokedAt: null,
                  rotatedAt: null,
                  expiresAt: {
                    gt: new Date(),
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

export function revokeOAuthConsentByUser(params: {
  userId: number
  clientId: string
}) {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.oAuthConsent.deleteMany({
      where: {
        userId: params.userId,
        clientId: params.clientId,
      },
    })
    const now = new Date()
    await tx.oAuthAccessToken.updateMany({
      where: {
        userId: params.userId,
        clientId: params.clientId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    })
    await tx.oAuthRefreshToken.updateMany({
      where: {
        userId: params.userId,
        clientId: params.clientId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    })

    return deleted.count
  })
}

export function createOAuthTokenPair(params: {
  accessTokenHash: string
  refreshTokenHash: string
  clientId: string
  userId: number
  scopes: string[]
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}) {
  return prisma.$transaction(async (tx) => {
    const accessToken = await tx.oAuthAccessToken.create({
      data: {
        tokenHash: params.accessTokenHash,
        clientId: params.clientId,
        userId: params.userId,
        scopes: params.scopes,
        expiresAt: params.accessTokenExpiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    })

    await tx.oAuthRefreshToken.create({
      data: {
        tokenHash: params.refreshTokenHash,
        accessTokenId: accessToken.id,
        clientId: params.clientId,
        userId: params.userId,
        scopes: params.scopes,
        expiresAt: params.refreshTokenExpiresAt,
      },
      select: {
        id: true,
      },
    })

    return accessToken
  })
}

async function lockActiveOAuthUser(tx: Prisma.TransactionClient, userId: number) {
  // Token creation and user deactivation must serialize on the user row. A
  // non-locking status read here would leave a TOCTOU window between checking
  // the subject and persisting a newly issued token pair.
  const users = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
      AND "status" = ${UserStatus.ACTIVE}::"UserStatus"
    FOR UPDATE
  `)

  return users.length === 1
}

export function consumeOAuthAuthorizationCodeAndCreateTokenPair(params: {
  authorizationCodeId: string
  accessTokenHash: string
  refreshTokenHash: string
  clientId: string
  userId: number
  scopes: string[]
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}) {
  return prisma.$transaction(async (tx) => {
    if (!await lockActiveOAuthUser(tx, params.userId)) {
      return null
    }

    const consumed = await tx.oAuthAuthorizationCode.updateMany({
      where: {
        id: params.authorizationCodeId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    })

    if (consumed.count !== 1) {
      return null
    }

    const accessToken = await tx.oAuthAccessToken.create({
      data: {
        tokenHash: params.accessTokenHash,
        clientId: params.clientId,
        userId: params.userId,
        scopes: params.scopes,
        expiresAt: params.accessTokenExpiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    })

    await tx.oAuthRefreshToken.create({
      data: {
        tokenHash: params.refreshTokenHash,
        accessTokenId: accessToken.id,
        clientId: params.clientId,
        userId: params.userId,
        scopes: params.scopes,
        expiresAt: params.refreshTokenExpiresAt,
      },
      select: {
        id: true,
      },
    })

    return accessToken
  })
}

export function findOAuthAccessTokenByHash(tokenHash: string) {
  return prisma.oAuthAccessToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      clientId: true,
      userId: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
          email: true,
          emailVerifiedAt: true,
          avatarPath: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      client: {
        select: {
          clientId: true,
          status: true,
        },
      },
    },
  })
}

export function findOAuthRefreshTokenByHash(tokenHash: string) {
  return prisma.oAuthRefreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tokenHash: true,
      accessTokenId: true,
      clientId: true,
      userId: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
      rotatedAt: true,
      client: {
        select: {
          clientId: true,
          clientSecretHash: true,
          status: true,
        },
      },
    },
  })
}

export function rotateOAuthRefreshToken(params: {
  oldRefreshTokenId: string
  oldAccessTokenId?: string | null
  accessTokenHash: string
  refreshTokenHash: string
  clientId: string
  userId: number
  scopes: string[]
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}) {
  return prisma.$transaction(async (tx) => {
    if (!await lockActiveOAuthUser(tx, params.userId)) {
      return null
    }

    const updated = await tx.oAuthRefreshToken.updateMany({
      where: {
        id: params.oldRefreshTokenId,
        revokedAt: null,
        rotatedAt: null,
      },
      data: {
        revokedAt: new Date(),
        rotatedAt: new Date(),
      },
    })

    if (updated.count !== 1) {
      return null
    }

    if (params.oldAccessTokenId) {
      await tx.oAuthAccessToken.updateMany({
        where: {
          id: params.oldAccessTokenId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      })
    }

    const accessToken = await tx.oAuthAccessToken.create({
      data: {
        tokenHash: params.accessTokenHash,
        clientId: params.clientId,
        userId: params.userId,
        scopes: params.scopes,
        expiresAt: params.accessTokenExpiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    })

    await tx.oAuthRefreshToken.create({
      data: {
        tokenHash: params.refreshTokenHash,
        accessTokenId: accessToken.id,
        clientId: params.clientId,
        userId: params.userId,
        scopes: params.scopes,
        expiresAt: params.refreshTokenExpiresAt,
      },
    })

    return accessToken
  })
}

export function revokeOAuthTokenByHash(tokenHash: string, clientId: string, tokenTypeHint?: string) {
  return prisma.$transaction(async (tx) => {
    if (tokenTypeHint !== "refresh_token") {
      const access = await tx.oAuthAccessToken.updateMany({
        where: {
          tokenHash,
          clientId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      })

      if (access.count > 0 || tokenTypeHint === "access_token") {
        return access.count
      }
    }

    const refresh = await tx.oAuthRefreshToken.updateMany({
      where: {
        tokenHash,
        clientId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })

    return refresh.count
  })
}
