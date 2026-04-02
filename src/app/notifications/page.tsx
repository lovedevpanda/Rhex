import type { Metadata } from "next"
import { redirect } from "next/navigation"

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

function parsePageParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  const page = Number(rawValue)

  if (!Number.isInteger(page) || page < 1) {
    return 1
  }

  return page
}

function buildPageHref(page: number) {
  return page <= 1 ? "/notifications" : `/notifications?page=${page}`
}

export default async function NotificationsPage(
  props: {
    searchParams?: Promise<{ page?: string | string[] }>
  }
) {
  const searchParams = await props.searchParams;
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

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const requestedPage = parsePageParam(resolvedSearchParams?.page)

  const [{ items: notifications, totalCount }, unreadCount] = await Promise.all([
    getUserNotifications(user.id, requestedPage, PAGE_SIZE),
    getUserUnreadNotificationCount(user.id),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)

  if (requestedPage !== currentPage) {
    redirect(buildPageHref(currentPage))
  }

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
              <NotificationsPagination currentPage={currentPage} totalPages={totalPages} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
