import { findSidebarUserCheckInRecord } from "@/db/home-sidebar-queries"
import { getUnreadConversationCount } from "@/db/message-read-queries"
import { countUnreadNotifications } from "@/db/notification-read-queries"

export interface HeaderUnreadCounts {
  unreadNotificationCount: number
  unreadMessageCount: number
}

export interface HeaderQuickActionsState {
  checkedInToday: boolean
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function getHeaderUnreadCounts(userId?: number | null): Promise<HeaderUnreadCounts> {
  if (!userId) {
    return {
      unreadNotificationCount: 0,
      unreadMessageCount: 0,
    }
  }

  const [unreadNotificationCount, unreadMessageCount] = await Promise.all([
    countUnreadNotifications(userId),
    getUnreadConversationCount(userId),
  ])

  return {
    unreadNotificationCount,
    unreadMessageCount,
  }
}

export async function getHeaderQuickActionsState(userId?: number | null): Promise<HeaderQuickActionsState> {
  if (!userId) {
    return {
      checkedInToday: false,
    }
  }

  const checkInRecord = await findSidebarUserCheckInRecord(userId, getLocalDateKey())

  return {
    checkedInToday: Boolean(checkInRecord),
  }
}
