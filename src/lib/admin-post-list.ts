import { PostStatus } from "@/db/types"

import type { Prisma } from "@/db/types"
import type { findAdminPostBoardOptions, findAdminPostsPage } from "@/db/admin-post-management-queries"
import type { AdminPostListItem, AdminPostListResult } from "@/lib/admin-post-management"
import type { AdminActor } from "@/lib/moderator-permissions"

import { normalizePageSize, normalizePositiveInteger } from "@/lib/shared/normalizers"
import { buildManagedPostWhereInput } from "@/lib/moderator-permissions"
import { getPostStatusLabel, getPostTypeLabel, isLocalPostType, type LocalPostType } from "@/lib/post-types"

export interface AdminPostQuery {
  keyword?: string
  type?: string
  status?: string
  boardSlug?: string
  sort?: string
  pin?: string
  featured?: string
  review?: string
  page?: number
  pageSize?: number
}

export type AdminPostSort =
  | "newest"
  | "oldest"
  | "recentReply"
  | "mostComments"
  | "mostLikes"
  | "mostViews"
  | "highestScore"

export type AdminPostPinFilter = "ALL" | "pinned" | "not-pinned"
export type AdminPostFeaturedFilter = "ALL" | "featured" | "not-featured"
export type AdminPostReviewFilter = "ALL" | "reviewed" | "unreviewed"

export interface NormalizedAdminPostQuery {
  keyword: string
  type: string
  status: string
  boardSlug: string
  sort: AdminPostSort
  pin: AdminPostPinFilter
  featured: AdminPostFeaturedFilter
  review: AdminPostReviewFilter
  page: number
  pageSize: number
}

type AdminPostPageRecord = Awaited<ReturnType<typeof findAdminPostsPage>>[number]
type AdminPostBoardOptionRecord = Awaited<ReturnType<typeof findAdminPostBoardOptions>>[number]

export function normalizeAdminPostSort(sort?: string): AdminPostSort {
  switch (sort) {
    case "oldest":
    case "recentReply":
    case "mostComments":
    case "mostLikes":
    case "mostViews":
    case "highestScore":
      return sort
    default:
      return "newest"
  }
}

export function normalizeAdminPostQuery(query: AdminPostQuery = {}): NormalizedAdminPostQuery {
  return {
    keyword: query.keyword?.trim() ?? "",
    type: query.type && query.type !== "" ? query.type : "ALL",
    status: query.status && query.status !== "" ? query.status : "ALL",
    boardSlug: query.boardSlug ?? "",
    sort: normalizeAdminPostSort(query.sort),
    pin: query.pin === "pinned" || query.pin === "not-pinned" ? query.pin : "ALL",
    featured: query.featured === "featured" || query.featured === "not-featured" ? query.featured : "ALL",
    review: query.review === "reviewed" || query.review === "unreviewed" ? query.review : "ALL",
    page: normalizePositiveInteger(query.page, 1),
    pageSize: normalizePageSize(query.pageSize),
  }
}

export function buildAdminPostWhere(actor: AdminActor, query: NormalizedAdminPostQuery): Prisma.PostWhereInput {
  return {
    ...(buildManagedPostWhereInput(actor) ?? {}),
    ...(isLocalPostType(query.type) ? { type: query.type as LocalPostType } : {}),
    ...(query.status !== "ALL" ? { status: query.status as PostStatus } : {}),
    ...(query.boardSlug ? { board: { slug: query.boardSlug } } : {}),
    ...(query.pin === "pinned" ? { isPinned: true } : {}),
    ...(query.pin === "not-pinned" ? { isPinned: false } : {}),
    ...(query.featured === "featured" ? { isFeatured: true } : {}),
    ...(query.featured === "not-featured" ? { isFeatured: false } : {}),
    ...(query.review === "reviewed" ? { NOT: { reviewNote: null } } : {}),
    ...(query.review === "unreviewed" ? { reviewNote: null } : {}),
    ...(query.keyword
      ? {
          OR: [
            { title: { contains: query.keyword, mode: "insensitive" } },
            { summary: { contains: query.keyword, mode: "insensitive" } },
            { author: { username: { contains: query.keyword, mode: "insensitive" } } },
            { author: { nickname: { contains: query.keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }
}

export function buildAdminPostOrderBy(sort: AdminPostSort): Prisma.PostOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }]
    case "recentReply":
      return [{ lastCommentedAt: "desc" }, { createdAt: "desc" }]
    case "mostComments":
      return [{ commentCount: "desc" }, { createdAt: "desc" }]
    case "mostLikes":
      return [{ likeCount: "desc" }, { createdAt: "desc" }]
    case "mostViews":
      return [{ viewCount: "desc" }, { createdAt: "desc" }]
    case "highestScore":
      return [{ score: "desc" }, { createdAt: "desc" }]
    default:
      return [{ status: "asc" }, { createdAt: "desc" }]
  }
}

export function mapAdminPostListItem(post: AdminPostPageRecord): AdminPostListItem {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary ?? null,
    boardName: post.board.name,
    boardSlug: post.board.slug,
    zoneName: post.board.zone?.name ?? null,
    authorId: post.author.id,
    authorName: post.author.nickname ?? post.author.username,
    authorUsername: post.author.username,
    authorStatus: post.author.status,
    createdAt: post.createdAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
    commentCount: post.commentCount,
    likeCount: post.likeCount,
    favoriteCount: post.favoriteCount,
    viewCount: post.viewCount,
    score: post.score,
    tipCount: post.tipCount,
    tipTotalPoints: post.tipTotalPoints,
    type: post.type,
    typeLabel: getPostTypeLabel(post.type),
    status: post.status,
    statusLabel: getPostStatusLabel(post.status),
    reviewNote: post.reviewNote ?? null,
    isPinned: post.isPinned,
    pinScope: post.pinScope === "NONE" ? null : post.pinScope,
    isFeatured: post.isFeatured,
    isAnnouncement: post.isAnnouncement,
  }
}

export function mapAdminPostBoardOption(board: AdminPostBoardOptionRecord): AdminPostListResult["boardOptions"][number] {
  return {
    slug: board.slug,
    name: board.name,
    zoneName: board.zone?.name ?? null,
  }
}

export function buildAdminPostFilters(query: NormalizedAdminPostQuery): AdminPostListResult["filters"] {
  return {
    type: query.type,
    status: query.status,
    board: query.boardSlug,
    keyword: query.keyword,
    sort: query.sort,
    pin: query.pin,
    featured: query.featured,
    review: query.review,
  }
}

