import { PrismaClient } from "@prisma/client/index"

type GlobalPrismaState = {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as typeof globalThis & GlobalPrismaState

const prismaClient = globalForPrisma.prisma ?? new PrismaClient({
  log: ["error"],
})

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient
}

export const prisma = prismaClient
export const db = prisma
