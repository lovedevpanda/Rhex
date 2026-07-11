import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("pending external auth state is consumed exactly once", async () => {
  const source = await readSource("src/lib/auth-flow-state.ts")

  assert.match(
    source,
    /export async function consumePendingExternalAuthState\(\)\s*\{\s*return consumeCookieValue<PendingExternalAuthState>\(PENDING_AUTH_COOKIE_NAME\)\s*}/,
  )
})

test("external account completion routes consume pending state before completing authentication", async () => {
  const routes = await Promise.all([
    readSource("src/app/api/auth/external/bind/route.ts"),
    readSource("src/app/api/auth/external/username/route.ts"),
  ])

  for (const source of routes) {
    const consume = source.indexOf("await consumePendingExternalAuthState()")
    assert.ok(consume >= 0, "route must atomically consume the pending state")
    assert.doesNotMatch(source, /readPendingExternalAuthState/)
  }

  assert.ok(routes[0].indexOf("completePendingExternalAuthBind", routes[0].indexOf("await consumePendingExternalAuthState()")) >= 0)
  assert.ok(routes[1].indexOf("completePendingExternalAuthUsername", routes[1].indexOf("await consumePendingExternalAuthState()")) >= 0)
})

test("password changes use compare-and-set and invalidate existing sessions", async () => {
  const source = await readSource("src/app/api/profile/password/route.ts")
  const update = source.indexOf("const passwordUpdated = await prisma.user.updateMany")
  const revoke = source.indexOf("await revokeSessionToken", update)

  assert.ok(update >= 0)
  assert.match(source.slice(update), /where:\s*\{\s*id: user\.id,\s*passwordHash: user\.passwordHash,/)
  assert.match(source.slice(update), /sessionInvalidBefore: new Date\(\)/)
  assert.match(source.slice(update), /if \(passwordUpdated\.count !== 1\)\s*\{\s*apiError\(409,/)
  assert.ok(revoke > update, "the session token must be revoked after the successful conditional update")
})

test("profile updates prevent replayed writes and map concurrent unique conflicts", async () => {
  const source = await readSource("src/app/api/profile/update/route.ts")
  const guard = source.indexOf("return withRequestWriteGuard({")
  const transaction = source.indexOf("const updated = await prisma.$transaction", guard)

  assert.ok(guard >= 0)
  assert.ok(transaction > guard, "the profile transaction must run within the request write guard")
  assert.match(source.slice(guard, transaction), /userId: currentUser\.id/)
  assert.match(source.slice(guard, transaction), /dedupeKey: JSON\.stringify\(body\)/)
  assert.match(source.slice(guard, transaction), /dedupeWindowMs: 10_000/)
  assert.match(source.slice(guard, transaction), /releaseOnError: true/)

  const conflictHandler = source.slice(transaction)
  for (const field of ["email", "phone", "nickname"]) {
    assert.match(conflictHandler, new RegExp(`isPrismaUniqueConstraintError\\(error, "${field}"\\)`))
  }
  assert.match(conflictHandler, /apiError\(409,/)
})
