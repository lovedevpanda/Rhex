import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { parseSessionToken } from "@/lib/session"

function createSignedSessionToken(payload: object, secret: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("hex")
  return `${encodedPayload}.${signature}`
}

test("session parser rejects a valid token with appended segments", async () => {
  const originalSecret = process.env.SESSION_SECRET
  const secret = "auth-session-boundaries-test-secret"
  const now = Math.floor(Date.now() / 1000)
  process.env.SESSION_SECRET = secret

  try {
    const token = createSignedSessionToken({
      username: "session-boundary-user",
      issuedAt: now,
      expiresAt: now + 60,
    }, secret)

    assert.equal((await parseSessionToken(token))?.username, "session-boundary-user")
    assert.equal(await parseSessionToken(`${token}.appended`), null)
  } finally {
    if (originalSecret === undefined) {
      delete process.env.SESSION_SECRET
    } else {
      process.env.SESSION_SECRET = originalSecret
    }
  }
})

test("OAuth and passkey ceremony state is atomically single-use", async () => {
  const source = await readFile(path.join(process.cwd(), "src/lib/auth-flow-state.ts"), "utf8")
  const consumeStart = source.indexOf("async function consumeCookieValue")
  const consumeEnd = source.indexOf("export function buildOAuthStateCookieName")
  const consumeFunction = source.slice(consumeStart, consumeEnd)

  assert.ok(consumeStart >= 0 && consumeEnd > consumeStart)
  assert.match(consumeFunction, /getRedis\(\)\.eval\(/)
  assert.match(consumeFunction, /CONSUME_AUTH_FLOW_STATE_SCRIPT/)
  assert.match(consumeFunction, /if \(!pointer\?\.nonce\) \{\s+return null\s+}/)
  assert.doesNotMatch(consumeFunction, /return parseSignedValue/)
  assert.match(source, /redis\.call\("get", KEYS\[1\]\)[\s\S]*redis\.call\("del", KEYS\[1\]\)/)


})

