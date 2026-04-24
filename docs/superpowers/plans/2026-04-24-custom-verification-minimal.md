# Custom Verification Minimal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有认证体系上增加“自定义图标 + 自定义介绍”的最小能力，用户提交后仍走管理员审核，审核通过后再更新前台展示。

**Architecture:** 复用现有 `UserVerification` 申请记录与审核链路，不新增独立模块。新增一个申请级字段保存自定义图标，并放开“已通过同一认证”的二次提审场景，让旧的已通过记录在新申请通过前继续生效。

**Tech Stack:** Next.js 16 App Router、React 19、Prisma、TypeScript、现有认证中心/后台审核页面

---

## File Structure

- Modify: `prisma/schema.prisma`
  责任：为 `UserVerification` 增加 `customIconText` 字段，持久化用户提交的定制图标。
- Modify: `src/db/verification-queries.ts`
  责任：创建申请时写入 `customIconText`，更新申请时允许同步该字段。
- Modify: `src/db/admin-verification-queries.ts`
  责任：后台审核数据读取与事务更新时包含 `customIconText`。
- Modify: `src/lib/verifications.ts`
  责任：校验和清洗自定义图标/介绍；允许“已通过同一认证”用户提交新的定制审核申请；统一把自定义图标映射到前台视图。
- Modify: `src/lib/admin-verification-service.ts`
  责任：把后台审核列表中的定制图标暴露给管理端界面。
- Modify: `src/app/api/verifications/apply/route.ts`
  责任：接收 `customIconText` 请求字段。
- Modify: `src/components/verification-center.tsx`
  责任：前台认证中心增加“自定义图标”输入；已通过认证时允许提交新的定制审核，不再完全隐藏表单。
- Modify: `src/components/admin/admin-verification-manager.tsx`
  责任：后台审核卡片显示申请中的定制图标和定制介绍，便于管理员判断。
- Modify: `src/components/user/user-verification-badge.tsx`
  责任：前台认证徽章优先展示 `customIconText`，tooltip 继续优先展示自定义介绍。
- Modify: `src/lib/post-map.ts`
- Modify: `src/lib/comments.ts`
- Modify: `src/lib/post-anonymous.ts`
- Modify: `src/lib/users.ts`
  责任：帖子、评论、匿名映射、用户页统一透传 `customIconText`。

### Task 1: Persist Custom Verification Icon

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/db/verification-queries.ts`
- Modify: `src/app/api/verifications/apply/route.ts`
- Modify: `src/lib/verifications.ts`

- [ ] **Step 1: Extend the Prisma model**

```prisma
model UserVerification {
  id                String                 @id @default(cuid())
  userId            Int
  typeId            String
  status            UserVerificationStatus @default(PENDING)
  content           String
  customIconText    String?
  customDescription String?
  formResponseJson  String?
}
```

- [ ] **Step 2: Accept the new API field**

```ts
const customIconText = readOptionalStringField(body, "customIconText")

const application = await submitVerificationApplication({
  userId: currentUser.id,
  verificationTypeId,
  content,
  customIconText,
  customDescription,
  formResponse,
})
```

- [ ] **Step 3: Sanitize and store the custom icon**

```ts
const customIconText = String(input.customIconText ?? "").trim()

const application = await createUserVerificationApplication({
  userId: input.userId,
  verificationTypeId: input.verificationTypeId,
  content,
  customIconText: customIconText || null,
  customDescription: customDescriptionSafety?.sanitizedText || null,
  formResponseJson: formFields.length > 0 ? JSON.stringify(sanitizedFormResponse) : null,
})
```

- [ ] **Step 4: Allow approved same-type users to submit a customization review**

```ts
if (latestApplication?.status === "APPROVED" && latestApplication.typeId === input.verificationTypeId) {
  const hasCustomizationChange = Boolean(customIconText || customDescription)

  if (!hasCustomizationChange) {
    throw new Error("请至少填写一个自定义图标或个性描述")
  }
}
```

- [ ] **Step 5: Verify generated types**

Run: `pnpm prisma:generate`
Expected: Prisma Client generation succeeds without schema errors.

### Task 2: Surface Customization In User And Admin UI

**Files:**
- Modify: `src/components/verification-center.tsx`
- Modify: `src/components/admin/admin-verification-manager.tsx`
- Modify: `src/lib/admin-verification-service.ts`

- [ ] **Step 1: Add the custom icon field in the verification center**

```tsx
<label className="space-y-2">
  <span className="text-sm font-medium">自定义图标（可选）</span>
  <input
    value={customIconText}
    onChange={(event) => setCustomIconText(event.target.value)}
    placeholder="可填 emoji、单字符或站内图标标识"
    className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm"
  />
