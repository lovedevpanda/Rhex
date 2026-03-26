import nodemailer from "nodemailer"

import { getSiteSettings } from "@/lib/site-settings"

export async function canSendEmail() {
  const settings = await getSiteSettings()
  return Boolean(settings.smtpEnabled && settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass && settings.smtpFrom)
}

async function createMailerContext() {
  const settings = await getSiteSettings()

  if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass || !settings.smtpFrom) {
    throw new Error("当前未配置 SMTP 邮件发送，请先到后台基础设置中完成 SMTP 配置")
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
  })

  return {
    settings: {
      ...settings,
      smtpFrom: settings.smtpFrom,
    } as typeof settings & { smtpFrom: string },
    transporter,
  }
}


export async function sendRegisterVerificationEmail(input: { to: string; code: string }) {
  const { settings, transporter } = await createMailerContext()

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: `${settings.siteName} 验证码`,
    text: `你的验证码是 ${input.code}，10 分钟内有效。如非本人操作请忽略。`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>${settings.siteName} 验证码</h2><p>你的验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.code}</p><p>验证码 10 分钟内有效，如非本人操作请忽略。</p></div>`,
  })
}

export async function sendResetPasswordVerificationEmail(input: { to: string; code: string; username: string }) {
  const { settings, transporter } = await createMailerContext()

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: `${settings.siteName} 找回密码验证码`,
    text: `用户 ${input.username} 的找回密码验证码是 ${input.code}，10 分钟内有效。如非本人操作，请尽快检查账号安全。`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>${settings.siteName} 找回密码</h2><p>账号：<strong>${input.username}</strong></p><p>你的找回密码验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.code}</p><p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件并尽快检查账号安全。</p></div>`,
  })
}

