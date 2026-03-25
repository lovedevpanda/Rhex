import { NextResponse, type NextRequest } from "next/server"

import { getSessionCookieName, parseSessionToken } from "@/lib/session"

const PROTECTED_PAGE_PREFIXES = ["/write", "/settings", "/admin"]
const PROTECTED_API_PREFIXES = ["/api/posts/create", "/api/comments/create", "/api/profile/update", "/api/admin"]

export function isProtectedPath(pathname: string) {
  return [...PROTECTED_PAGE_PREFIXES, ...PROTECTED_API_PREFIXES].some((prefix) => pathname.startsWith(prefix))
}

export async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value
  return await parseSessionToken(token)
}

export function buildUnauthorizedResponse(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("redirect", `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}
