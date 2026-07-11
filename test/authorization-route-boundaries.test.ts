import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { canAccessMessageFile } from "@/app/api/messages/files/[uploadId]/[filename]/route"
import { readNotificationDeleteRequest } from "@/app/api/notifications/delete/route"
import { readOptionalNumberField, requireNumberField, requirePositiveIntegerField, requireStringField } from "@/lib/api-route"
import { PublicRouteError } from "@/lib/public-route-error"

function expectBadRequest(callback: () => unknown) {
  assert.throws(callback, (error: unknown) => (
    error instanceof PublicRouteError && error.statusCode === 400
  ))
}

test("message file downloads require ownership or a sender-authenticated shared message", () => {
  assert.equal(canAccessMessageFile({
    requesterId: 7,
    uploadOwnerId: 7,
    isSharedWithRequester: false,
  }), true)

  assert.equal(canAccessMessageFile({
    requesterId: 8,
    uploadOwnerId: 7,
    isSharedWithRequester: true,
  }), true)

  assert.equal(canAccessMessageFile({
    requesterId: 8,
    uploadOwnerId: 7,
    isSharedWithRequester: false,
  }), false)
})

test("numeric write fields reject implicit boolean, null, and blank coercions", () => {
  assert.equal(requireNumberField({ amount: "12.5" }, "amount", "invalid"), 12.5)
  assert.equal(requirePositiveIntegerField({ userId: "42" }, "userId", "invalid"), 42)
  assert.equal(readOptionalNumberField({ pageSize: "  " }, "pageSize"), undefined)

  expectBadRequest(() => requireNumberField({ amount: true }, "amount", "invalid"))
  expectBadRequest(() => requireNumberField({ amount: null }, "amount", "invalid"))
  expectBadRequest(() => requireNumberField({ amount: "  " }, "amount", "invalid"))
  expectBadRequest(() => requirePositiveIntegerField({ userId: true }, "userId", "invalid"))
})


test("notification deletion requires exactly one valid deletion target", () => {
  assert.deepEqual(readNotificationDeleteRequest({ notificationId: "notice-1" }), {
    notificationId: "notice-1",
    deleteAll: false,
  })
  assert.deepEqual(readNotificationDeleteRequest({ deleteAll: true }), {
    notificationId: "",
    deleteAll: true,
  })

  expectBadRequest(() => readNotificationDeleteRequest({}))
  expectBadRequest(() => readNotificationDeleteRequest({ notificationId: "notice-1", deleteAll: true }))
})

test("OAuth client mutations reject missing or blank client ids before lookup", () => {
  assert.equal(requireStringField({ id: " client-1 " }, "id", "invalid"), "client-1")
  expectBadRequest(() => requireStringField({}, "id", "invalid"))
  expectBadRequest(() => requireStringField({ id: "  " }, "id", "invalid"))
})

test("OAuth token issuance serializes with subject deactivation", async () => {
  const source = await readFile(path.join(process.cwd(), "src/db/oauth-queries.ts"), "utf8")

  assert.match(source, /async function lockActiveOAuthUser\(tx: Prisma\.TransactionClient, userId: number\)/)
  assert.match(source, /SELECT "id"[\s\S]*"status" = \$\{UserStatus\.ACTIVE\}::"UserStatus"[\s\S]*FOR UPDATE/)
  assert.equal((source.match(/if \(!await lockActiveOAuthUser\(tx, params\.userId\)\)/g) ?? []).length, 2)
})
