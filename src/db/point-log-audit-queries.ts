import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { normalizeAuditedPointLogEntry, type PointLogAuditEntry } from "@/lib/point-log-audit"

type PointLogClient = Prisma.TransactionClient | typeof prisma

export function createPointLogWithAudit(client: PointLogClient, entry: PointLogAuditEntry) {
  return client.pointLog.create({
    data: normalizeAuditedPointLogEntry(entry),
  })
}

export function createPointLogsWithAudit(client: PointLogClient, entries: PointLogAuditEntry[]) {
  if (entries.length === 0) {
    return Promise.resolve({ count: 0 })
  }

  return client.pointLog.createMany({
    data: entries.map(normalizeAuditedPointLogEntry),
  })
}

