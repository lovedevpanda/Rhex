import type { Metadata } from "next"

import { NotificationsPagination } from "@/components/notifications-pagination"
import { NotificationsToolbar } from "@/components/notifications-toolbar"
import { NotificationListItem } from "@/components/notification-list-item"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getUserNotifications, getUserUnreadNotificationCount } from "@/lib/notifications"
import { getSiteSettings } from "@/lib/site-settings"

const PAGE_SIZE = 20

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `通知 - ${settings.siteName}`,
  }
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function buildNotificationsHref(params: { after?: string | null; before?: string | null }) {
  const query = new URLSearchParams()

  if (params.after) {
    query.set("after", params.after)
  }

  if (params.before) {
    query.set("before", params.before)
  }

  const queryString = query.toString()
  return queryString ? `/notifications?${queryString}` : "/notifications"
}

export default async function NotificationsPage(
  props: {
    searchParams?: Promise<{ after?: string | string[]; before?: string | string[] }>
  }
) {
  const searchParams = await props.searchParams
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-[900px] px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>消息通知</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">请先登录后查看通知。</CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const resolvedSearchParams = searchParams ?? undefined
  const after = readParam(resolvedSearchParams?.after)
  const before = readParam(resolvedSearchParams?.before)

  const [{ items: notifications, hasPrevPage, hasNextPage, prevCursor, nextCursor }, unreadCount] = await Promise.all([
    getUserNotifications(user.id, { pageSize: PAGE_SIZE, after, before }),
    getUserUnreadNotificationCount(user.id),
  ])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>消息通知</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NotificationsToolbar unreadCount={unreadCount} />
              {notifications.length === 0 ? <p className="text-sm text-muted-foreground">暂时还没有新的通知。</p> : null}
              {notifications.map((notification: (typeof notifications)[number]) => (

                <NotificationListItem
                  key={notification.id}
                  id={notification.id}
                  href={notification.relatedUrl}
                  isRead={notification.isRead}
                  typeLabel={notification.typeLabel}
                  title={notification.title}
                  content={notification.content}
                  senderName={notification.senderName}
                  createdAt={notification.createdAt}
                />
              ))}
              <NotificationsPagination
                prevHref={hasPrevPage && prevCursor ? buildNotificationsHref({ before: prevCursor }) : null}
                nextHref={hasNextPage && nextCursor ? buildNotificationsHref({ after: nextCursor }) : null}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
