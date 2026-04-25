# User Notification Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add extensible user notification channel settings, including email delivery toggle and private message delivery to webhook/email.

**Architecture:** Keep persistence inside the existing `user.signature` profile envelope, but normalize notification preferences into a dedicated channel/event structure. Route system notifications and private message events through one delivery service that resolves subscribed channels and dispatches background jobs for webhook/email delivery.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, background jobs, nodemailer, existing profile settings envelope.

---

## File Map

- Create: `docs/superpowers/plans/2026-04-25-user-notification-delivery.md`
- Create: `src/lib/user-notification-preferences.ts`
- Create: `src/lib/user-notification-delivery.ts`
- Modify: `src/lib/user-profile-settings.ts`
- Modify: `src/lib/validators.ts`
- Modify: `src/lib/users.ts`
- Modify: `src/db/notification-write-queries.ts`
- Modify: `src/lib/background-jobs.ts`
- Modify: `src/lib/mailer.ts`
- Modify: `src/lib/notification-writes.ts`
- Modify: `src/lib/message-send-execution.ts`
- Modify: `src/app/api/profile/notification-settings/route.ts`
- Modify: `src/app/api/profile/notification-settings/test/route.ts`
- Modify: `src/app/settings/sections/profile-settings-section.tsx`
- Modify: `src/components/profile/profile-notification-settings.tsx`
- Test: `test/user-notification-preferences.test.ts`
- Test: `test/notification-settings-validator.test.ts`

### Task 1: Normalize Notification Preferences

**Files:**
- Create: `src/lib/user-notification-preferences.ts`
- Modify: `src/lib/user-profile-settings.ts`
- Test: `test/user-notification-preferences.test.ts`

- [ ] **Step 1: Add dedicated channel/event preference types**

Create `src/lib/user-notification-preferences.ts` with:

```ts
export const USER_NOTIFICATION_CHANNELS = ["webhook", "email"] as const
export const USER_NOTIFICATION_EVENTS = ["systemNotification", "privateMessage"] as const

export type UserNotificationChannel = typeof USER_NOTIFICATION_CHANNELS[number]
export type UserNotificationEvent = typeof USER_NOTIFICATION_EVENTS[number]
```

- [ ] **Step 2: Add defaults and normalization helpers**

Implement helpers that produce:

```ts
{
  webhook: {
    enabled: false,
    url: "",
    events: {
      systemNotification: false,
      privateMessage: false,
    },
  },
  email: {
    enabled: false,
    events: {
      systemNotification: false,
      privateMessage: false,
    },
  },
}
```

- [ ] **Step 3: Update profile envelope resolution**

In `src/lib/user-profile-settings.ts`, replace notification storage with:

```ts
notificationPreferences: resolveUserNotificationPreferences(rawSettings)
```

- [ ] **Step 4: Update profile envelope merge logic**

Allow `mergeUserProfileSettings()` to merge:

```ts
notificationPreferences?: UserNotificationPreferencesInput
```

- [ ] **Step 5: Add migration-focused tests**

Add tests covering:

```ts
resolveUserProfileSettings(normalizedEnvelope).notificationPreferences.webhook.events.systemNotification === true
resolveUserProfileSettings(normalizedEnvelope).notificationPreferences.webhook.events.privateMessage === false
mergeUserProfileSettings(null, { notificationPreferences: ... })
```

Run: `pnpm test -- --test-name-pattern user-notification-preferences`

### Task 2: Validate and Expose Settings API

**Files:**
- Modify: `src/lib/validators.ts`
- Modify: `src/lib/users.ts`
- Modify: `src/app/api/profile/notification-settings/route.ts`
- Modify: `src/app/api/profile/notification-settings/test/route.ts`
- Test: `test/notification-settings-validator.test.ts`

- [ ] **Step 1: Replace flat notification payload validation**

Validate a nested payload:

```ts
{
  notificationPreferences: {
    webhook: { enabled, url, events },
    email: { enabled, events },
  }
}
```

Enforce `http/https` URL rules and require a webhook URL when webhook testing is requested.

- [ ] **Step 2: Update account settings surface**

