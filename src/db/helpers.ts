import { prisma } from "@/db/client"
import { normalizePageSize, normalizePositiveInteger } from "@/lib/shared/normalizers"

export type DbTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface PaginationInput {
  page?: unknown
  pageSize?: unknown
}

export interface PaginationResult {
  page: number
  pageSize: number
  total: number
  totalPages: number
  skip: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export function withDbTransaction<T>(
  callback: (tx: DbTransaction) => Promise<T>,
) {
  return prisma.$transaction((tx) => callback(tx))
}

export async function resolveCountMap<const TKey extends string>(
  entries: ReadonlyArray<readonly [TKey, Promise<number>]>,
): Promise<Record<TKey, number>> {
  const results = await Promise.all(entries.map(async ([key, task]) => [key, await task] as const))
  return Object.fromEntries(results) as Record<TKey, number>
}

export function resolvePagination(
  input: PaginationInput,
  total: number,
  pageSizeOptions: readonly number[] = [20, 50, 100],
  fallbackPageSize = 20,
): PaginationResult {
  const pageSize = normalizePageSize(input.pageSize, pageSizeOptions, fallbackPageSize)
  const requestedPage = normalizePositiveInteger(input.page, 1)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)

  return {
    page,
    pageSize,
    total,
    totalPages,
    skip: (page - 1) * pageSize,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}


