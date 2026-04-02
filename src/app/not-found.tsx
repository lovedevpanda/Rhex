import Link from "next/link"
import { Compass, Home, LifeBuoy, SearchX } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { getSiteSettings } from "@/lib/site-settings"

export default async function GlobalNotFoundPage() {
  const settings = await getSiteSettings()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-1 py-10 lg:px-6 lg:py-16">
        <section className="mx-auto max-w-4xl rounded-[32px] border border-border bg-card px-6 py-10 shadow-sm sm:px-8 lg:px-12 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <SearchX className="h-3.5 w-3.5" />
                404 Not Found
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                你访问的页面不存在，或者已经被移动。
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                这通常意味着链接地址已失效、内容被删除，或者你输入了错误的路径。你可以返回首页继续浏览 {settings.siteName}，或者去帮助中心看看常用入口。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
                  <Home className="h-4 w-4" />
                  返回首页
                </Link>
                <Link href="/help" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent">
                  <LifeBuoy className="h-4 w-4" />
                  帮助中心
                </Link>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-background/80 p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-foreground">
                <Compass className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">你可以试试这些方向</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <div className="rounded-[20px] border border-border px-4 py-3">
                  检查地址是否输入正确，尤其是路径、大小写和参数部分。
                </div>
                <div className="rounded-[20px] border border-border px-4 py-3">
                  从首页、搜索页或帮助中心重新进入，通常能更快找到目标内容。
                </div>
                <div className="rounded-[20px] border border-border px-4 py-3">
                  如果这是站内旧链接，也可能是内容已下线或页面入口已调整。
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