</label>
```

- [ ] **Step 2: Keep approved verification active while showing a customization form**

```tsx
{currentApplication?.status === "APPROVED" ? (
  <div className="mt-5 space-y-4">
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm">
      当前认证继续生效；提交新的定制申请后，需等待管理员复审。
    </div>
    {renderCustomizationForm()}
  </div>
) : (
  renderApplicationForm()
)}
```

- [ ] **Step 3: Show custom icon/description in admin review cards**

```tsx
{item.customIconText ? (
  <div className="mt-3 rounded-[18px] bg-secondary/30 p-3 text-sm">
    <p className="text-xs text-muted-foreground">自定义图标</p>
    <p className="mt-1 text-xl leading-none">{item.customIconText}</p>
  </div>
) : null}
```

- [ ] **Step 4: Return the new field from admin data loaders**

```ts
applications: applications.map((item) => ({
  id: item.id,
  customIconText: item.customIconText,
  customDescription: item.customDescription,
}))
```

- [ ] **Step 5: Verify the admin and user flows compile**

Run: `npx tsc --noEmit`
Expected: TypeScript completes without new type errors in verification-related files.

### Task 3: Render Approved Custom Icons On The Frontend

**Files:**
- Modify: `src/components/user/user-verification-badge.tsx`
- Modify: `src/lib/post-map.ts`
- Modify: `src/lib/comments.ts`
- Modify: `src/lib/post-anonymous.ts`
- Modify: `src/lib/users.ts`
- Modify: `src/lib/verifications.ts`

- [ ] **Step 1: Add `customIconText` to verification view models**

```ts
export type VerificationBadgeView = {
  id: string
  name: string
  iconText: string
  customIconText?: string | null
  color: string
}
```

- [ ] **Step 2: Prefer the custom icon when mapping approved verification**

```ts
return {
  id: application.type.id,
  name: application.type.name,
  color: application.type.color,
  iconText: application.type.iconText,
  customIconText: application.customIconText,
  customDescription: application.customDescription,
}
```

- [ ] **Step 3: Render the effective icon in the shared badge component**

```tsx
<LevelIcon
  icon={verification.customIconText?.trim() || verification.iconText}
  color={verification.color}
  className={cn(compact ? "h-3 min-w-3 text-[12px]" : "h-3.5 min-w-3.5 text-[14px]", iconClassName)}
/>
```

- [ ] **Step 4: Reuse the same shape in post/comment/profile mappers**

```ts
authorVerification: item
  ? {
      id: item.type.id,
      name: item.type.name,
      color: item.type.color,
      iconText: item.type.iconText,
      customIconText: item.customIconText,
      customDescription: item.customDescription,
    }
  : null
```

- [ ] **Step 5: Run final verification**

Run: `pnpm prisma:generate`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

## Self-Review

- Spec coverage:
  - 自定义图标：Task 1、Task 2、Task 3 覆盖。
  - 自定义介绍：沿用现有 `customDescription`，Task 2、Task 3 覆盖。
  - 管理员审核：继续复用现有审核入口，Task 2 覆盖。
  - 最小化实现：不新增独立模块，仅复用 `UserVerification` 主链，整体架构已控制在单链路内。
- Placeholder scan:
  - 未使用 `TODO` / `TBD` / “之后补充” 之类占位描述。
- Type consistency:
  - 统一使用 `customIconText` 命名，避免与认证类型默认 `iconText` 混淆。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-custom-verification-minimal.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
