import type { NextRequest } from "next/server"

import { buildUnauthorizedResponse, getSessionFromRequest, isProtectedPath } from "@/lib/auth-guards"

export async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return
  }

  const session = await getSessionFromRequest(request)
  if (!session) {
    return buildUnauthorizedResponse(request)
  }
}

export const config = {
  matcher: ["/write/:path*", "/settings/:path*", "/admin/:path*", "/api/posts/create", "/api/comments/create", "/api/profile/update", "/api/admin/:path*"],
}
