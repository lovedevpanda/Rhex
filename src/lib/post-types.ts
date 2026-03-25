import type { PostStatus } from "@/db/types"

export const POST_TYPES = ["NORMAL", "BOUNTY", "POLL", "LOTTERY"] as const

export type LocalPostType = (typeof POST_TYPES)[number]

export const DEFAULT_POST_TYPE: LocalPostType = "NORMAL"
export const DEFAULT_ALLOWED_POST_TYPES: LocalPostType[] = [...POST_TYPES]
export const DEFAULT_ALLOWED_POST_TYPES_VALUE = POST_TYPES.join(",")

export function isLocalPostType(value: unknown): value is LocalPostType {
  return typeof value === "string" && POST_TYPES.includes(value as LocalPostType)
}

export function normalizePostType(value: unknown, fallback: LocalPostType = DEFAULT_POST_TYPE): LocalPostType {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : ""
  return isLocalPostType(normalizedValue) ? normalizedValue : fallback
}

export function normalizePostTypes(value?: string | null): LocalPostType[] {
  if (!value) {
    return [...DEFAULT_ALLOWED_POST_TYPES]
  }

  const items = value
    .split(",")
    .map((item) => normalizePostType(item, DEFAULT_POST_TYPE))
    .filter((item, index, array) => array.indexOf(item) === index)

  return items.length > 0 ? items : [...DEFAULT_ALLOWED_POST_TYPES]
}

export function serializePostTypes(values?: readonly LocalPostType[] | null): string {
  if (!values || values.length === 0) {
    return DEFAULT_ALLOWED_POST_TYPES_VALUE
  }

  const uniqueValues = values.filter((item, index, array) => isLocalPostType(item) && array.indexOf(item) === index)
  return uniqueValues.length > 0 ? uniqueValues.join(",") : DEFAULT_ALLOWED_POST_TYPES_VALUE
}

export function getPostTypeLabel(type: LocalPostType | string) {
  switch (type) {
    case "BOUNTY":
      return "悬赏帖"
    case "POLL":
      return "投票帖"
    case "LOTTERY":
      return "抽奖帖"
    case "NORMAL":
    default:
      return "普通帖"
  }
}

export function getPostStatusLabel(status: PostStatus | string) {
  switch (status) {
    case "PENDING":
      return "待审核"
    case "OFFLINE":
      return "已下线"
    case "LOCKED":
      return "已锁定"
    case "DELETED":
      return "已删除"
    case "NORMAL":
    default:
      return "正常"
  }
}

export function shouldPostBePending(postType: LocalPostType | string) {
  return postType === "BOUNTY" || postType === "POLL"
}