In `src/lib/users.ts`, return:

```ts
notificationPreferences: profileSettings.notificationPreferences
```

- [ ] **Step 3: Update save/test routes**

Write the normalized structure into `user.signature`, pass the new structure into addon hooks, and keep the webhook test route focused on the webhook channel only.

- [ ] **Step 4: Add validator tests**

Cover:

```ts
validateNotificationSettingsPayload(validNestedPayload).success === true
validateNotificationSettingsPayload(webhookEnabledWithoutUrl).success === false
```

Run: `pnpm test -- --test-name-pattern notification-settings-validator`

### Task 3: Build Extensible Delivery Service

**Files:**
- Create: `src/lib/user-notification-delivery.ts`
- Modify: `src/db/notification-write-queries.ts`
- Modify: `src/lib/background-jobs.ts`
- Modify: `src/lib/mailer.ts`

- [ ] **Step 1: Add recipient contact query**

Return the data required for delivery routing:

```ts
{
  signature: true,
  email: true,
  emailVerifiedAt: true,
  username: true,
  nickname: true,
}
```

- [ ] **Step 2: Add generic dispatch event types**

Model event unions for:

```ts
type UserNotificationDeliveryEvent =
  | { type: "systemNotification"; ... }
  | { type: "privateMessage"; ... }
```

and route them to channel payload builders.

- [ ] **Step 3: Add background job payloads**

Extend `BackgroundJobPayloadMap` with generic dispatch jobs for webhook/email delivery, including retry attempt metadata.

- [ ] **Step 4: Add delivery helpers**

In `src/lib/user-notification-delivery.ts`, implement:

```ts
enqueueUserNotificationDeliveries(event)
sendUserNotificationWebhookTest(...)
```

and dispatch only when the recipient subscribed to the corresponding event/channel.

- [ ] **Step 5: Add generic outbound email sender**

Extend `src/lib/mailer.ts` with a generic mail function for user notifications so event-specific builders can reuse the existing SMTP context without duplicating transporter setup.

### Task 4: Wire System Notifications and Private Messages

**Files:**
- Modify: `src/lib/notification-writes.ts`
- Modify: `src/lib/message-send-execution.ts`

- [ ] **Step 1: Replace system-notification-only webhook enqueue**

After `createSystemNotification()`, enqueue the new delivery event instead of the current webhook-only job.

- [ ] **Step 2: Hook private message delivery**

After `executeDirectMessageSend()` succeeds, enqueue a delivery event for the recipient using the sanitized stored message body and sender metadata.

- [ ] **Step 3: Preserve existing in-app behavior**

Do not change unread counts, stream events, or direct message creation. The new delivery path must be additive and asynchronous only.

- [ ] **Step 4: Add guardrails**

Make delivery best-effort:

```ts
void enqueueUserNotificationDeliveries(...).catch(...)
```

so message sending and notification writes never fail because of outbound channels.

### Task 5: Update Notification Settings UI

**Files:**
- Modify: `src/app/settings/sections/profile-settings-section.tsx`
- Modify: `src/components/profile/profile-notification-settings.tsx`

- [ ] **Step 1: Pass normalized initial settings into the page**

Prop-drill:

```ts
initialNotificationPreferences={dbUser?.notificationPreferences ?? default...}
initialEmail={dbUser?.email ?? null}
initialEmailVerified={Boolean(dbUser?.emailVerifiedAt)}
emailDeliveryEnabled={settings.smtpEnabled}
```

- [ ] **Step 2: Render channel cards + event toggles**

Show:

- webhook channel switch
- webhook URL input
- email channel switch
- event toggles for `systemNotification` and `privateMessage`

- [ ] **Step 3: Keep webhook test action**

The test button should read the current webhook URL from the normalized draft without persisting the form first.

- [ ] **Step 4: Explain delivery prerequisites**

Render concise copy for:

- SMTP disabled
- account email missing
- account email not verified

### Task 6: Verify

**Files:**
- Test: `test/user-notification-preferences.test.ts`
- Test: `test/notification-settings-validator.test.ts`

- [ ] **Step 1: Run focused tests**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 2: Run static verification**

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.
