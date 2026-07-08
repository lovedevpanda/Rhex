"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import {  Eye, EyeOff, LockKeyhole, ShieldCheck, Smartphone, UserRound } from "lucide-react"

import { AuthField, AuthFormSection, AuthInlineMessage } from "@/components/auth/auth-form-primitives"
import { BuiltinCaptchaField } from "@/components/auth/builtin-captcha-field"
import { ExternalAuthEntry } from "@/components/auth/external-auth-entry"
import { PowCaptchaField } from "@/components/auth/pow-captcha-field"
import { SmsCaptchaDialog, type SmsCaptchaPayload } from "@/components/auth/sms-captcha-dialog"
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
import { normalizeAuthRedirectTarget } from "@/lib/auth-redirect"
import type { AddonExternalAuthEntry } from "@/lib/addon-external-auth-providers"
import type { SiteSettingsData } from "@/lib/site-settings"
import { SMS_CODE_COOLDOWN_SECONDS } from "@/lib/sms-verification"

interface LoginFormProps {
  settings: SiteSettingsData
  smsAvailable: boolean
  addonBeforeFields?: ReactNode
  addonCaptcha?: ReactNode
  addonAfterFields?: ReactNode
  addonExternalAuthEntries?: AddonExternalAuthEntry[]
  redirectTarget?: string
}

export function LoginForm({
  settings,
  smsAvailable,
  addonBeforeFields,
  addonCaptcha,
  addonAfterFields,
  addonExternalAuthEntries = [],
  redirectTarget = "/",
}: LoginFormProps) {
  const [loginMode, setLoginMode] = useState<"password" | "phone-code">("password")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [phoneCode, setPhoneCode] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [powNonce, setPowNonce] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false)
  const [phoneCodeCountdown, setPhoneCodeCountdown] = useState(0)
  const [smsCaptchaOpen, setSmsCaptchaOpen] = useState(false)

  const captchaMode = settings.loginCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"
  const usePowCaptcha = captchaMode === "POW"
  const hasAlternativeAuth = settings.authGithubEnabled || settings.authGoogleEnabled || settings.authPasskeyEnabled || addonExternalAuthEntries.length > 0
  const hasCaptchaSection = useTurnstile || useBuiltinCaptcha || usePowCaptcha || Boolean(addonCaptcha)
  const showLoginModeSwitch = smsAvailable

  useEffect(() => {
    if (phoneCodeCountdown <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setPhoneCodeCountdown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phoneCodeCountdown])

  useEffect(() => {
    if (!smsAvailable && loginMode === "phone-code") {
      setLoginMode("password")
    }
  }, [loginMode, smsAvailable])

  async function sendPhoneCode(captchaPayload: SmsCaptchaPayload = {}) {
    if (!login.trim()) {
      setMessage("请先输入手机号")
      return
    }

    if (!smsAvailable) {
      setMessage("当前站点未配置短信发送能力")
      return
    }

    setSendingPhoneCode(true)
    setMessage("")

    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: "PHONE",
          target: login,
          purpose: "login",
          ...captchaPayload,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "短信验证码发送失败")
      }

      setMessage(result.message ?? "验证码已发送到手机")
      setSmsCaptchaOpen(false)
      setPhoneCodeCountdown(Number(result.data?.cooldownSeconds ?? SMS_CODE_COOLDOWN_SECONDS))
    } catch (error) {
      setSmsCaptchaOpen(false)
      setMessage(error instanceof Error ? error.message : "短信验证码发送失败")
    } finally {
      setSendingPhoneCode(false)
    }
  }

  function handleSendPhoneCode() {
    if (!login.trim()) {
      setMessage("请先输入手机号")
      return
    }

    if (!smsAvailable) {
      setMessage("当前站点未配置短信发送能力")
      return
    }

    if (phoneCodeCountdown > 0 || sendingPhoneCode) {
      return
    }

    if (settings.smsCaptchaMode === "OFF") {
      void sendPhoneCode()
      return
    }

    setSmsCaptchaOpen(true)
  }

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
        password: loginMode === "password" ? password : undefined,
        loginMode,
        phoneCode: loginMode === "phone-code" ? phoneCode : undefined,
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

    const target = normalizeAuthRedirectTarget(redirectTarget)
    window.location.replace(target)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {addonBeforeFields ? (
        <AuthFormSection>{addonBeforeFields}</AuthFormSection>
      ) : null}

      <AuthFormSection>
        {showLoginModeSwitch ? (
          <div className="flex gap-2">
            <Button type="button" variant={loginMode === "password" ? "default" : "outline"} onClick={() => setLoginMode("password")}>密码登录</Button>
            <Button type="button" variant={loginMode === "phone-code" ? "default" : "outline"} onClick={() => setLoginMode("phone-code")}>短信登录</Button>
          </div>
        ) : null}

        <AuthField htmlFor="login-identity" label={loginMode === "password" ? "邮箱 / 用户名 / 手机号" : "手机号"} required>
          <InputGroup className="h-11 rounded-2xl bg-background/80">
            <InputGroupAddon>
              {loginMode === "password" ? <UserRound /> : <Smartphone />}
            </InputGroupAddon>
            <InputGroupInput
              id="login-identity"
              name="login"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder={loginMode === "password" ? "输入邮箱、用户名或手机号" : "输入已绑定手机号"}
            />
          </InputGroup>
        </AuthField>

        {loginMode === "password" ? (
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
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </AuthField>
        ) : (
          <AuthField htmlFor="login-phone-code" label="短信验证码" required>
            <InputGroup className="h-11 rounded-2xl bg-background/80">
              <InputGroupAddon>
                <ShieldCheck />
              </InputGroupAddon>
              <InputGroupInput
                id="login-phone-code"
                name="phoneCode"
                value={phoneCode}
                onChange={(event) => setPhoneCode(event.target.value)}
                placeholder="输入 6 位验证码"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  variant="secondary"
                  onClick={handleSendPhoneCode}
                  disabled={sendingPhoneCode || phoneCodeCountdown > 0 || !login}
                >
                  {sendingPhoneCode ? <Spinner data-icon="inline-start" /> : null}
                  {sendingPhoneCode ? "发送中" : phoneCodeCountdown > 0 ? `${phoneCodeCountdown}s` : "发送验证码"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </AuthField>
        )}
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
        <AuthInlineMessage tone={message.includes("成功") || message.includes("已发送") ? "success" : "destructive"}>
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
            </>
          )}
        </Button>
      </div>

      {hasAlternativeAuth ? <ExternalAuthEntry settings={settings} mode="login" addonEntries={addonExternalAuthEntries} redirectTarget={redirectTarget} /> : null}

      <SmsCaptchaDialog
        open={smsCaptchaOpen}
        mode={settings.smsCaptchaMode}
        siteKey={settings.turnstileSiteKey}
        sending={sendingPhoneCode}
        onClose={() => setSmsCaptchaOpen(false)}
        onVerified={(payload) => sendPhoneCode(payload)}
      />
    </form>
  )
}
