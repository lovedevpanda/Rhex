import nodemailer from "nodemailer"

import { renderEmailTemplate } from "@/lib/email-template-settings"
import { getServerSiteSettings } from "@/lib/site-settings"

export interface MailerTransportConfig {
  siteName?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure?: boolean
}

interface ResolvedMailerTransportConfig {
  siteName?: string | null
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpSecure?: boolean
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export async function canSendEmail() {
  const settings = await getServerSiteSettings()
  return Boolean(settings.smtpEnabled && settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass && settings.smtpFrom)
}

function assertMailerConfig(config: MailerTransportConfig): asserts config is ResolvedMailerTransportConfig {
  if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPass || !config.smtpFrom) {
    throw new Error("请完整填写 SMTP 主机、端口、账号、密码和发件人地址")
  }
}

async function createMailerContext(config?: MailerTransportConfig) {
  const siteSettings = await getServerSiteSettings()
  const settings = config ?? siteSettings

  if (!config && !siteSettings.smtpEnabled) {
    throw new Error("当前未配置 SMTP 邮件发送，请先到后台基础设置中完成 SMTP 配置")
  }
  assertMailerConfig(settings)
  const { smtpFrom, smtpHost, smtpPass, smtpPort, smtpSecure, smtpUser } = settings

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure ?? false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  return {
    settings: {
      ...siteSettings,
      ...settings,
      smtpFrom,
      siteName: settings.siteName || siteSettings.siteName,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpSecure: smtpSecure ?? false,
    } as typeof siteSettings & { siteName: string; smtpFrom: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; smtpSecure: boolean },
    transporter,
  }
}


export async function sendRegisterVerificationEmail(input: { to: string; code: string }) {
  const { settings, transporter } = await createMailerContext()
  const variables = {
    siteName: settings.siteName,
    code: input.code,
    username: "",
  }

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: renderEmailTemplate(settings.registrationEmailTemplates.registerVerification.subject, variables),
    text: renderEmailTemplate(settings.registrationEmailTemplates.registerVerification.text, variables),
    html: renderEmailTemplate(settings.registrationEmailTemplates.registerVerification.html, variables),
  })
}

export async function sendResetPasswordVerificationEmail(input: { to: string; code: string; username: string }) {
  const { settings, transporter } = await createMailerContext()
  const variables = {
    siteName: settings.siteName,
    code: input.code,
    username: input.username,
  }

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: renderEmailTemplate(settings.registrationEmailTemplates.resetPasswordVerification.subject, variables),
    text: renderEmailTemplate(settings.registrationEmailTemplates.resetPasswordVerification.text, variables),
    html: renderEmailTemplate(settings.registrationEmailTemplates.resetPasswordVerification.html, variables),
  })
}

export async function sendPasswordChangeVerificationEmail(input: { to: string; code: string; username: string }) {
  const { settings, transporter } = await createMailerContext()
  const variables = {
    siteName: settings.siteName,
    code: input.code,
    username: input.username,
  }

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: renderEmailTemplate(settings.registrationEmailTemplates.passwordChangeVerification.subject, variables),
    text: renderEmailTemplate(settings.registrationEmailTemplates.passwordChangeVerification.text, variables),
    html: renderEmailTemplate(settings.registrationEmailTemplates.passwordChangeVerification.html, variables),
  })
}

export async function sendLoginIpChangeAlertEmail(input: {
  to: string
  username: string
  displayName?: string | null
  previousIp: string
  currentIp: string
  loginAt: string
  userAgent?: string | null
}) {
  const { settings, transporter } = await createMailerContext()
  const accountName = input.displayName?.trim() || input.username
  const userAgent = input.userAgent?.trim() || "未知设备"
  const safeAccountName = escapeHtml(accountName)
  const safeUsername = escapeHtml(input.username)
  const safeCurrentIp = escapeHtml(input.currentIp)
  const safePreviousIp = escapeHtml(input.previousIp)
  const safeLoginAt = escapeHtml(input.loginAt)
  const safeUserAgent = escapeHtml(userAgent)
  const textVariables = {
    siteName: settings.siteName,
    displayName: accountName,
    username: input.username,
    currentIp: input.currentIp,
    previousIp: input.previousIp,
    loginAt: input.loginAt,
    userAgent,
  }
  const htmlVariables = {
    siteName: escapeHtml(settings.siteName),
    displayName: safeAccountName,
    username: safeUsername,
    currentIp: safeCurrentIp,
    previousIp: safePreviousIp,
    loginAt: safeLoginAt,
    userAgent: safeUserAgent,
  }

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: renderEmailTemplate(settings.registrationEmailTemplates.loginIpChangeAlert.subject, textVariables),
    text: renderEmailTemplate(settings.registrationEmailTemplates.loginIpChangeAlert.text, textVariables),
    html: renderEmailTemplate(settings.registrationEmailTemplates.loginIpChangeAlert.html, htmlVariables),
  })
}

export async function sendPaymentGatewayOrderSuccessEmail(input: {
  to: string
  merchantOrderNo: string
  bizScene: string
  orderSubject: string
  amountFen: number
  currency: string
  providerCode: string
  channelCode: string
  paidAt: string
  username: string
  pointName?: string | null
  points?: number | null
  bonusPoints?: number | null
  totalPoints?: number | null
}) {
  const { settings, transporter } = await createMailerContext()
  const variables = {
    siteName: settings.siteName,
    merchantOrderNo: input.merchantOrderNo,
    bizScene: input.bizScene,
    orderSubject: input.orderSubject,
    amount: `${input.currency} ${(input.amountFen / 100).toFixed(2)}`,
    currency: input.currency,
    providerCode: input.providerCode,
    channelCode: input.channelCode,
    paidAt: input.paidAt,
    username: input.username,
    pointName: input.pointName ?? "",
    points: typeof input.points === "number" ? String(input.points) : "",
    bonusPoints: typeof input.bonusPoints === "number" ? String(input.bonusPoints) : "",
    totalPoints: typeof input.totalPoints === "number" ? String(input.totalPoints) : "",
  }

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: renderEmailTemplate(settings.registrationEmailTemplates.paymentOrderSuccessNotification.subject, variables),
    text: renderEmailTemplate(settings.registrationEmailTemplates.paymentOrderSuccessNotification.text, variables),
    html: renderEmailTemplate(settings.registrationEmailTemplates.paymentOrderSuccessNotification.html, variables),
  })
}

export async function sendUserNotificationEmail(input: {
  to: string
  subject: string
  text: string
  html: string
}) {
  const { settings, transporter } = await createMailerContext()

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}

export async function sendSmtpTestEmail(input: {
  to: string
  siteName?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure?: boolean
}) {
  const { settings, transporter } = await createMailerContext({
    siteName: input.siteName,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUser: input.smtpUser,
    smtpPass: input.smtpPass,
    smtpFrom: input.smtpFrom,
    smtpSecure: input.smtpSecure,
  })

  await transporter.verify()
  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: `${settings.siteName} SMTP 测试邮件`,
    text: `这是一封来自 ${settings.siteName} 的 SMTP 测试邮件。若你收到此邮件，说明当前 SMTP 配置可正常连接并发送。`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>${settings.siteName} SMTP 测试</h2><p>这是一封后台手动触发的测试邮件。</p><p>如果你收到这封邮件，说明当前 SMTP 主机、端口、账号、密码和发件人配置已经可以正常发送。</p></div>`,
  })
}
