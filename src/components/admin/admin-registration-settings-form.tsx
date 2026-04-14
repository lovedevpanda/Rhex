"use client"

import { CircleHelp } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { AdminInviteCodeManager } from "@/components/admin/admin-invite-code-manager"
import {
  AdminBooleanSelectField,
  SettingsInputField as TextField,
  SettingsTextareaField,
} from "@/components/admin/admin-settings-fields"
import type { AdminRegistrationSettingsFormProps } from "@/components/admin/admin-basic-settings.types"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { adminPost } from "@/lib/admin-client"
import { renderEmailTemplate } from "@/lib/email-template-settings"

function extractEmailAddress(value: string) {
  const matched = value.match(/<([^<>@\s]+@[^<>@\s]+)>/)

  if (matched?.[1]) {
    return matched[1]
  }

  return /\S+@\S+\.\S+/.test(value) ? value.trim() : ""
}

function EmailTemplateSection({
  title,
  description,
  subject,
  text,
  html,
  onSubjectChange,
  onTextChange,
  onHtmlChange,
  previewVariables,
}: {
  title: string
  description: string
  subject: string
  text: string
  html: string
  onSubjectChange: (value: string) => void
  onTextChange: (value: string) => void
  onHtmlChange: (value: string) => void
  previewVariables: Record<string, string>
}) {
  const renderedSubject = renderEmailTemplate(subject, previewVariables)
  const renderedText = renderEmailTemplate(text, previewVariables)
  const renderedHtml = renderEmailTemplate(html, previewVariables)

  return (
    <div className="space-y-4 rounded-[20px] border border-border bg-background p-4">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="邮件主题" value={subject} onChange={onSubjectChange} placeholder="输入邮件主题模板" />
        <div className="rounded-[18px] border border-dashed border-border bg-card/60 px-4 py-3 text-xs leading-6 text-muted-foreground">
          可用变量：<code>{"{{siteName}}"}</code>、<code>{"{{code}}"}</code>、<code>{"{{username}}"}</code>。其中注册验证码邮件不会传入 <code>{"{{username}}"}</code>，留空会自动替换为空字符串。
          <div className="mt-3 grid gap-1">
            <p>当前预览变量：</p>
            <p><code>{"{{siteName}}"}</code> = {previewVariables.siteName || "(空)"}</p>
            <p><code>{"{{code}}"}</code> = {previewVariables.code || "(空)"}</p>
            <p><code>{"{{username}}"}</code> = {previewVariables.username || "(空)"}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">纯文本模板</p>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          className="min-h-[120px] w-full rounded-[20px] border border-border bg-card px-4 py-3 text-sm outline-hidden"
          placeholder="输入纯文本邮件内容模板"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-2">
          <p className="text-sm font-medium">HTML 模板</p>
          <textarea
            value={html}
            onChange={(event) => onHtmlChange(event.target.value)}
            className="min-h-[200px] w-full rounded-[20px] border border-border bg-card px-4 py-3 font-mono text-xs leading-6 outline-hidden"
            placeholder="输入 HTML 邮件内容模板"
          />
        </div>
        <div className="space-y-3 rounded-[20px] border border-border bg-card/60 p-4">
          <div>
            <p className="text-sm font-medium">模板预览</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">使用当前示例变量渲染主题、纯文本和 HTML，用于检查变量替换和版式效果。</p>
          </div>
          <div className="rounded-[16px] border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">渲染后的主题</p>
            <p className="mt-1 break-all text-sm font-medium">{renderedSubject || "（空）"}</p>
          </div>
          <div className="rounded-[16px] border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">渲染后的纯文本</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-foreground">{renderedText || "（空）"}</pre>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">HTML 预览</p>
            <iframe
              title={`${title} HTML 预览`}
              srcDoc={renderedHtml || "<div style='font-family:Arial,sans-serif;color:#666;padding:16px'>（空）</div>"}
              sandbox=""
              className="h-80 w-full rounded-[16px] border border-border bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function CaptchaModeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  onChange: (value: "OFF" | "TURNSTILE" | "BUILTIN" | "POW") => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as "OFF" | "TURNSTILE" | "BUILTIN" | "POW")}
        className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden"
      >
        <option value="OFF">关闭</option>
        <option value="TURNSTILE">Cloudflare Turnstile</option>
        <option value="BUILTIN">自建图形验证码</option>
        <option value="POW">PoW 工作量证明</option>
      </select>
    </div>
  )
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}

