export async function verifyTurnstileToken(token: string, remoteip?: string | null) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secretKey) {
    throw new Error("未配置 Turnstile 服务端密钥")
  }

  const body = new URLSearchParams()
  body.set("secret", secretKey)
  body.set("response", token)
  if (remoteip) {
    body.set("remoteip", remoteip)
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Turnstile 校验请求失败")
  }

  const result = await response.json() as {
    success?: boolean
    "error-codes"?: string[]
  }

  if (!result.success) {
    const errorMessage = result["error-codes"]?.join(", ") || "验证码校验失败"
    throw new Error(errorMessage)
  }

  return true
}
