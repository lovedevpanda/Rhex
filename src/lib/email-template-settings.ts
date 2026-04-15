export interface EditableEmailTemplate {
  subject: string
  text: string
  html: string
}

export interface RegistrationEmailTemplateSettings {
  registerVerification: EditableEmailTemplate
  resetPasswordVerification: EditableEmailTemplate
  passwordChangeVerification: EditableEmailTemplate
  loginIpChangeAlert: EditableEmailTemplate
  paymentOrderSuccessNotification: EditableEmailTemplate
}

function buildRegisterVerificationTemplate(siteName: string): EditableEmailTemplate {
  void siteName

  return {
    subject: "{{siteName}} 验证码",
    text: "你的验证码是 {{code}}，10 分钟内有效。如非本人操作请忽略。",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>{{siteName}} 验证码</h2><p>你的验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{code}}</p><p>验证码 10 分钟内有效，如非本人操作请忽略。</p></div>`,
  }
}

function buildResetPasswordTemplate(siteName: string): EditableEmailTemplate {
  void siteName

  return {
    subject: "{{siteName}} 找回密码验证码",
    text: "用户 {{username}} 的找回密码验证码是 {{code}}，10 分钟内有效。如非本人操作，请尽快检查账号安全。",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>{{siteName}} 找回密码</h2><p>账号：<strong>{{username}}</strong></p><p>你的找回密码验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{code}}</p><p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件并尽快检查账号安全。</p></div>`,
  }
}

function buildPasswordChangeVerificationTemplate(siteName: string): EditableEmailTemplate {
  void siteName

  return {
    subject: "{{siteName}} 修改密码验证码",
    text: "用户 {{username}} 的修改密码验证码是 {{code}}，10 分钟内有效。如非本人操作，请尽快检查账号安全。",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>{{siteName}} 修改密码</h2><p>账号：<strong>{{username}}</strong></p><p>你的修改密码验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{code}}</p><p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件并尽快检查账号安全。</p></div>`,
  }
}

function buildLoginIpChangeAlertTemplate(siteName: string): EditableEmailTemplate {
  void siteName

  return {
    subject: "{{siteName}} 登录安全提醒",
    text: [
      "{{displayName}}，你好。",
      "",
      "你的账号刚刚发生了一次新的登录，检测到登录 IP 与上次记录不一致。",
      "账号：{{username}}",
      "本次登录 IP：{{currentIp}}",
      "上次登录 IP：{{previousIp}}",
      "登录时间：{{loginAt}}",
      "设备信息：{{userAgent}}",
      "",
      "如果这是你本人操作，无需处理；如非本人操作，请尽快修改密码并检查账号安全。",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>{{siteName}} 登录安全提醒</h2><p>{{displayName}}，你好。</p><p>你的账号刚刚发生了一次新的登录，检测到登录 IP 与上次记录不一致。</p><table style="border-collapse:collapse;margin:16px 0"><tbody><tr><td style="padding:6px 12px 6px 0;color:#666">账号</td><td style="padding:6px 0">{{username}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">本次登录 IP</td><td style="padding:6px 0">{{currentIp}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">上次登录 IP</td><td style="padding:6px 0">{{previousIp}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">登录时间</td><td style="padding:6px 0">{{loginAt}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">设备信息</td><td style="padding:6px 0">{{userAgent}}</td></tr></tbody></table><p>如果这是你本人操作，无需处理；如非本人操作，请尽快修改密码并检查账号安全。</p></div>`,
  }
}

