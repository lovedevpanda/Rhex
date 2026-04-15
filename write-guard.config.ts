import type { WriteGuardPolicyConfigMap } from "./src/lib/write-guard-policy-types"

/**
 * Redis write-guard 策略总配置。
 *
 * 使用方式：
 * 1. 在这里新增或调整策略，不需要再改 `src/lib/write-guard-policies.ts`
 * 2. 路由里调用 `createRequestWriteGuardOptions("<策略名>", { ... })`
 * 3. `dedupe.parts` 支持两类字段：
 *    - `userId`：来自当前登录用户上下文
 *    - 其他路径：来自路由传入的 `input`，支持点路径，例如 `body.action`
 *
 * 字段说明：
 * - `description`: 给人看的说明，不参与运行时逻辑
 * - `scope`: Redis key 作用域，建议稳定不变
 * - `cooldownMs`: 频率限制窗口，命中后返回 429
 * - `cooldownMessage`: 命中频率限制时给前端的提示
 * - `releaseOnError`: 业务执行失败时是否释放本次 guard
 * - `dedupe.windowMs`: 幂等窗口，命中后返回 409
 * - `dedupe.parts`: 组成幂等 key 的字段列表
 * - `dedupe.separator`: 拼接字段时的分隔符，默认 `:`
 */
