import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("admin user-management policy rejects self-targets before tier checks", async () => {
  const policy = await readSource("src/lib/admin-permission-policy.ts")
  const rolePolicy = await readSource("src/lib/admin-user-permission-policy.ts")

  assert.match(policy, /export function canManageTargetUser[\s\S]*?if \(input\.actor\.id === input\.targetId\) \{[\s\S]*?return false/)
  assert.match(policy, /export function canChangeTargetRole[\s\S]*?if \(input\.actor\.id === input\.targetId\) \{[\s\S]*?return false/)
  assert.match(rolePolicy, /if \(input\.actorId === input\.targetId\) \{[\s\S]*?return/)
  assert.doesNotMatch(rolePolicy, /input\.actorId === input\.targetId && input\.nextRole !== UserRole\.ADMIN/)
})

test("generic admin user actions reject a current operator before dispatch", async () => {
  const source = await readSource("src/lib/admin-action-management.ts")

  assert.match(source, /context\.action\.startsWith\("user\."\)/)
  assert.match(source, /targetUserId === context\.actor\.id/)
  assert.ok(
    source.indexOf('context.action.startsWith("user.")') < source.indexOf("await definition.execute(context)"),
    "self-target validation must happen before the action handler runs",
  )
})

test("role and status mutations invalidate prior user sessions", async () => {
  const source = await readSource("src/db/admin-user-action-queries.ts")
  const bulkSource = await readSource("src/lib/admin-user-bulk-actions.ts")

  for (const functionName of ["updateUserStatus", "updateUserRole", "promoteUserToAdmin", "demoteUserToUser"]) {
    const start = source.indexOf(`export function ${functionName}`)
    const next = source.indexOf("\nexport function ", start + 1)
    const body = source.slice(start, next === -1 ? undefined : next)
    assert.match(body, /sessionInvalidBefore:\s*new Date\(\)/, `${functionName} must invalidate sessions`)
  }

  assert.match(bulkSource, /function buildStatusUpdateData[\s\S]*?sessionInvalidBefore:\s*new Date\(\)/)
  assert.match(bulkSource, /role, sessionInvalidBefore:\s*new Date\(\)/)
})

test("user bulk input is bounded and cannot coerce or deduplicate identities", async () => {
  const source = await readSource("src/lib/admin-user-bulk-actions.ts")
  const normalizeStart = source.indexOf("function normalizeUserIds")
  const normalizeEnd = source.indexOf("\nfunction readOptionalString", normalizeStart)
  const normalize = source.slice(normalizeStart, normalizeEnd)

  assert.match(normalize, /value\.length > MAX_BULK_USERS/)
  assert.match(normalize, /typeof item === "number"/)
  assert.ok(normalize.includes('typeof item === "string" && /^\\d+$/.test(item.trim())'))
  assert.doesNotMatch(normalize, /Number\(item\)/)
  assert.match(normalize, /uniqueIds\.length !== ids\.length/)
  assert.match(source, /typeof input\.action === "string" \? input\.action\.trim\(\) : input\.action/)
})

test("permission grants invalidate target sessions after persistence", async () => {
  const source = await readSource("src/app/api/admin/users/permissions/route.ts")

  assert.match(source, /invalidateUserSessions/)
  assert.ok(
    source.indexOf("await saveAdminPermissionGrants") < source.indexOf("await invalidateUserSessions(userId)"),
    "the session cutoff must be written after grants persist",
  )
  assert.ok(
    source.indexOf("await invalidateUserSessions(userId)") < source.indexOf("await writeAdminLog"),
    "the audit record must only claim a completed session invalidation",
  )
})

test("moderator-scope mutations enforce target, scope, session, and audit boundaries", async () => {
  const source = await readSource("src/lib/admin-moderator-scopes.ts")
  const route = await readSource("src/app/api/admin/moderator-scopes/route.ts")

  assert.match(source, /const MAX_SCOPE_ASSIGNMENTS = 100/)
  assert.match(source, /!Array\.isArray\(value\) \|\| value\.length > MAX_SCOPE_ASSIGNMENTS/)
  assert.match(source, /typeof record\.canEditSettings !== "boolean"/)
  assert.match(source, /typeof record\.canWithdrawTreasury !== "boolean"/)
  assert.match(source, /new Set\(scopes\.map\(\(scope\) => scope\.id\)\)\.size !== scopes\.length/)
  assert.match(source, /function readPositiveUserId/)
  assert.match(source, /const userId = readPositiveUserId\(params\.body\.userId\)/)
  assert.match(source, /userId === params\.actor\.id/)
  assert.match(source, /await replaceModeratorScopes\(userId, zoneScopes, boardScopes\)[\s\S]*?await invalidateUserSessions\(userId\)/)
  assert.match(source, /action:\s*"moderator\.scopes\.replace"/)
  assert.match(route, /await writeAdminLog\(adminUser\.id, result\.action, result\.targetType, result\.targetId, result\.detail, getRequestIp\(request\)\)/)
})

test("structure moderator controls cannot alter self or administrator scope grants", async () => {
  const source = await readSource("src/lib/admin-structure-moderators.ts")

  assert.match(source, /moderator\.id === params\.actor\.id/)
  assert.match(source, /moderatorId === params\.actor\.id/)
  assert.match(source, /moderator\.role === UserRole\.ADMIN/)
  assert.match(source, /findModeratorScopeSetup\(moderatorId, \[\], \[\]\)/)
  assert.match(source, /moderator\.role !== UserRole\.MODERATOR/)
  assert.match(source, /Number\.isSafeInteger\(moderatorId\)/)
  assert.match(source, /function readOptionalBoolean/)
  assert.match(source, /typeof value !== "boolean"/)
  assert.match(source, /await upsertModeratorTargetScope[\s\S]*?await invalidateUserSessions\(moderator\.id\)/)
  assert.match(source, /await deleteModeratorTargetScope[\s\S]*?await invalidateUserSessions\(moderatorId\)/)
})

test("content bulk routes apply their limits to raw input and reject malformed or duplicate IDs", async () => {
  for (const [file, field] of [
    ["src/app/api/admin/posts/bulk/route.ts", "postIds"],
    ["src/app/api/admin/comments/bulk/route.ts", "commentIds"],
  ] as const) {
    const source = await readSource(file)
    assert.match(source, new RegExp(`const rawIds = body\\.${field}`))
    assert.match(source, /!Array\.isArray\(rawIds\) \|\| rawIds\.length === 0/)
    assert.match(source, /rawIds\.length > 100/)
    assert.match(source, /typeof item !== "string"/)
    assert.match(source, /!id \|\| id\.length > 191/)
    assert.match(source, /new Set\(ids\)\.size !== ids\.length/)
    assert.doesNotMatch(source, /rawIds\.map\(\(item\) => typeof item === "string"/)
  }
})

test("direct admin action route caps control-plane selectors and free-form detail", async () => {
  const source = await readSource("src/app/api/admin/actions/route.ts")

  assert.match(source, /MAX_ADMIN_ACTION_LENGTH = 128/)
  assert.match(source, /MAX_ADMIN_TARGET_ID_LENGTH = 191/)
  assert.match(source, /MAX_ADMIN_MESSAGE_LENGTH = 10_000/)
  assert.match(source, /ensureMaxLength\(action, MAX_ADMIN_ACTION_LENGTH/)
  assert.match(source, /ensureMaxLength\(targetId, MAX_ADMIN_TARGET_ID_LENGTH/)
  assert.match(source, /ensureMaxLength\(message, MAX_ADMIN_MESSAGE_LENGTH/)
})