import { PrismaClient } from "@prisma/client"

type DbCacheEntry = {
  expiresAt: number
  createdAt: number
  value: unknown
  byteSize: number
}

type GlobalPrismaState = {
  prisma?: PrismaClient
  prismaCache?: Map<string, DbCacheEntry>
  prismaCacheCleanupTimer?: ReturnType<typeof setInterval>
}

type PrismaModelOperation = {
  readonly model: string
  readonly action: string
}

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
])

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
])

const DEFAULT_CACHE_TTL_MS = 5_000
const DEFAULT_CACHE_MAX_ENTRIES = 10000 //最大缓存数量
const DEFAULT_CACHE_MAX_VALUE_BYTES = 1024 * 1024 //单条大小 1024kb
const DEFAULT_CACHE_MAX_HEAP_MB = 1024 //1024MB
const DEFAULT_CACHE_CLEANUP_INTERVAL_MS = 60_000 //默认每 60s 清一次

const globalForPrisma = globalThis as unknown as GlobalPrismaState
const prismaCache = globalForPrisma.prismaCache ?? new Map<string, DbCacheEntry>()
globalForPrisma.prismaCache = prismaCache

const shouldLogDbCache = process.env.NODE_ENV !== "production"
  && process.env.DB_CLIENT_CACHE_LOG !== "false"

function getPositiveNumberFromEnv(rawValue: string | undefined, fallback: number) {
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return parsedValue
}

function getCacheTtlMs() {
  return getPositiveNumberFromEnv(process.env.DB_CLIENT_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS)
}

function getCacheMaxEntries() {
  return Math.max(1, Math.floor(getPositiveNumberFromEnv(process.env.DB_CLIENT_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_ENTRIES)))
}

function getCacheMaxValueBytes() {
  return Math.max(256, Math.floor(getPositiveNumberFromEnv(process.env.DB_CLIENT_CACHE_MAX_VALUE_BYTES, DEFAULT_CACHE_MAX_VALUE_BYTES)))
}

function getCacheMaxHeapBytes() {
  const heapLimitInMb = getPositiveNumberFromEnv(process.env.DB_CLIENT_CACHE_MAX_HEAP_MB, DEFAULT_CACHE_MAX_HEAP_MB)
  return Math.floor(heapLimitInMb * 1024 * 1024)
}

function getCacheCleanupIntervalMs() {
  return Math.max(1_000, Math.floor(getPositiveNumberFromEnv(process.env.DB_CLIENT_CACHE_CLEANUP_INTERVAL_MS, DEFAULT_CACHE_CLEANUP_INTERVAL_MS)))
}

function normalizeCacheValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: "Date", value: value.toISOString() }
  }

  if (Array.isArray(value)) {
    return value.map(normalizeCacheValue)
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeCacheValue(nestedValue)]),
    )
  }

  return value
}

function safeSerialize(value: unknown) {
  try {
    return JSON.stringify(normalizeCacheValue(value ?? null))
  } catch {
    return null
  }
}

function buildCacheKey(operation: PrismaModelOperation, args: unknown) {
  const serializedArgs = safeSerialize(args)

  if (serializedArgs === null) {
    return null
  }

  return `${operation.model}:${operation.action}:${serializedArgs}`
}

function getApproximateByteSize(value: unknown) {
  const serializedValue = safeSerialize(value)

  if (serializedValue === null) {
    return null
  }

  return Buffer.byteLength(serializedValue, "utf8")
}

function logDbCache(message: string, details?: Record<string, unknown>) {
  void message
  void details

  if (!shouldLogDbCache) {
    return
  }

  // 可在本地调试时临时恢复日志输出
}




function pruneExpiredCacheEntries(now = Date.now()) {
  let deletedCount = 0

  for (const [cacheKey, entry] of prismaCache.entries()) {
    if (entry.expiresAt <= now) {
      prismaCache.delete(cacheKey)
      deletedCount += 1
    }
  }

  if (deletedCount > 0) {
    logDbCache("expired cache pruned", { deletedCount, remaining: prismaCache.size })
  }
}

function pruneCacheToLimit(maxEntries = getCacheMaxEntries()) {
  if (prismaCache.size <= maxEntries) {
    return
  }

  const overflowCount = prismaCache.size - maxEntries
  const sortedEntries = [...prismaCache.entries()].sort((left, right) => left[1].createdAt - right[1].createdAt)

  for (let index = 0; index < overflowCount; index += 1) {
    const cacheKey = sortedEntries[index]?.[0]
    if (cacheKey) {
      prismaCache.delete(cacheKey)
    }
  }

  logDbCache("cache pruned to limit", {
    maxEntries,
    overflowCount,
    remaining: prismaCache.size,
  })
}

function clearCacheForMemoryPressure(reason: string) {
  const cacheSize = prismaCache.size
  prismaCache.clear()
  logDbCache("cache cleared for memory pressure", { reason, clearedCount: cacheSize })
}

