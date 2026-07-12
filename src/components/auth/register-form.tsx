"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  UserRound,
  Users,
} from "lucide-react"

import { VerificationChannel } from "@/lib/shared/verification-channel"
import { useEffect, useMemo, useState } from "react"

import { useRouter, useSearchParams } from "next/navigation"

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { collectAddonAuthFieldsFromFormData } from "@/lib/addon-auth-fields"
import type { AddonExternalAuthEntry } from "@/lib/addon-external-auth-providers"
import { buildLoginHrefWithRedirect, normalizeAuthRedirectTarget } from "@/lib/auth-redirect"
import { isEmailInWhitelist } from "@/lib/email"
import { validatePasswordPolicy } from "@/lib/password-policy"
import type { SiteSettingsData } from "@/lib/site-settings"
import { SMS_CODE_COOLDOWN_SECONDS } from "@/lib/sms-verification"
import { findUsernameSensitiveWord } from "@/lib/username-sensitive-words"

function getUsernameValidationMessage(value: string, settings: SiteSettingsData) {
  const username = value.trim()

  if (!username) {
    return ""
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return "用户名需为 3-20 位字母、数字或下划线"
  }

  const matchedWord = findUsernameSensitiveWord(username, settings)
  return matchedWord ? `用户名包含敏感词：${matchedWord}` : ""
}

function getNicknameValidationMessage(value: string, settings: SiteSettingsData) {
  if (!settings.registerNicknameEnabled) {
    return ""
  }

  const nickname = value.trim()
  if (!nickname) {
    return ""
  }

  if (/\s/.test(value)) {
    return "昵称不能包含空格"
  }

  if (nickname.length < settings.registerNicknameMinLength) {
    return `昵称长度不能少于 ${settings.registerNicknameMinLength} 个字符`
  }

  if (nickname.length > settings.registerNicknameMaxLength) {
    return `昵称长度不能超过 ${settings.registerNicknameMaxLength} 个字符`
  }

  const matchedWord = findUsernameSensitiveWord(nickname, settings)
  return matchedWord ? `昵称包含敏感词：${matchedWord}` : ""
}

function withRegisterSuccessToast(target: string) {
  const url = new URL(target, window.location.origin)
  url.searchParams.set("rhexToast", "register-success")
  return `${url.pathname}${url.search}${url.hash}`
}

interface RegisterFormProps {
  settings: SiteSettingsData
  addonBeforeFields?: ReactNode
  addonCaptcha?: ReactNode
  addonAfterFields?: ReactNode
  addonExternalAuthEntries?: AddonExternalAuthEntry[]
}