export function AdminRegistrationSettingsForm({
  activeSubTab,
  draft,
  updateDraftField,
  initialInviteCodes,
}: AdminRegistrationSettingsFormProps) {
  const [authDocOpen, setAuthDocOpen] = useState(false)
  const [siteOrigin, setSiteOrigin] = useState("https://your-domain.com")
  const [smtpTestRecipient, setSmtpTestRecipient] = useState(() => extractEmailAddress(draft.smtpFrom) || draft.smtpUser || "")
  const [isSendingSmtpTest, setIsSendingSmtpTest] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteOrigin(window.location.origin)
    }
  }, [])

  const siteHost = useMemo(() => siteOrigin.replace(/^https?:\/\//, "").replace(/\/.*$/, ""), [siteOrigin])
  const resolvedPasskeyRpId = draft.passkeyRpId || siteHost
  const resolvedPasskeyRpName = draft.passkeyRpName || draft.siteName || "你的站点名称"
  const resolvedPasskeyOrigin = draft.passkeyOrigin || siteOrigin
  const registerVerificationPreviewVariables = useMemo(() => ({
    siteName: draft.siteName.trim() || "示例站点",
    code: "246810",
    username: "",
  }), [draft.siteName])
  const resetPasswordPreviewVariables = useMemo(() => ({
    siteName: draft.siteName.trim() || "示例站点",
    code: "864209",
    username: "demo_user",
  }), [draft.siteName])

  async function handleSendSmtpTest() {
    setIsSendingSmtpTest(true)

    try {
      const result = await adminPost("/api/admin/site-settings/smtp-test", {
        recipient: smtpTestRecipient,
        siteName: draft.siteName,
        smtpHost: draft.smtpHost,
        smtpPort: Number(draft.smtpPort),
        smtpUser: draft.smtpUser,
        smtpPass: draft.smtpPass,
        smtpFrom: draft.smtpFrom,
        smtpSecure: draft.smtpSecure,
      }, {
        defaultSuccessMessage: "测试邮件发送成功",
        defaultErrorMessage: "测试邮件发送失败",
      })
      toast.success(result.message, "发送成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试邮件发送失败，请稍后再试", "发送失败")
    } finally {
      setIsSendingSmtpTest(false)
    }
  }

  return (
    <>
      {activeSubTab === "invite" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">注册与邀请码</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">控制注册开关、邀请码策略，以及用户邀请奖励。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <AdminBooleanSelectField label="允许新用户注册" checked={draft.registrationEnabled} onChange={(value) => updateDraftField("registrationEnabled", value)} />
            <AdminBooleanSelectField label="显示登录/注册页左侧内容" checked={draft.authPageShowcaseEnabled} onChange={(value) => updateDraftField("authPageShowcaseEnabled", value)} />
            <AdminBooleanSelectField label="显示邀请码输入框" checked={draft.registerInviteCodeEnabled} onChange={(value) => updateDraftField("registerInviteCodeEnabled", value)} />
            <AdminBooleanSelectField label="注册必须邀请码" checked={draft.registrationRequireInviteCode} onChange={(value) => updateDraftField("registrationRequireInviteCode", value)} />
            <AdminBooleanSelectField label="开启积分购买邀请码" checked={draft.inviteCodePurchaseEnabled} onChange={(value) => updateDraftField("inviteCodePurchaseEnabled", value)} />
          </div>
          {draft.registerInviteCodeEnabled ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AdminBooleanSelectField label="邀请码输入框链接开关" checked={draft.registerInviteCodeHelpEnabled} onChange={(value) => updateDraftField("registerInviteCodeHelpEnabled", value)} />
              <TextField label="链接标题" value={draft.registerInviteCodeHelpTitle} onChange={(value) => updateDraftField("registerInviteCodeHelpTitle", value)} placeholder="如何获得邀请码？" />
              <TextField label="链接地址" value={draft.registerInviteCodeHelpUrl} onChange={(value) => updateDraftField("registerInviteCodeHelpUrl", value)} placeholder="如 /faq/invite-codes 或 https://example.com/help" />
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField label="初始注册赠送积分" value={draft.registerInitialPoints} onChange={(value) => updateDraftField("registerInitialPoints", value)} placeholder="如 0" />
            <TextField label="邀请人奖励数量" value={draft.inviteRewardInviter} onChange={(value) => updateDraftField("inviteRewardInviter", value)} placeholder="如 10" />
            <TextField label="被邀请人奖励数量" value={draft.inviteRewardInvitee} onChange={(value) => updateDraftField("inviteRewardInvitee", value)} placeholder="如 5" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">填写 `0` 表示新用户首次注册时不额外赠送积分；若大于 `0`，会在注册成功后单独写入一条积分审计日志。</p>
        </div>
      ) : null}

      {activeSubTab === "captcha" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">注册防机器人验证码</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">支持关闭、Cloudflare Turnstile、自建图形验证码与 PoW 工作量证明四种模式。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CaptchaModeField label="注册验证码模式" value={draft.registerCaptchaMode} onChange={(value) => updateDraftField("registerCaptchaMode", value)} />
            <CaptchaModeField label="登录验证码模式" value={draft.loginCaptchaMode} onChange={(value) => updateDraftField("loginCaptchaMode", value)} />
            <TextField label="Turnstile Site Key" value={draft.turnstileSiteKey} onChange={(value) => updateDraftField("turnstileSiteKey", value)} placeholder="填写 Cloudflare Turnstile 公钥" />
            <TextField label="Turnstile Secret Key" type="password" value={draft.turnstileSecretKey} onChange={(value) => updateDraftField("turnstileSecretKey", value)} placeholder="填写 Cloudflare Turnstile 私钥" />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">当模式为 `TURNSTILE` 时，需要同时填写 Site Key 和 Secret Key；当模式为 `BUILTIN` 时，系统会使用站点自建图形验证码；当模式为 `POW` 时，系统会下发签名挑战并要求浏览器完成一次工作量证明，默认读取 `POW_CAPTCHA_SECRET_KEY`，未设置时回退到 `CAPTCHA_SECRET_KEY`。</p>
        </div>
      ) : null}

      {activeSubTab === "invite-codes" ? <AdminInviteCodeManager initialInviteCodes={initialInviteCodes} /> : null}

      {activeSubTab === "fields" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">注册表单字段</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">邮箱、手机、昵称、性别、邀请人等字段的显示与必填策略。</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <FieldGroup title="邮箱">
              <AdminBooleanSelectField label="显示邮箱输入框" checked={draft.registerEmailEnabled} onChange={(value) => updateDraftField("registerEmailEnabled", value)} />
              <AdminBooleanSelectField label="邮箱必填" checked={draft.registerEmailRequired} onChange={(value) => updateDraftField("registerEmailRequired", value)} />
              <AdminBooleanSelectField label="邮箱需要验证" checked={draft.registerEmailVerification} onChange={(value) => updateDraftField("registerEmailVerification", value)} />
              <AdminBooleanSelectField label="启用邮箱后缀白名单" checked={draft.registerEmailWhitelistEnabled} onChange={(value) => updateDraftField("registerEmailWhitelistEnabled", value)} />
              {draft.registerEmailWhitelistEnabled ? (
                <SettingsTextareaField
                  label="允许的邮箱后缀"
                  value={draft.registerEmailWhitelistDomains}
                  onChange={(value) => updateDraftField("registerEmailWhitelistDomains", value)}
                  placeholder={"支持换行、空格或逗号分隔，如\nqq.com\ngmail.com\nexample.org"}
                />
              ) : null}
            </FieldGroup>
            <FieldGroup title="手机">
              <AdminBooleanSelectField label="显示手机输入框" checked={draft.registerPhoneEnabled} onChange={(value) => updateDraftField("registerPhoneEnabled", value)} />
              <AdminBooleanSelectField label="手机必填" checked={draft.registerPhoneRequired} onChange={(value) => updateDraftField("registerPhoneRequired", value)} />
              <AdminBooleanSelectField label="手机需要验证" checked={draft.registerPhoneVerification} onChange={(value) => updateDraftField("registerPhoneVerification", value)} />
            </FieldGroup>
            <FieldGroup title="其它字段">
              <AdminBooleanSelectField label="显示昵称输入框" checked={draft.registerNicknameEnabled} onChange={(value) => updateDraftField("registerNicknameEnabled", value)} />
              <AdminBooleanSelectField label="昵称必填" checked={draft.registerNicknameRequired} onChange={(value) => updateDraftField("registerNicknameRequired", value)} />
              <TextField label="昵称最小字符数" value={draft.registerNicknameMinLength} onChange={(value) => updateDraftField("registerNicknameMinLength", value)} placeholder="如 1" />
              <TextField label="昵称最大字符数" value={draft.registerNicknameMaxLength} onChange={(value) => updateDraftField("registerNicknameMaxLength", value)} placeholder="如 20" />
              <AdminBooleanSelectField label="显示性别选项" checked={draft.registerGenderEnabled} onChange={(value) => updateDraftField("registerGenderEnabled", value)} />
              <AdminBooleanSelectField label="性别必填" checked={draft.registerGenderRequired} onChange={(value) => updateDraftField("registerGenderRequired", value)} />
              <AdminBooleanSelectField label="显示邀请人输入框" checked={draft.registerInviterEnabled} onChange={(value) => updateDraftField("registerInviterEnabled", value)} />
            </FieldGroup>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">昵称长度限制会同时应用到注册、用户自己修改资料，以及管理员后台修改用户昵称。</p>
        </div>
      ) : null}

      {activeSubTab === "email-templates" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold">邮件模板编辑</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">编辑注册验证码邮件与找回密码验证码邮件模板。支持变量：<code>{"{{siteName}}"}</code>、<code>{"{{code}}"}</code>、<code>{"{{username}}"}</code>。</p>
          </div>

          <EmailTemplateSection
            title="注册验证码邮件"
            description="用户在注册表单中获取邮箱验证码时发送。"
            subject={draft.registerVerificationEmailSubject}
            text={draft.registerVerificationEmailText}
            html={draft.registerVerificationEmailHtml}
            onSubjectChange={(value) => updateDraftField("registerVerificationEmailSubject", value)}
            onTextChange={(value) => updateDraftField("registerVerificationEmailText", value)}
            onHtmlChange={(value) => updateDraftField("registerVerificationEmailHtml", value)}
            previewVariables={registerVerificationPreviewVariables}
          />

          <EmailTemplateSection
            title="找回密码验证码邮件"
            description="用户在忘记密码流程中获取邮箱验证码时发送。"
            subject={draft.resetPasswordEmailSubject}
            text={draft.resetPasswordEmailText}
            html={draft.resetPasswordEmailHtml}
            onSubjectChange={(value) => updateDraftField("resetPasswordEmailSubject", value)}
            onTextChange={(value) => updateDraftField("resetPasswordEmailText", value)}
            onHtmlChange={(value) => updateDraftField("resetPasswordEmailHtml", value)}
            previewVariables={resetPasswordPreviewVariables}
          />
        </div>
      ) : null}

      {activeSubTab === "auth" ? (
        <>
          <div className="rounded-[24px] border border-border p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">第三方与 Passkey 登录</h3>
                <button
                  type="button"
                  onClick={() => setAuthDocOpen(true)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  aria-label="查看第三方与 Passkey 对接文档"
                  title="查看对接文档"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">这里同时控制登录开关与密钥配置。敏感值会写入站点设置的敏感 JSON，仅服务端读取，不向普通前台接口透出。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AdminBooleanSelectField label="开启 GitHub 登录" checked={draft.authGithubEnabled} onChange={(value) => updateDraftField("authGithubEnabled", value)} />
              <AdminBooleanSelectField label="开启 Google 登录" checked={draft.authGoogleEnabled} onChange={(value) => updateDraftField("authGoogleEnabled", value)} />
              <AdminBooleanSelectField label="开启 Passkey 登录" checked={draft.authPasskeyEnabled} onChange={(value) => updateDraftField("authPasskeyEnabled", value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextField label="GitHub Client ID" value={draft.githubClientId} onChange={(value) => updateDraftField("githubClientId", value)} placeholder="填写 GitHub OAuth App Client ID" />
              <TextField label="GitHub Client Secret" type="password" value={draft.githubClientSecret} onChange={(value) => updateDraftField("githubClientSecret", value)} placeholder="填写 GitHub OAuth App Client Secret" />
              <div className="hidden xl:block" />
              <TextField label="Google Client ID" value={draft.googleClientId} onChange={(value) => updateDraftField("googleClientId", value)} placeholder="填写 Google OAuth Client ID" />
              <TextField label="Google Client Secret" type="password" value={draft.googleClientSecret} onChange={(value) => updateDraftField("googleClientSecret", value)} placeholder="填写 Google OAuth Client Secret" />
              <div className="hidden xl:block" />
              <TextField label="Passkey RP ID" value={draft.passkeyRpId} onChange={(value) => updateDraftField("passkeyRpId", value)} placeholder="如 forum.example.com" />
              <TextField label="Passkey RP Name" value={draft.passkeyRpName} onChange={(value) => updateDraftField("passkeyRpName", value)} placeholder="如 兴趣论坛" />
              <TextField label="Passkey Origin" value={draft.passkeyOrigin} onChange={(value) => updateDraftField("passkeyOrigin", value)} placeholder="如 https://forum.example.com" />
            </div>
            <p className="text-xs leading-6 text-muted-foreground">开启对应登录方式前，请先在这里填写完整凭据；未填写时，运行时会直接报错，不再回退读取环境变量。</p>
          </div>

          <Modal
            open={authDocOpen}
            onClose={() => setAuthDocOpen(false)}
            title="第三方与 Passkey 对接文档"
            description="按当前站点域名生成对接信息。把回调地址填到第三方平台，把密钥与 Passkey 参数填回本页的后台表单即可。"
            size="xl"
          >
            <div className="space-y-5 overflow-y-auto p-6 text-sm text-foreground">
              <section className="space-y-3">
                <h4 className="text-sm font-semibold">GitHub OAuth</h4>
                <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-2">
                  <p><span className="font-medium">Homepage URL：</span><code>{siteOrigin}</code></p>
                  <p><span className="font-medium">Authorization callback URL：</span><code>{siteOrigin}/api/auth/oauth/github/callback</code></p>
                  <p><span className="font-medium">发起登录：</span><code>{siteOrigin}/api/auth/oauth/github/start?mode=login</code></p>
                  <p><span className="font-medium">发起注册：</span><code>{siteOrigin}/api/auth/oauth/github/start?mode=register</code></p>
                  <p><span className="font-medium">Scope：</span><code>read:user user:email</code></p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Google OAuth</h4>
                <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-2">
                  <p><span className="font-medium">Authorized JavaScript origins：</span><code>{siteOrigin}</code></p>
                  <p><span className="font-medium">Authorized redirect URIs：</span><code>{siteOrigin}/api/auth/oauth/google/callback</code></p>
                  <p><span className="font-medium">发起登录：</span><code>{siteOrigin}/api/auth/oauth/google/start?mode=login</code></p>
                  <p><span className="font-medium">发起注册：</span><code>{siteOrigin}/api/auth/oauth/google/start?mode=register</code></p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Passkey</h4>
                <div className="rounded-[20px] border border-border bg-secondary/30 p-4 space-y-2">
                  <p><span className="font-medium">Passkey 登录页：</span><code>{siteOrigin}/auth/passkey?mode=login</code></p>
                  <p><span className="font-medium">Passkey 注册页：</span><code>{siteOrigin}/auth/passkey?mode=register</code></p>
                  <p><span className="font-medium">建议 RP ID：</span><code>{resolvedPasskeyRpId}</code></p>
                  <p><span className="font-medium">建议 RP Name：</span><code>{resolvedPasskeyRpName}</code></p>
                  <p><span className="font-medium">建议 Origin：</span><code>{resolvedPasskeyOrigin}</code></p>
                  <p className="text-xs leading-6 text-muted-foreground">RP ID 一般填当前主域名，不带协议与路径。若你使用子域名部署，请确保 RP ID 与实际站点域名匹配。</p>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">后台填写项</h4>
                <div className="rounded-[20px] border border-border bg-background p-4">
                  <pre className="overflow-x-auto text-xs leading-6 text-foreground"><code>{`GitHub Client ID = ${draft.githubClientId || "第三方平台生成后填写"}
GitHub Client Secret = ${draft.githubClientSecret ? "已填写" : "第三方平台生成后填写"}

Google Client ID = ${draft.googleClientId || "第三方平台生成后填写"}
Google Client Secret = ${draft.googleClientSecret ? "已填写" : "第三方平台生成后填写"}

Passkey RP ID = ${resolvedPasskeyRpId}
Passkey RP Name = ${resolvedPasskeyRpName}
Passkey Origin = ${resolvedPasskeyOrigin}`}</code></pre>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">以上内容保存在数据库敏感配置中。第三方登录流程本身仍需服务端可用的签名密钥，例如现有的 `AUTH_FLOW_SECRET`。</p>
              </section>
            </div>
          </Modal>
        </>
      ) : null}

      {activeSubTab === "smtp" ? (
        <div className="rounded-[24px] border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">SMTP 邮件发送</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">开启后，邮箱验证码会通过真实邮件发送。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AdminBooleanSelectField label="启用 SMTP" checked={draft.smtpEnabled} onChange={(value) => updateDraftField("smtpEnabled", value)} />
            <AdminBooleanSelectField label="启用 SSL/TLS" checked={draft.smtpSecure} onChange={(value) => updateDraftField("smtpSecure", value)} />
            <TextField label="SMTP 主机" value={draft.smtpHost} onChange={(value) => updateDraftField("smtpHost", value)} placeholder="如 smtp.qq.com" />
            <TextField label="SMTP 端口" value={draft.smtpPort} onChange={(value) => updateDraftField("smtpPort", value)} placeholder="如 465 / 587" />
            <TextField label="SMTP 账号" value={draft.smtpUser} onChange={(value) => updateDraftField("smtpUser", value)} placeholder="邮箱账号" />
            <TextField label="SMTP 密码 / 授权码" type="password" value={draft.smtpPass} onChange={(value) => updateDraftField("smtpPass", value)} placeholder="请输入密码或授权码" />
            <TextField label="发件人地址" value={draft.smtpFrom} onChange={(value) => updateDraftField("smtpFrom", value)} placeholder="如 Forum <no-reply@example.com>" />
          </div>
          <div className="rounded-[20px] border border-border bg-secondary/20 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <TextField label="测试收件邮箱" value={smtpTestRecipient} onChange={setSmtpTestRecipient} placeholder="输入你要接收测试邮件的邮箱" />
              <Button type="button" variant="outline" disabled={isSendingSmtpTest} onClick={handleSendSmtpTest}>
                {isSendingSmtpTest ? "发送中..." : "发送测试邮件"}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">直接使用当前表单里的 SMTP 配置发送测试邮件，不需要先保存设置。</p>
          </div>
        </div>
      ) : null}
    </>
  )
}
