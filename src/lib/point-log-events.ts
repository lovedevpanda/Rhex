import type { Prisma } from "@/db/types"

export const POINT_LOG_EVENT_TYPES = {
  GENERIC: "GENERIC",
  BOARD_POST_CHARGE: "BOARD_POST_CHARGE",
  BOARD_REPLY_CHARGE: "BOARD_REPLY_CHARGE",
  BOARD_TREASURY_WITHDRAW: "BOARD_TREASURY_WITHDRAW",
  POST_BLOCK_PURCHASE_PAID: "POST_BLOCK_PURCHASE_PAID",
  POST_BLOCK_PURCHASE_SOLD: "POST_BLOCK_PURCHASE_SOLD",
  POST_GIFT_RECEIVED: "POST_GIFT_RECEIVED",
  POST_GIFT_SENT: "POST_GIFT_SENT",
  POST_TIP_RECEIVED: "POST_TIP_RECEIVED",
  POST_TIP_SENT: "POST_TIP_SENT",
} as const

export type PointLogEventType = (typeof POINT_LOG_EVENT_TYPES)[keyof typeof POINT_LOG_EVENT_TYPES]
export type PointLogEventDataInput = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
export type PointLogEventDataValue = Prisma.JsonValue | null

export function normalizePointLogEventType(eventType?: string | null): PointLogEventType {
  if (typeof eventType === "string" && eventType.trim()) {
    return eventType.trim().toUpperCase() as PointLogEventType
  }

  return POINT_LOG_EVENT_TYPES.GENERIC
}
