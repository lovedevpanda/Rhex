const AUTH_REDIRECT_FALLBACK = "/"
const AUTH_REDIRECT_BLOCKED_PATHS = new Set(["/login", "/register", "/forgot-password"])

export function normalizeAuthRedirectTarget(value: unknown, fallback = AUTH_REDIRECT_FALLBACK) {
  const rawValue = typeof value === "string" ? value.trim() : ""
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return fallback
  }

  let url: URL
  try {
    url = new URL(rawValue, "https://local.invalid")
  } catch {
    return fallback
  }

  if (url.origin !== "https://local.invalid") {
    return fallback
  }

  const pathname = url.pathname || "/"
  if (AUTH_REDIRECT_BLOCKED_PATHS.has(pathname)) {
    return fallback
  }

  /**
   * 归一化之后再断言一次 —— 只查输入前缀是不够的。
   *
   * WHATWG URL 解析会先折叠路径里的 `.` / `..`：
   *   new URL("/..//evil.com", "https://local.invalid").pathname === "//evil.com"
   * 而 origin 校验照样通过（仍是 local.invalid），于是返回值成了协议相对 URL。
   * 调用方（例如 src/app/login/page.tsx 的 redirect()）把它写进 Location 头时，
   * 浏览器解析成 https://evil.com/ —— 开放重定向。
   *
   * 等价绕过：`/.//evil.com`、`/a/..//evil.com`、`/..///evil.com`。
   */
  if (pathname.startsWith("//")) {
    return fallback
  }

  return `${pathname}${url.search}${url.hash}` || fallback
}

export function buildLoginHrefWithRedirect(value: unknown, fallback = "/login") {
  const redirectTarget = normalizeAuthRedirectTarget(value, "")
  return redirectTarget
    ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
    : fallback
}

export function getCurrentBrowserAuthRedirectTarget(fallback = AUTH_REDIRECT_FALLBACK) {
  if (typeof window === "undefined") {
    return fallback
  }

  return normalizeAuthRedirectTarget(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    fallback,
  )
}
