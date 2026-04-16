import type { Metadata } from "next"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { NotificationsPagination } from "@/components/notification/notifications-pagination"
import { NotificationsToolbar } from "@/components/notification/notifications-toolbar"
import { NotificationListItem } from "@/components/notification/notification-list-item"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getUserNotifications } from "@/lib/notifications"
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
          <AddonSlotRenderer slot="notifications.page.before" />
          <Card>
            <CardHeader>
              <CardTitle>消息通知</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">请先登录后查看通知。</CardContent>
          </Card>
          <AddonSlotRenderer slot="notifications.page.after" />
        </main>
      </div>
    )
  }

  const resolvedSearchParams = searchParams ?? undefined
  const after = readParam(resolvedSearchParams?.after)
  const before = readParam(resolvedSearchParams?.before)

  const { items: notifications, hasPrevPage, hasNextPage, prevCursor, nextCursor } = await getUserNotifications(user.id, {
    pageSize: PAGE_SIZE,
    after,
    before,
  })

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <div className="space-y-6">
          <AddonSlotRenderer slot="notifications.page.before" />
          <AddonSurfaceRenderer surface="notifications.page" props={{ notifications, user }}>
            <Card>
              <CardHeader>
                <CardTitle>消息通知</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AddonSlotRenderer slot="notifications.toolbar.before" />
                <AddonSurfaceRenderer surface="notifications.toolbar" props={{ user }}>
                  <NotificationsToolbar />
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="notifications.toolbar.after" />
                <AddonSlotRenderer slot="notifications.list.before" />
                <AddonSurfaceRenderer surface="notifications.list" props={{ hasNextPage, hasPrevPage, nextCursor, notifications, prevCursor }}>
                  <>
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
                  </>
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="notifications.list.after" />
              </CardContent>
            </Card>
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="notifications.page.after" />
        </div>
      </main>
    </div>
  )
}
