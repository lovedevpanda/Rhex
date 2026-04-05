import { prisma } from "@/db/client"
import { Prisma, PointEffectDirection, PointEffectRuleKind, PointEffectTargetType } from "@/db/types"

export interface PointEffectRuleRow {
  id: string
  badgeId: string | null
  badgeName: string | null
  badgeIconText: string | null
  badgeColor: string | null
  name: string
  description: string | null
  targetType: PointEffectTargetType
  scopeKeys: string[]
  ruleKind: PointEffectRuleKind
  direction: PointEffectDirection
  value: number
  extraValue: number | null
  startMinuteOfDay: number | null
  endMinuteOfDay: number | null
  sortOrder: number
  status: boolean
  createdAt: Date
  updatedAt: Date
}

export function listAllPointEffectRuleRows() {
  return prisma.$queryRaw<PointEffectRuleRow[]>(Prisma.sql`
    SELECT
      effect."id",
      effect."badgeId",
      badge."name" AS "badgeName",
      badge."iconText" AS "badgeIconText",
      badge."color" AS "badgeColor",
      effect."name",
      effect."description",
      effect."targetType",
      effect."scopeKeys",
      effect."ruleKind",
      effect."direction",
      effect."value",
      effect."extraValue",
      effect."startMinuteOfDay",
      effect."endMinuteOfDay",
      effect."sortOrder",
      effect."status",
      effect."createdAt",
      effect."updatedAt"
    FROM "PointEffectRule" effect
    LEFT JOIN "Badge" badge ON badge."id" = effect."badgeId"
    ORDER BY effect."sortOrder" ASC, effect."createdAt" ASC
  `)
}

export function listGlobalActivePointEffectRuleRows() {
  return prisma.$queryRaw<PointEffectRuleRow[]>(Prisma.sql`
    SELECT
      effect."id",
      effect."badgeId",
      NULL::TEXT AS "badgeName",
      NULL::TEXT AS "badgeIconText",
      NULL::TEXT AS "badgeColor",
      effect."name",
      effect."description",
      effect."targetType",
      effect."scopeKeys",
      effect."ruleKind",
      effect."direction",
      effect."value",
      effect."extraValue",
      effect."startMinuteOfDay",
      effect."endMinuteOfDay",
      effect."sortOrder",
      effect."status",
      effect."createdAt",
      effect."updatedAt"
    FROM "PointEffectRule" effect
    WHERE effect."status" = true AND effect."badgeId" IS NULL
    ORDER BY effect."sortOrder" ASC, effect."createdAt" ASC
  `)
}