export function RegisterForm({
  settings,
  addonBeforeFields,
  addonCaptcha,
  addonAfterFields,
  addonExternalAuthEntries = [],
}: RegisterFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialInviterUsername = searchParams.get("invite") ?? searchParams.get("inviter") ?? ""
  const initialInviteCode = (searchParams.get("code") ?? "").toUpperCase()
  const redirectTarget = normalizeAuthRedirectTarget(searchParams.get("redirect"), "/")
  const [username, setUsername] = useState("")
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [phoneCode, setPhoneCode] = useState("")
  const [gender, setGender] = useState("unknown")
  const [inviterUsername, setInviterUsername] = useState(initialInviterUsername)
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [captchaToken, setCaptchaToken] = useState("")
  const [builtinCaptchaCode, setBuiltinCaptchaCode] = useState("")
  const [powNonce, setPowNonce] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState("")

  const [phoneMessage, setPhoneMessage] = useState("")
  const [emailSending, setEmailSending] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneCodeCountdown, setPhoneCodeCountdown] = useState(0)
  const [smsCaptchaOpen, setSmsCaptchaOpen] = useState(false)

  const captchaMode = settings.registerCaptchaMode
  const useTurnstile = captchaMode === "TURNSTILE" && Boolean(settings.turnstileSiteKey)
  const useBuiltinCaptcha = captchaMode === "BUILTIN"
  const usePowCaptcha = captchaMode === "POW"
  const inviteCodeHelpUrl = typeof settings.registerInviteCodeHelpUrl === "string"
    ? settings.registerInviteCodeHelpUrl.trim()
    : ""
  const inviteCodeHelpTitle = typeof settings.registerInviteCodeHelpTitle === "string"
    ? settings.registerInviteCodeHelpTitle.trim() || "如何获得邀请码？"
    : "如何获得邀请码？"
  const showInviteCodeHelpLink = settings.registerInviteCodeEnabled && settings.registerInviteCodeHelpEnabled && inviteCodeHelpUrl.length > 0
  const inviteCodeHelpIsExternal = /^https?:\/\//i.test(inviteCodeHelpUrl)
  const emailFieldDescription = useMemo(() => {
    const messages: string[] = []

    if (settings.registerEmailVerification) {
      messages.push("需要验证码确认")
    }

    if (settings.registerEmailWhitelistEnabled && settings.registerEmailWhitelistDomains.length > 0) {
      messages.push(`仅允许后缀：${settings.registerEmailWhitelistDomains.join("、")}`)
    }

    return messages.join("；")
  }, [
    settings.registerEmailVerification,
    settings.registerEmailWhitelistDomains,
    settings.registerEmailWhitelistEnabled,
  ])

  const hiddenInviterBound = useMemo(() => !settings.registerInviterEnabled && !!inviterUsername, [settings.registerInviterEnabled, inviterUsername])
  const hiddenInviteCodeBound = useMemo(() => !settings.registerInviteCodeEnabled && !!inviteCode, [settings.registerInviteCodeEnabled, inviteCode])
  const hasAlternativeAuth = settings.authGithubEnabled || settings.authGoogleEnabled || settings.authPasskeyEnabled || addonExternalAuthEntries.length > 0
  const hasSecurityStep = useTurnstile || useBuiltinCaptcha || usePowCaptcha || Boolean(addonCaptcha)
  const usernameValidationMessage = getUsernameValidationMessage(username, settings)
  const usernameInvalid = Boolean(usernameValidationMessage)
  const nicknameValidationMessage = getNicknameValidationMessage(nickname, settings)
  const nicknameInvalid = Boolean(nicknameValidationMessage)
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const passwordPolicyResult = password
    ? validatePasswordPolicy(password, { minLength: settings.registerPasswordMinLength, strength: settings.registerPasswordStrength })
    : { success: true, message: "" }
  const passwordPolicyInvalid = password.length > 0 && !passwordPolicyResult.success

  function emailPassesWhitelist(value: string) {
    return !settings.registerEmailWhitelistEnabled
      || !value
      || isEmailInWhitelist(value, settings.registerEmailWhitelistDomains)
  }

  useEffect(() => {
    if (phoneCodeCountdown <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setPhoneCodeCountdown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phoneCodeCountdown])

  async function sendCode(channel: VerificationChannel, captchaPayload: SmsCaptchaPayload = {}) {
    const target = channel === VerificationChannel.EMAIL ? email : phone
    const setSending = channel === VerificationChannel.EMAIL ? setEmailSending : setPhoneSending
    const setFieldMessage = channel === VerificationChannel.EMAIL ? setEmailMessage : setPhoneMessage

    setSending(true)
    setFieldMessage("")

    if (channel === VerificationChannel.EMAIL && target && !emailPassesWhitelist(target)) {
      setFieldMessage("该邮箱后缀不在注册白名单内")
      setSending(false)
      return
    }

    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, target, ...captchaPayload }),
      })

      const result = await response.json()
      setFieldMessage(result.message ?? (response.ok ? "验证码已发送" : "验证码发送失败"))

      if (channel === VerificationChannel.PHONE) {
        setSmsCaptchaOpen(false)
      }

      if (response.ok && channel === VerificationChannel.PHONE) {
        setPhoneCodeCountdown(Number(result.data?.cooldownSeconds ?? SMS_CODE_COOLDOWN_SECONDS))
      }
    } catch {
      if (channel === VerificationChannel.PHONE) {
        setSmsCaptchaOpen(false)
      }

      setFieldMessage("验证码发送失败")
    } finally {
      setSending(false)
    }
  }

  function handleSendPhoneCode() {
    if (phoneCodeCountdown > 0 || phoneSending) {
      return
    }

    if (settings.smsCaptchaMode === "OFF") {
      void sendCode(VerificationChannel.PHONE)
      return
    }

    setSmsCaptchaOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    const addonFields = collectAddonAuthFieldsFromFormData(
      new FormData(event.currentTarget),
    )

    if (usernameInvalid) {
      toast.warning(usernameValidationMessage, "注册校验")
      setLoading(false)
      return
    }

    if (nicknameInvalid) {
      toast.warning(nicknameValidationMessage, "注册校验")
      setLoading(false)
      return
    }

    if (passwordPolicyInvalid) {
      toast.warning(passwordPolicyResult.message, "注册校验")
      setLoading(false)
      return
    }

    if (passwordMismatch) {
      toast.warning("两次输入的密码不一致", "注册校验")
      setLoading(false)
      return
    }

    if ((useTurnstile || useBuiltinCaptcha || usePowCaptcha) && !captchaToken) {
      toast.warning("请先完成验证码验证", "注册校验")
      setLoading(false)
      return
    }

    if (useBuiltinCaptcha && !builtinCaptchaCode.trim()) {
      toast.warning("请输入图形验证码", "注册校验")
      setLoading(false)
      return
    }

    if (usePowCaptcha && !powNonce) {
      toast.warning("请先完成工作量证明验证", "注册校验")
      setLoading(false)
      return
    }

    if (settings.registerEmailEnabled && settings.registerEmailVerification && !emailCode) {
      toast.warning("请填写邮箱验证码", "注册校验")
      setLoading(false)
      return
    }

    if (settings.registerEmailEnabled && email && !emailPassesWhitelist(email)) {
      toast.warning("该邮箱后缀不在注册白名单内", "注册校验")
      setLoading(false)
      return
    }

    if (settings.registerPhoneEnabled && settings.registerPhoneVerification && !phoneCode) {
      toast.warning("请填写手机验证码", "注册校验")
      setLoading(false)
      return
    }

    if (settings.registrationRequireInviteCode && !inviteCode) {
      toast.warning("请填写邀请码", "注册校验")
      setLoading(false)
      return
    }


    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        nickname,
        password,
        inviterUsername,
        inviteCode,
        email,
        emailCode,
        phone,
        phoneCode,
        gender,
        captchaToken,
        builtinCaptchaCode,
        powNonce,
        addonFields,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMessage = result.message ?? "注册失败"
      toast.error(errorMessage, "注册失败")
      setLoading(false)
      return
    }

    const autoLogin = Boolean(result.data?.autoLogin)

    if (autoLogin) {
      window.location.replace(withRegisterSuccessToast(redirectTarget))
      return
    }

    router.replace(withRegisterSuccessToast(buildLoginHrefWithRedirect(redirectTarget)))
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {addonBeforeFields ? (
        <AuthFormSection>{addonBeforeFields}</AuthFormSection>
      ) : null}

      <AuthFormSection>
        <AuthField htmlFor="register-username" label="用户名" required>
          <InputGroup className="h-11 rounded-2xl bg-background/80" data-invalid={usernameInvalid || undefined}>
            <InputGroupAddon>
              <UserRound />
            </InputGroupAddon>
            <InputGroupInput
              id="register-username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="设置用户名"
              autoComplete="username"
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]{3,20}"
              aria-invalid={usernameInvalid || undefined}
              required
            />
          </InputGroup>
          {usernameValidationMessage ? (
            <AuthInlineMessage tone="destructive">{usernameValidationMessage}</AuthInlineMessage>
          ) : null}
        </AuthField>

        {settings.registerNicknameEnabled ? (
          <AuthField
            htmlFor="register-nickname"
            label="昵称"
            required={settings.registerNicknameRequired}
          >
            <InputGroup className="h-11 rounded-2xl bg-background/80" data-invalid={nicknameInvalid || undefined}>
              <InputGroupAddon>
                <Sparkles />
              </InputGroupAddon>
              <InputGroupInput
                id="register-nickname"
                name="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={settings.registerNicknameRequired ? "设置昵称" : "设置昵称（可选）"}
                minLength={settings.registerNicknameMinLength}
                maxLength={settings.registerNicknameMaxLength}
                aria-invalid={nicknameInvalid || undefined}
                required={settings.registerNicknameRequired}
              />
            </InputGroup>
            {nicknameValidationMessage ? (
              <AuthInlineMessage tone="destructive">{nicknameValidationMessage}</AuthInlineMessage>
            ) : null}
          </AuthField>
        ) : null}

        <AuthField htmlFor="register-password" label="密码" required>
          <InputGroup className="h-11 rounded-2xl bg-background/80" data-invalid={passwordPolicyInvalid || undefined}>
            <InputGroupAddon>
              <LockKeyhole />
            </InputGroupAddon>
            <InputGroupInput
              id="register-password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="设置密码"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={settings.registerPasswordMinLength}
              aria-invalid={passwordPolicyInvalid || undefined}
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff data-icon /> : <Eye data-icon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {passwordPolicyInvalid ? (
            <AuthInlineMessage tone="destructive">{passwordPolicyResult.message}</AuthInlineMessage>
          ) : null}
        </AuthField>

        <AuthField htmlFor="register-confirm-password" label="确认密码" required>
          <InputGroup className="h-11 rounded-2xl bg-background/80" data-invalid={passwordMismatch || undefined}>
            <InputGroupAddon>
              <LockKeyhole />
            </InputGroupAddon>
            <InputGroupInput
              id="register-confirm-password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="再次输入密码"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={passwordMismatch || undefined}
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                tabIndex={-1}
                aria-label={showConfirmPassword ? "隐藏确认密码" : "显示确认密码"}
                onClick={() => setShowConfirmPassword((current) => !current)}
              >
                {showConfirmPassword ? <EyeOff data-icon /> : <Eye data-icon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {passwordMismatch ? (
            <AuthInlineMessage tone="destructive">两次输入的密码不一致</AuthInlineMessage>
          ) : null}
        </AuthField>

        {settings.registerGenderEnabled ? (
          <AuthField label="性别" required={settings.registerGenderRequired}>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="h-11 rounded-2xl bg-background/80">
                <SelectValue placeholder="选择性别" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="unknown">保密</SelectItem>
                  <SelectItem value="male">男</SelectItem>
                  <SelectItem value="female">女</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </AuthField>
        ) : null}
      </AuthFormSection>

      {(settings.registerEmailEnabled || settings.registerPhoneEnabled) ? (
        <AuthFormSection>
          {settings.registerEmailEnabled ? (
            <VerificationField
              idPrefix="register-email"
              icon={Mail}
              label="邮箱"
              value={email}
              onChange={setEmail}
              code={emailCode}
              onCodeChange={setEmailCode}
              placeholder={settings.registerEmailRequired ? "请输入邮箱" : "邮箱（可选）"}
              required={settings.registerEmailRequired}
              verifyRequired={settings.registerEmailVerification}
              description={emailFieldDescription || undefined}
              sending={emailSending}
              message={emailMessage}
              onSend={() => sendCode(VerificationChannel.EMAIL)}
              type="email"
              autoComplete="email"
            />
          ) : null}

          {settings.registerPhoneEnabled ? (
            <VerificationField
              idPrefix="register-phone"
              icon={Smartphone}
              label="手机"
              value={phone}
              onChange={setPhone}
              code={phoneCode}
              onCodeChange={setPhoneCode}
              placeholder={settings.registerPhoneRequired ? "请输入手机号" : "手机号（可选）"}
              required={settings.registerPhoneRequired}
              verifyRequired={settings.registerPhoneVerification}
              sending={phoneSending}
              countdown={phoneCodeCountdown}
              message={phoneMessage}
              onSend={handleSendPhoneCode}
              autoComplete="tel"
            />
          ) : null}
        </AuthFormSection>
      ) : null}

      {(settings.registerInviterEnabled || settings.registerInviteCodeEnabled || hiddenInviterBound || hiddenInviteCodeBound) ? (
        <AuthFormSection>
          {settings.registerInviteCodeEnabled ? (
            <AuthField
              htmlFor="register-invite-code"
              label="邀请码"
              required={settings.registrationRequireInviteCode}
              description={showInviteCodeHelpLink ? (
                <Link
                  href={inviteCodeHelpUrl}
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  target={inviteCodeHelpIsExternal ? "_blank" : undefined}
                  rel={inviteCodeHelpIsExternal ? "noreferrer" : undefined}
                >
                  {inviteCodeHelpTitle}
                </Link>
              ) : undefined}
            >
              <div className="flex flex-col gap-2">
                <InputGroup className="h-11 rounded-2xl bg-background/80">
                  <InputGroupAddon>
                    <Ticket />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="register-invite-code"
                    name="inviteCode"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    placeholder={settings.registrationRequireInviteCode ? "请输入邀请码" : "有邀请码可填写"}
                    required={settings.registrationRequireInviteCode}
                    autoCapitalize="characters"
                  />
                </InputGroup>
              </div>
            </AuthField>
          ) : hiddenInviteCodeBound ? (
            <AuthInlineMessage tone="default">
              已通过链接绑定邀请码 <span className="font-mono font-medium text-foreground">{inviteCode}</span>，当前输入框已按后台设置隐藏。
            </AuthInlineMessage>
          ) : null}

          {settings.registerInviterEnabled ? (
            <AuthField htmlFor="register-inviter" label="邀请人用户名">
              <InputGroup className="h-11 rounded-2xl bg-background/80">
                <InputGroupAddon>
                  <Users />
                </InputGroupAddon>
                <InputGroupInput
                  id="register-inviter"
                  name="inviterUsername"
                  value={inviterUsername}
                  onChange={(event) => setInviterUsername(event.target.value)}
                  placeholder="选填，可填写邀请你的用户名"
                />
              </InputGroup>
            </AuthField>
          ) : hiddenInviterBound ? (
            <AuthInlineMessage tone="default">
              已通过链接绑定邀请人 <span className="font-medium text-foreground">{inviterUsername}</span>，当前输入框已按后台设置隐藏。
            </AuthInlineMessage>
          ) : null}
        </AuthFormSection>
      ) : null}

      {hasSecurityStep ? (
        <AuthFormSection>
          {useTurnstile && settings.turnstileSiteKey ? (
            <TurnstileCaptchaField siteKey={settings.turnstileSiteKey} onTokenChange={setCaptchaToken} />
          ) : null}

          {useBuiltinCaptcha ? (
            <BuiltinCaptchaField
              code={builtinCaptchaCode}
              onCodeChange={setBuiltinCaptchaCode}
              onTokenChange={setCaptchaToken}
              onLoadError={(message) => toast.error(message, "验证码")}
            />
          ) : null}

          {usePowCaptcha ? (
            <PowCaptchaField
              scope="register"
              onTokenChange={setCaptchaToken}
              onNonceChange={setPowNonce}
              onLoadError={(message) => toast.error(message, "PoW 验证")}
            />
          ) : null}

          {addonCaptcha}
        </AuthFormSection>
      ) : null}

      {addonAfterFields ? (
        <AuthFormSection>{addonAfterFields}</AuthFormSection>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading || usernameInvalid || nicknameInvalid || passwordPolicyInvalid || passwordMismatch}>
          {loading ? (
            <>
              <Spinner data-icon="inline-start" />
              注册中...
            </>
          ) : (
            <>
              创建账户
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>

      {hasAlternativeAuth ? <ExternalAuthEntry settings={settings} mode="register" addonEntries={addonExternalAuthEntries} /> : null}

      <SmsCaptchaDialog
        open={smsCaptchaOpen}
        mode={settings.smsCaptchaMode}
        siteKey={settings.turnstileSiteKey}
        sending={phoneSending}
        onClose={() => setSmsCaptchaOpen(false)}
        onVerified={(payload) => sendCode(VerificationChannel.PHONE, payload)}
      />
    </form>
  )
}

function VerificationField({
  idPrefix,
  icon: Icon,
  label,
  value,
  onChange,
  code,
  onCodeChange,
  placeholder,
  required,
  verifyRequired,
  description,
  sending,
  countdown = 0,
  message,
  onSend,
  type = "text",
  autoComplete,
}: {
  idPrefix: string
  icon: typeof Mail
  label: string
  value: string
  onChange: (value: string) => void
  code: string
  onCodeChange: (value: string) => void
  placeholder: string
  required: boolean
  verifyRequired: boolean
  description?: string
  sending: boolean
  countdown?: number
  message: string
  onSend: () => Promise<void> | void
  type?: "text" | "email" | "tel"
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl">
      <AuthField htmlFor={`${idPrefix}-value`} label={label} required={required} description={description}>
        <InputGroup className="h-11 rounded-2xl bg-background/80">
          <InputGroupAddon>
            <Icon />
          </InputGroupAddon>
          <InputGroupInput
            id={`${idPrefix}-value`}
            name={`${idPrefix}-value`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            required={required}
            type={type}
            autoComplete={autoComplete}
          />
        </InputGroup>
      </AuthField>
      {verifyRequired ? (
        <div className="flex flex-col gap-2">
          <AuthField htmlFor={`${idPrefix}-code`} label={`${label}验证码`} required description="请输入 6 位验证码">
            <InputGroup className="h-11 rounded-2xl bg-background/80">
              <InputGroupAddon>
                <ShieldCheck />
              </InputGroupAddon>
              <InputGroupInput
                id={`${idPrefix}-code`}
                name={`${idPrefix}-code`}
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
                placeholder="请输入 6 位验证码"
                required={verifyRequired}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  variant="secondary"
                  onClick={() => void onSend()}
                  disabled={sending || countdown > 0 || !value}
                >
                  {sending ? <Spinner data-icon="inline-start" /> : null}
                  {sending ? "发送中" : countdown > 0 ? `${countdown}s` : "发送验证码"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </AuthField>
          {message ? (
            <AuthInlineMessage tone={message.includes("已发送") ? "success" : "default"}>
              {message}
            </AuthInlineMessage>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
