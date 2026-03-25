export interface AdminReportItem {
  id: string
  targetType: "POST" | "COMMENT" | "USER"
  targetId: string
  reasonType: string
  reasonDetail: string | null
  status: "PENDING" | "PROCESSING" | "RESOLVED" | "REJECTED"
  createdAt: string
  handledAt: string | null
  handledNote: string | null
  reporter: {
    id: number
    username: string
    displayName: string
  }
  handler: {
    id: number
    username: string
    displayName: string
  } | null
  targetSummary: {
    title: string
    description: string
    href: string
  }
}

export interface AdminReportListResult {
  reports: AdminReportItem[]
  summary: {
    total: number
    pending: number
    processing: number
    resolved: number
    rejected: number
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

