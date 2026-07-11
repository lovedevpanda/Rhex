import { NextResponse } from "next/server"

import { apiError, createRouteHandler } from "@/lib/api-route"
import { createPowCaptchaChallenge, hasPowCaptchaSecret, parsePowCaptchaScope } from "@/lib/pow-captcha"
import { getRequestIp } from "@/lib/request-ip"
import { withPublicWriteGuard } from "@/lib/public-write-guard"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const GET = createRouteHandler(async ({ request }) => withPublicWriteGuard("auth-pow", { request }, async () => {
  if (!hasPowCaptchaSecret()) {
    apiError(503, "当前未配置 PoW 验证码密钥")
  }

  const scope = parsePowCaptchaScope(new URL(request.url).searchParams.get("scope"))
  const challenge = createPowCaptchaChallenge({
    scope,
    requestIp: getRequestIp(request),
    requestUserAgent: request.headers.get("user-agent"),
  })

  return NextResponse.json(
    {
      code: 0,
      data: {
        captchaToken: challenge.challenge,
        difficulty: challenge.difficulty,
        expiresAt: challenge.expiresAt,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}), {
  errorMessage: "获取 PoW 验证码失败",
  logPrefix: "[api/auth/pow] unexpected error",
})