function buildPaymentOrderSuccessNotificationTemplate(siteName: string): EditableEmailTemplate {
  void siteName

  return {
    subject: "{{siteName}} 支付成功通知 · {{orderSubject}}",
    text: [
      "订单标题：{{orderSubject}}",
      "商户单号：{{merchantOrderNo}}",
      "业务场景：{{bizScene}}",
      "支付金额：{{amount}}",
      "支付方式：{{providerCode}} / {{channelCode}}",
      "支付时间：{{paidAt}}",
      "付款用户：{{username}}",
      "{{pointName}}到账：{{totalPoints}}",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>{{siteName}} 支付成功通知</h2><p>订单标题：<strong>{{orderSubject}}</strong></p><table style="border-collapse:collapse;margin:16px 0"><tbody><tr><td style="padding:6px 12px 6px 0;color:#666">商户单号</td><td style="padding:6px 0">{{merchantOrderNo}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">业务场景</td><td style="padding:6px 0">{{bizScene}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">支付金额</td><td style="padding:6px 0">{{amount}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">支付方式</td><td style="padding:6px 0">{{providerCode}} / {{channelCode}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">支付时间</td><td style="padding:6px 0">{{paidAt}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">付款用户</td><td style="padding:6px 0">{{username}}</td></tr><tr><td style="padding:6px 12px 6px 0;color:#666">{{pointName}}到账</td><td style="padding:6px 0">{{totalPoints}}</td></tr></tbody></table><p>如需追溯，请前往后台日志中心查看支付流水。</p></div>`,
  }
}

export function buildDefaultRegistrationEmailTemplateSettings(siteName: string) {
  return {
    registerVerification: buildRegisterVerificationTemplate(siteName),
    resetPasswordVerification: buildResetPasswordTemplate(siteName),
    passwordChangeVerification: buildPasswordChangeVerificationTemplate(siteName),
    loginIpChangeAlert: buildLoginIpChangeAlertTemplate(siteName),
    paymentOrderSuccessNotification: buildPaymentOrderSuccessNotificationTemplate(siteName),
  } satisfies RegistrationEmailTemplateSettings
}

function sanitizeTemplateField(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : fallback
}

export function normalizeRegistrationEmailTemplateSettings(
  input: unknown,
  defaults: RegistrationEmailTemplateSettings,
): RegistrationEmailTemplateSettings {
  const root = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const registerVerification = root.registerVerification && typeof root.registerVerification === "object" && !Array.isArray(root.registerVerification)
    ? root.registerVerification as Record<string, unknown>
    : {}
  const resetPasswordVerification = root.resetPasswordVerification && typeof root.resetPasswordVerification === "object" && !Array.isArray(root.resetPasswordVerification)
    ? root.resetPasswordVerification as Record<string, unknown>
    : {}
  const passwordChangeVerification = root.passwordChangeVerification && typeof root.passwordChangeVerification === "object" && !Array.isArray(root.passwordChangeVerification)
    ? root.passwordChangeVerification as Record<string, unknown>
    : {}
  const loginIpChangeAlert = root.loginIpChangeAlert && typeof root.loginIpChangeAlert === "object" && !Array.isArray(root.loginIpChangeAlert)
    ? root.loginIpChangeAlert as Record<string, unknown>
    : {}
  const paymentOrderSuccessNotification = root.paymentOrderSuccessNotification && typeof root.paymentOrderSuccessNotification === "object" && !Array.isArray(root.paymentOrderSuccessNotification)
    ? root.paymentOrderSuccessNotification as Record<string, unknown>
    : {}

  return {
    registerVerification: {
      subject: sanitizeTemplateField(registerVerification.subject, defaults.registerVerification.subject, 200),
      text: sanitizeTemplateField(registerVerification.text, defaults.registerVerification.text, 10000),
      html: sanitizeTemplateField(registerVerification.html, defaults.registerVerification.html, 20000),
    },
    resetPasswordVerification: {
      subject: sanitizeTemplateField(resetPasswordVerification.subject, defaults.resetPasswordVerification.subject, 200),
      text: sanitizeTemplateField(resetPasswordVerification.text, defaults.resetPasswordVerification.text, 10000),
      html: sanitizeTemplateField(resetPasswordVerification.html, defaults.resetPasswordVerification.html, 20000),
    },
    passwordChangeVerification: {
      subject: sanitizeTemplateField(passwordChangeVerification.subject, defaults.passwordChangeVerification.subject, 200),
      text: sanitizeTemplateField(passwordChangeVerification.text, defaults.passwordChangeVerification.text, 10000),
      html: sanitizeTemplateField(passwordChangeVerification.html, defaults.passwordChangeVerification.html, 20000),
    },
    loginIpChangeAlert: {
      subject: sanitizeTemplateField(loginIpChangeAlert.subject, defaults.loginIpChangeAlert.subject, 200),
      text: sanitizeTemplateField(loginIpChangeAlert.text, defaults.loginIpChangeAlert.text, 10000),
      html: sanitizeTemplateField(loginIpChangeAlert.html, defaults.loginIpChangeAlert.html, 20000),
    },
    paymentOrderSuccessNotification: {
      subject: sanitizeTemplateField(paymentOrderSuccessNotification.subject, defaults.paymentOrderSuccessNotification.subject, 200),
      text: sanitizeTemplateField(paymentOrderSuccessNotification.text, defaults.paymentOrderSuccessNotification.text, 10000),
      html: sanitizeTemplateField(paymentOrderSuccessNotification.html, defaults.paymentOrderSuccessNotification.html, 20000),
    },
  }
}

export function renderEmailTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "")
}