function shouldBypassCacheForMemoryPressure() {
  const heapUsed = process.memoryUsage().heapUsed
  const heapLimit = getCacheMaxHeapBytes()

  if (heapUsed < heapLimit) {
    return false
  }

  clearCacheForMemoryPressure("heapUsed exceeds configured threshold")
  return true
}

function ensureCacheMaintenanceTimer() {
  if (globalForPrisma.prismaCacheCleanupTimer) {
    return
  }

  const timer = setInterval(() => {
    pruneExpiredCacheEntries()

    if (process.memoryUsage().heapUsed >= getCacheMaxHeapBytes()) {
      clearCacheForMemoryPressure("periodic heap guard")
      return
    }

    pruneCacheToLimit()
  }, getCacheCleanupIntervalMs())

  timer.unref?.()
  globalForPrisma.prismaCacheCleanupTimer = timer
}

function getCachedValue<T>(cacheKey: string): { hit: boolean, value?: T } {
  const cached = prismaCache.get(cacheKey)

  if (!cached) {
    return { hit: false }
  }

  if (cached.expiresAt <= Date.now()) {
    prismaCache.delete(cacheKey)
    logDbCache("cache expired", { key: cacheKey })
    return { hit: false }
  }

  logDbCache("cache hit", { key: cacheKey })
  return {
    hit: true,
    value: cached.value as T,
  }
}

function setCachedValue(cacheKey: string, value: unknown) {
  pruneExpiredCacheEntries()

  if (shouldBypassCacheForMemoryPressure()) {
    return
  }

  const byteSize = getApproximateByteSize(value)
  if (byteSize === null) {
    logDbCache("cache skipped: serialization failed", { key: cacheKey })
    return
  }

  if (byteSize > getCacheMaxValueBytes()) {
    logDbCache("cache skipped: value too large", {
      key: cacheKey,
      byteSize,
      maxValueBytes: getCacheMaxValueBytes(),
    })
    return
  }

  const ttlMs = getCacheTtlMs()

  prismaCache.set(cacheKey, {
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    value,
    byteSize,
  })

  pruneCacheToLimit()
  logDbCache("cache set", { key: cacheKey, ttlMs, byteSize, size: prismaCache.size })
}

function invalidateModelCache(model: string) {
  const prefix = `${model}:`
  let invalidatedCount = 0

  for (const cacheKey of prismaCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      prismaCache.delete(cacheKey)
      invalidatedCount += 1
    }
  }

  logDbCache("cache invalidated", { model, invalidatedCount })
}

function isPrismaModelDelegate(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function isReadOperation(action: string) {
  return READ_OPERATIONS.has(action)
}

function isWriteOperation(action: string) {
  return WRITE_OPERATIONS.has(action)
}

function createCachedModelDelegate<T extends Record<string, unknown>>(
  delegate: T,
  operation: Pick<PrismaModelOperation, "model">,
): T {
  return new Proxy(delegate, {
    get(target, property, receiver) {
      const original = Reflect.get(target, property, receiver)

      if (typeof property !== "string" || typeof original !== "function") {
        return original
      }

      const originalMethod = original as (...args: unknown[]) => Promise<unknown>

      if (!isReadOperation(property) && !isWriteOperation(property)) {
        return originalMethod.bind(target)
      }

      return async (...args: unknown[]) => {
        if (isReadOperation(property)) {
          const operationContext = { model: operation.model, action: property }
          const cacheKey = buildCacheKey(operationContext, args[0])

          if (!cacheKey || shouldBypassCacheForMemoryPressure()) {
            return originalMethod.apply(target, args)
          }

          const cached = getCachedValue(cacheKey)

          if (cached.hit) {
            return cached.value
          }

          logDbCache("cache miss", {
            model: operation.model,
            action: property,
            key: cacheKey,
          })

          const result = await originalMethod.apply(target, args)
          setCachedValue(cacheKey, result)
          return result
        }

        const result = await originalMethod.apply(target, args)
        logDbCache("write success, invalidating model cache", {
          model: operation.model,
          action: property,
        })
        invalidateModelCache(operation.model)
        return result
      }
    },
  })
}

function createCachedPrismaClient(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, property) {
      if (property === "$transaction" || typeof property === "symbol") {
        return Reflect.get(target, property, target)
      }


      const original = Reflect.get(target, property, target)

      if (typeof property !== "string" || !isPrismaModelDelegate(original)) {
        return original
      }

      return createCachedModelDelegate(original, { model: property })
    },
  }) as PrismaClient
}


ensureCacheMaintenanceTimer()

const basePrismaClient = globalForPrisma.prisma ?? new PrismaClient({
  log: ["error"],
})

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrismaClient
}

export const prisma = createCachedPrismaClient(basePrismaClient)
export const db = prisma
