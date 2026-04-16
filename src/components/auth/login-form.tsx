"use client"

import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useState } from "react"
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react"

import { AuthField, AuthFormSection, AuthInlineMessage } from "@/components/auth/auth-form-primitives"
import { BuiltinCaptchaField } from "@/components/auth/builtin-captcha-field"
import { ExternalAuthEntry } from "@/components/auth/external-auth-entry"
import { PowCaptchaField } from "@/components/auth/pow-captcha-field"
import { TurnstileCaptchaField } from "@/components/auth/turnstile-captcha-field"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { collectAddonAuthFieldsFromFormData } from "@/lib/addon-auth-fields"
import type { AddonExternalAuthEntry } from "@/lib/addon-external-auth-providers"
import type { SiteSettingsData } from "@/lib/site-settings"

interface LoginFormProps {
  settings: SiteSettingsData
  addonCaptcha?: ReactNode
  addonAfterFields?: ReactNode
  addonExternalAuthEntries?: AddonExternalAuthEntry[]
}

export function LoginForm({
  settings,
  addonCaptcha,
  addonAfterFields,
  addonExternalAuthEntries = [],
}: LoginFormProps) {
  const router = useRouter()
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [powNonce, setPowNonce] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const captchaMode = settings.loginCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"
  const usePowCaptcha = captchaMode === "POW"
  const hasAlternativeAuth = settings.authGithubEnabled || settings.authGoogleEnabled || settings.authPasskeyEnabled || addonExternalAuthEntries.length > 0
  const hasCaptchaSection = useTurnstile || useBuiltinCaptcha || usePowCaptcha || Boolean(addonCaptcha)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    const addonFields = collectAddonAuthFieldsFromFormData(
      new FormData(event.currentTarget),
    )

    if ((useTurnstile || useBuiltinCaptcha || usePowCaptcha) && !captchaToken) {
      setMessage("请先完成验证码验证")
      setLoading(false)
      return
    }

    if (useBuiltinCaptcha && !builtinCaptchaCode.trim()) {
      setMessage("请输入图形验证码")
      setLoading(false)
      return
    }

    if (usePowCaptcha && !powNonce) {
      setMessage("请先完成工作量证明验证")
      setLoading(false)
      return
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login,
        password,
        captchaToken,
        builtinCaptchaCode,
        powNonce,
        addonFields,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? "登录失败"
      setMessage(errorMessage)
      toast.error(errorMessage, "登录失败")
      setLoading(false)
      return
    }

    const successMessage = "登录成功，正在跳转到首页…"
    setMessage(successMessage)
    toast.success(successMessage, "登录成功")
    router.push("/")
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AuthFormSection>
        <AuthField htmlFor="login-identity" label="邮箱 / 用户名" required>
          <InputGroup className="h-11 rounded-2xl bg-background/80">
            <InputGroupAddon>
              <UserRound />
            </InputGroupAddon>
            <InputGroupInput
              id="login-identity"
              name="login"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="输入邮箱或用户名"
            />
          </InputGroup>
        </AuthField>

        <AuthField htmlFor="login-password" label="密码" required>
          <InputGroup className="h-11 rounded-2xl bg-background/80">
            <InputGroupAddon>
              <LockKeyhole />
            </InputGroupAddon>
            <InputGroupInput
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </AuthField>
      </AuthFormSection>

      {hasCaptchaSection ? (
        <AuthFormSection>
          {useTurnstile && settings.turnstileSiteKey ? (
            <TurnstileCaptchaField siteKey={settings.turnstileSiteKey} onTokenChange={setCaptchaToken} />
          ) : null}

          {useBuiltinCaptcha ? (
            <BuiltinCaptchaField
              code={builtinCaptchaCode}
              onCodeChange={setBuiltinCaptchaCode}
              onTokenChange={setCaptchaToken}
              onLoadError={setMessage}
            />
          ) : null}

          {usePowCaptcha ? (
            <PowCaptchaField
              scope="login"
              onTokenChange={setCaptchaToken}
              onNonceChange={setPowNonce}
              onLoadError={setMessage}
            />
          ) : null}

          {addonCaptcha}
        </AuthFormSection>
      ) : null}

      {addonAfterFields ? (
        <AuthFormSection>{addonAfterFields}</AuthFormSection>
      ) : null}

      {message ? (
        <AuthInlineMessage tone={message.includes("成功") ? "success" : "destructive"}>
          {message}
        </AuthInlineMessage>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
          {loading ? (
            <>
              <Spinner data-icon="inline-start" />
              登录中...
            </>
          ) : (
            <>
              登录
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>

      {hasAlternativeAuth ? <ExternalAuthEntry settings={settings} mode="login" addonEntries={addonExternalAuthEntries} /> : null}
    </form>
  )
}
