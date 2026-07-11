import assert from "node:assert/strict"
import test from "node:test"

import { PublicRouteError } from "../src/lib/public-route-error"
import {
  createPublicWriteDedupeKey,
  createPublicWriteGuardOptions,
  shouldMaskPasswordResetSendError,
} from "../src/lib/public-write-guard"

test("public write guard derives anonymous identity from the request IP", () => {
  const request = new Request("https://example.test/api/auth/captcha", {
    headers: { "x-forwarded-for": "203.0.113.42" },
  })

  const options = createPublicWriteGuardOptions("auth-captcha", { request })

  assert.equal(options.scope, "auth-captcha")
  assert.equal(options.cooldownMs, 1_000)
  assert.deepEqual(options.identity, { userId: null, ip: "203.0.113.42" })
  assert.equal(options.dedupeKey, undefined)
})

test("public write guard adds target-scoped dedupe only for idempotent policies", () => {
  const request = new Request("https://example.test/api/comments/create")
  const dedupeKey = createPublicWriteDedupeKey("post-1", "", "same comment")

  const commentOptions = createPublicWriteGuardOptions("comments-create", {
    request,
    userId: 7,
    dedupeKey,
  })
  const verifyOptions = createPublicWriteGuardOptions("auth-verify-code", {
    request,
    dedupeKey,
  })

  assert.equal(commentOptions.dedupeKey, dedupeKey)
  assert.equal(commentOptions.dedupeWindowMs, 10_000)
  assert.deepEqual(commentOptions.identity, { userId: 7, ip: null })
  assert.equal(verifyOptions.dedupeKey, undefined)
  assert.equal(verifyOptions.dedupeWindowMs, undefined)

  const aiOptions = createPublicWriteGuardOptions("posts-ai-categorize", {
    request,
    userId: 7,
    dedupeKey,
  })
  assert.equal(aiOptions.cooldownMs, 2_000)
  assert.equal(aiOptions.dedupeKey, dedupeKey)
  assert.equal(aiOptions.dedupeWindowMs, 10_000)
})

test("public write dedupe keys preserve empty fields so request shapes cannot collide", () => {
  assert.notEqual(
    createPublicWriteDedupeKey("post-1", "reply-1", "content"),
    createPublicWriteDedupeKey("post-1", "", "reply-1", "content"),
  )
})

test("password-reset delivery masking only suppresses account-discovery failures", () => {
  assert.equal(shouldMaskPasswordResetSendError(new PublicRouteError("\u8be5\u90ae\u7bb1\u672a\u7ed1\u5b9a\u8d26\u53f7", 404)), true)
  assert.equal(shouldMaskPasswordResetSendError(new PublicRouteError("\u8be5\u8d26\u53f7\u5df2\u88ab\u7981\u7528\uff0c\u65e0\u6cd5\u627e\u56de\u5bc6\u7801", 403)), true)
  assert.equal(shouldMaskPasswordResetSendError(new PublicRouteError("\u90ae\u4ef6\u670d\u52a1\u4e0d\u53ef\u7528", 400)), false)
  assert.equal(shouldMaskPasswordResetSendError(new Error("\u8be5\u90ae\u7bb1\u672a\u7ed1\u5b9a\u8d26\u53f7")), false)
})
