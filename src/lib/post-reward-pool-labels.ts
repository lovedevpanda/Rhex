import { PostRedPacketClaimOrderMode, PostRedPacketGrantMode, PostRedPacketTriggerType } from "@/db/types"

const RED_PACKET_TRIGGER_LABELS: Record<PostRedPacketTriggerType, string> = {
  REPLY: "回复帖子",
  LIKE: "点赞帖子",
  FAVORITE: "收藏帖子",
}

const RED_PACKET_GRANT_MODE_LABELS: Record<PostRedPacketGrantMode, string> = {
  FIXED: "固定红包",
  RANDOM: "拼手气红包",
}

const RED_PACKET_CLAIM_ORDER_MODE_LABELS: Record<PostRedPacketClaimOrderMode, string> = {
  FIRST_COME_FIRST_SERVED: "先到先得",
  RANDOM: "随机机会",
}

export function getPostRedPacketTriggerLabel(triggerType: PostRedPacketTriggerType) {
  return RED_PACKET_TRIGGER_LABELS[triggerType]
}

export function getPostRedPacketGrantModeLabel(grantMode: PostRedPacketGrantMode) {
  return RED_PACKET_GRANT_MODE_LABELS[grantMode]
}

export function getPostRedPacketClaimOrderModeLabel(claimOrderMode: PostRedPacketClaimOrderMode) {
  return RED_PACKET_CLAIM_ORDER_MODE_LABELS[claimOrderMode]
}
