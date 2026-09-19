import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { normalizeAuthRedirectTarget } from "../src/lib/auth-redirect"
import { isPrivateUploadFolder, isSafeUploadPathSegments } from "../src/lib/upload-rules"

/**
 * Regression tests for three independent security fixes.
 *
 * ASCII-only on purpose: rewriting a UTF-8 (no BOM) file with Windows PowerShell
 * Set-Content makes it decode the bytes as GBK and double-encode the text.
 */

async function readSource(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8")
}

const CONNECT_FALLBACK = "/settings?tab=profile&profileTab=accounts"

/* -------------------------------------------------------------------------- */
/* 1. Open redirect in the OAuth connect flow                                  */
/* -------------------------------------------------------------------------- */

test("normalizeAuthRedirectTarget rejects protocol-relative and absolute targets", () => {
  const attacks = [
    "//evil.com",
    "//evil.com/",
    "//evil.com/path?x=1",
    "///evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "\\\\evil.com",
    "  //evil.com  ",
  ]

  for (const attack of attacks) {
    const result = normalizeAuthRedirectTarget(attack, CONNECT_FALLBACK)
    assert.equal(result, CONNECT_FALLBACK, `${JSON.stringify(attack)} must be rejected`)
    assert.ok(result.startsWith("/") && !result.startsWith("//"), "fallback must stay on-site")
  }

  // legitimate in-site paths survive
  assert.equal(
    normalizeAuthRedirectTarget("/boards/general-discussion", CONNECT_FALLBACK),
    "/boards/general-discussion",
  )
  assert.equal(normalizeAuthRedirectTarget(null, CONNECT_FALLBACK), CONNECT_FALLBACK)
})

test("the OAuth start route never validates redirectTo with a bare startsWith('/')", async () => {
  const source = await readSource("src/app/api/auth/oauth/[provider]/start/route.ts")

  // both the connect and login branches must go through the sanitizer
  assert.match(source, /normalizeAuthRedirectTarget\(redirectTo, "\/settings/)
  assert.match(source, /normalizeAuthRedirectTarget\(redirectTo\)/)

  // the old weak check must not come back: "//evil.com" also starts with "/"
  assert.doesNotMatch(
    source,
    /redirectTo\?\.startsWith\("\/"\)\s*\?/,
    "redirectTo must not be validated with startsWith('/') alone",
  )
})

test("the OAuth callback sanitizes the connect target again", async () => {
  const source = await readSource("src/app/api/auth/oauth/[provider]/callback/route.ts")

  assert.doesNotMatch(
    source,
    /\?\s*oauthState\.redirectTo\s*\|\|/,
    "callback must not use oauthState.redirectTo directly as a redirect target",
  )
  assert.match(source, /normalizeAuthRedirectTarget\(\s*oauthState\?\.redirectTo,/)
})

/* -------------------------------------------------------------------------- */
/* 2. Admin site settings used to return every stored secret                   */
/* -------------------------------------------------------------------------- */

test("site settings API strips sensitiveStateJson from GET and POST responses", async () => {
  const source = await readSource("src/app/api/admin/site-settings/route.ts")

  assert.match(source, /function stripSensitiveSiteSettings/)
  assert.match(source, /delete \(rest as Record<string, unknown>\)\.sensitiveStateJson/)

  // returning the raw row would ship plaintext OAuth/S3/SMS/payment/AI keys
  assert.doesNotMatch(source, /return apiSuccess\(settings\)/)
  assert.match(source, /return apiSuccess\(stripSensitiveSiteSettings\(/)

  assert.doesNotMatch(source, /return apiSuccess\(result\.settings, result\.message\)/)
  assert.match(source, /stripSensitiveSiteSettings\(result\.settings as Record<string, unknown>\)/)
})

/* -------------------------------------------------------------------------- */
/* 3. Private direct-message attachments were readable from the public route   */
/* -------------------------------------------------------------------------- */

test("message-files is private while public folders stay public", () => {
  assert.equal(isPrivateUploadFolder("message-files"), true)

  for (const folder of ["avatars", "posts", "comments", "post-covers", "message-images", "site-logo", "icon", "emoji", "watermark"]) {
    assert.equal(isPrivateUploadFolder(folder), false, `${folder} must stay public`)
  }

  // path-segment validation is unchanged; the refusal happens in the route's gate
  assert.equal(isSafeUploadPathSegments(["message-files", "message-files-abc123.pdf"]), true)
  assert.equal(isSafeUploadPathSegments(["..", "etc", "passwd"]), false)
})

test("the public uploads route refuses private folders for both GET and HEAD", async () => {
  const source = await readSource("src/app/uploads/[...path]/route.ts")

  assert.match(source, /isPrivateUploadFolder/)
  assert.match(source, /function assertPubliclyReadable/)

  const guardUses = source.match(/assertPubliclyReadable\(/g) ?? []
  assert.equal(guardUses.length >= 3, true, "gate should be defined once and called from GET and HEAD")

  assert.doesNotMatch(
    source,
    /async function readUploadResponse\(pathSegments: readonly string\[\]\) \{\s*\n\s*if \(!isSafeUploadPathSegments/,
    "readUploadResponse must start with the gate",
  )
})

/* -------------------------------------------------------------------------- */
/* 4. Invite codes could be redeemed twice under concurrency                   */
/* -------------------------------------------------------------------------- */

test("invite code usage is claimed with a conditional update", async () => {
  const queries = await readSource("src/db/external-auth-user-queries.ts")

  assert.match(queries, /export async function markInviteCodeAsUsed/)
  assert.match(queries, /inviteCode\.updateMany\(/)
  assert.match(queries, /usedById: null/)
  assert.match(queries, /return claimed\.count === 1/)

  // the old unconditional update must not come back
  assert.doesNotMatch(queries, /inviteCode\.update\(\{\s*\n\s*where: \{ id: inviteCodeId \}/)
})

test("both registration paths roll back when the invite code was taken concurrently", async () => {
  for (const file of ["src/lib/auth-register-service.ts", "src/lib/external-auth-service.ts"]) {
    const source = await readSource(file)

    assert.match(source, /const claimed = await markInviteCodeAsUsed\(/, `${file} must check the claim result`)
    assert.match(source, /if \(!claimed\) \{\s*\n\s*apiError\(409, "邀请码已被使用"\)/, `${file} must abort on a lost claim`)
  }
})