const writeGuardConfig = {
  "attachments-upload": {
    description: "帖子附件上传按文件哈希去重，避免重复写盘和重复入库。",
    scope: "upload-post-attachment",
    cooldownMs: 0,
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "fileHash"],
    },
  },
  "auth-forgot-password-send-code": {
    description: "找回密码验证码发送，按邮箱做短时间去重和中等频率限制。",
    scope: "auth-forgot-password-send-code",
    cooldownMs: 15_000,
    cooldownMessage: "验证码已发送，如未收到请 15 秒后重试",
    releaseOnError: true,
    dedupe: {
      windowMs: 3_000,
      parts: ["email"],
    },
  },
  "auth-login": {
    description: "登录尝试限流，防止密码爆破和短时间重复提交。",
    scope: "auth-login",
    cooldownMs: 2_000,
    cooldownMessage: "登录尝试过于频繁，请稍后再试",
  },
  "auth-register": {
    description: "注册提交流控，按关键注册字段组合去重，防止连点重复开户。",
    scope: "auth-register",
    cooldownMs: 2_000,
    cooldownMessage: "注册提交过于频繁，请稍后再试",
    dedupe: {
      windowMs: 10_000,
      parts: [
        "username",
        "nickname",
        "inviterUsername",
        "inviteCode",
        "email",
        "emailCode",
        "phone",
        "phoneCode",
        "gender",
        "captchaToken",
        "builtinCaptchaCode",
        "powNonce",
      ],
      separator: "|",
    },
  },
  "auth-send-verification-code": {
    description: "注册验证码发送，按渠道和目标地址做去重。",
    scope: "auth-send-verification-code",
    cooldownMs: 15_000,
    cooldownMessage: "验证码已发送，如未收到请 15 秒后重试",
    releaseOnError: true,
    dedupe: {
      windowMs: 3_000,
      parts: ["channel", "target"],
    },
  },
  "profile-password-send-code": {
    description: "个人中心修改密码邮箱验证码发送，按用户做短时间去重和频率限制。",
    scope: "profile-password-send-code",
    cooldownMs: 15_000,
    cooldownMessage: "验证码已发送，如未收到请 15 秒后重试",
    releaseOnError: true,
    dedupe: {
      windowMs: 3_000,
      parts: ["userId"],
    },
  },
  "boards-follow-toggle": {
    description: "节点关注切换去抖，避免连点导致重复切换。",
    scope: "boards-follow-toggle",
    cooldownMs: 1_500,
    dedupe: {
      parts: ["userId", "boardId"],
    },
  },
  "check-in-submit": {
    description: "签到/补签操作限流，按动作和日期做幂等保护。",
    scope: "check-in",
    cooldownMs: 1_000,
    cooldownMessage: "签到操作过于频繁，请稍后再试",
    dedupe: {
      windowMs: 5_000,
      parts: ["userId", "action", "date"],
    },
  },
  "comments-like": {
    description: "评论点赞切换限流，减少高频抖动写入。",
    scope: "comments-like",
    cooldownMs: 500,
    cooldownMessage: "点赞操作过于频繁，请稍后再试",
    dedupe: {
      windowMs: 1_000,
      parts: ["userId", "commentId"],
    },
  },
  "invite-codes-purchase": {
    description: "邀请码购买防重，避免连点重复扣积分。",
    scope: "invite-codes-purchase",
    cooldownMs: 1_500,
    cooldownMessage: "购买操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId"],
    },
  },
  "messages-delete": {
    description: "私信会话删除去重，避免短时间重复删除同一会话。",
    scope: "messages-delete",
    cooldownMs: 1_000,
    dedupe: {
      parts: ["userId", "conversationId"],
    },
  },
  "messages-read": {
    description: "私信已读更新去抖，减少重复写。",
    scope: "messages-read",
    cooldownMs: 500,
    dedupe: {
      windowMs: 1_000,
      parts: ["userId", "conversationId"],
    },
  },
  "messages-send": {
    description: "私信发送限流，按接收人和内容去重，防止连点重复发送。",
    scope: "messages-send",
    cooldownMs: 1_000,
    dedupe: {
      parts: ["userId", "recipientId", "body"],
    },
  },
  "payments-checkout": {
    description: "统一支付下单防重，避免连点导致重复创建第三方支付单。",
    scope: "payments-checkout",
    cooldownMs: 1_500,
    cooldownMessage: "下单操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "scene", "bizOrderId", "amountFen", "clientType"],
    },
  },
  "posts-like": {
    description: "帖子点赞切换限流，减少高频抖动写入。",
    scope: "posts-like",
    cooldownMs: 500,
    cooldownMessage: "点赞操作过于频繁，请稍后再试",
    dedupe: {
      windowMs: 1_000,
      parts: ["userId", "postId"],
    },
  },
  "post-attachments-purchase": {
    description: "附件购买防重，避免重复提交导致重复结算。",
    scope: "post-attachments-purchase",
    cooldownMs: 1_500,
    cooldownMessage: "购买操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "attachmentId"],
    },
  },
  "posts-purchase": {
    description: "帖子隐藏内容购买防重，避免重复提交导致重复结算。",
    scope: "posts-purchase",
    cooldownMs: 1_500,
    cooldownMessage: "购买操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "postId", "blockId"],
    },
  },
  "posts-tip": {
    description: "帖子打赏防重，防止连点造成重复扣积分。",
    scope: "posts-tip",
    cooldownMs: 1_500,
    cooldownMessage: "打赏操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "postId", "amount", "giftId"],
    },
  },
  "posts-auction-bid": {
    description: "拍卖出价防重，避免连点导致重复冻结或重复加价。",
    scope: "posts-auction-bid",
    cooldownMs: 1_500,
    cooldownMessage: "出价操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "postId", "amount"],
    },
  },
  "redeem-codes-redeem": {
    description: "兑换码提交防重，避免重复消费同一兑换码。",
    scope: "redeem-codes-redeem",
    cooldownMs: 1_500,
    cooldownMessage: "兑换操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "code"],
    },
  },
  "reports-create": {
    description: "举报提交限流，按举报目标和原因短时去重。",
    scope: "reports-create",
    cooldownMs: 3_000,
    cooldownMessage: "举报提交过于频繁，请稍后再试",
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "targetType", "targetId", "reasonType", "reasonDetail"],
    },
  },
  "profile-notification-webhook-test": {
    description: "Webhook 测试发送限流，避免短时间连续请求外部地址。",
    scope: "profile-notification-webhook-test",
    cooldownMs: 5_000,
    cooldownMessage: "测试请求过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 15_000,
      parts: ["userId", "notificationWebhookUrl"],
    },
  },
  "upload-file": {
    description: "图片上传按内容哈希去重，避免重复写盘和重复入库。",
    scope: "upload-file",
    cooldownMs: 0,
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "folder", "fileHash"],
    },
  },
  "vip-action": {
    description: "VIP 购买 / 续费防重，避免连点重复扣积分。",
    scope: "vip-action",
    cooldownMs: 1_500,
    cooldownMessage: "VIP 操作过于频繁，请稍后再试",
    releaseOnError: true,
    dedupe: {
      windowMs: 10_000,
      parts: ["userId", "action"],
    },
  },
} satisfies WriteGuardPolicyConfigMap

export default writeGuardConfig
