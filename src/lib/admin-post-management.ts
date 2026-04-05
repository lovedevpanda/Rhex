export interface AdminPostListItem {
  id: string
  title: string
  slug: string
  href?: string

  summary: string | null
  boardName: string
  boardSlug: string
  zoneName: string | null
  authorId: number
  authorName: string
  authorUsername: string
  authorStatus: string
  createdAt: string
  publishedAt: string | null
  updatedAt: string
  commentCount: number
  likeCount: number
  favoriteCount: number
  viewCount: number
  score: number
  tipCount: number
  tipTotalPoints: number
  type: string
  typeLabel: string
  status: string
  statusLabel: string
  reviewNote: string | null
  isPinned: boolean
  pinScope: string | null
  isFeatured: boolean
  isAnnouncement: boolean
}

export interface AdminPostListResult {
  posts: AdminPostListItem[]
  actorRole: "ADMIN" | "MODERATOR"
  boardOptions: Array<{
    slug: string
    name: string
    zoneName: string | null
  }>

  filters: {
    type: string
    status: string
    board: string
    keyword: string
    sort: string
    pin: string
    featured: string
    review: string
  }
  summary: {
    total: number
    pending: number
    normal: number
    offline: number
    pinned: number
    featured: number
    announcement: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}
