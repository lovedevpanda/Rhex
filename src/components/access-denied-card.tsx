import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AccessDeniedCardProps {
  title: string
  description: string
  reason: string
  isLoggedIn?: boolean
}

export function AccessDeniedCard({ title, description, reason, isLoggedIn = false }: AccessDeniedCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
        <p>{description}</p>
        <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          当前访问受限：{reason}
        </div>
        <div className="flex gap-3">
          {!isLoggedIn ? (
            <Link href="/login">
              <Button>去登录</Button>
            </Link>
          ) : null}
          <Link href="/">
            <Button variant="outline">返回首页</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
