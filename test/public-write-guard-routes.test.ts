import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("public write routes keep their dedicated guard wiring", async () => {
  const guardedRoutes = [
    ["src/app/api/auth/captcha/route.ts", "auth-captcha"],
    ["src/app/api/auth/pow/route.ts", "auth-pow"],
    ["src/app/api/auth/verify-code/route.ts", "auth-verify-code"],
    ["src/app/api/auth/forgot-password/reset/route.ts", "auth-forgot-password-reset"],
    ["src/app/api/comments/create/route.ts", "comments-create"],
    ["src/app/api/comments/update/route.ts", "comments-update"],
    ["src/app/api/comments/offline/route.ts", "comments-offline"],
    ["src/app/api/comments/like/route.ts", "comments-like"],
    ["src/app/api/follows/toggle/route.ts", "follows-toggle"],
    ["src/app/api/blocks/toggle/route.ts", "blocks-toggle"],
    ["src/app/api/board-applications/route.ts", "board-applications-submit"],
    ["src/app/api/board-applications/treasury/route.ts", "board-applications-treasury-withdraw"],
    ["src/app/api/posts/ai-categorize/route.ts", "posts-ai-categorize"],
  ] as const

  await Promise.all(guardedRoutes.map(async ([file, policy]) => {
    const source = await readSource(file)
    assert.match(source, /withPublicWriteGuard/)
    assert.ok(source.includes(`withPublicWriteGuard("${policy}"`), `${file} should use ${policy}`)
  }))
})

test("password reset delivery keeps account discovery private", async () => {
  const source = await readSource("src/app/api/auth/forgot-password/send-code/route.ts")

  assert.doesNotMatch(source, /findUserByEmail/)
  assert.doesNotMatch(source, /username/)
  assert.match(source, /expiresAt: null/)
  assert.match(source, /shouldMaskPasswordResetSendError/)
  assert.match(source, /\u5982\u8be5\u90ae\u7bb1\u5df2\u7ed1\u5b9a\u53ef\u7528\u8d26\u53f7/)
  assert.match(source, /\u5982\u8be5\u624b\u673a\u53f7\u5df2\u7ed1\u5b9a\u53ef\u7528\u8d26\u53f7/)
})

test("phone login verification does not expose account availability", async () => {
  const source = await readSource("src/app/api/auth/send-verification-code/route.ts")

  assert.match(source, /phoneLoginAccountUnavailable/)
  assert.match(source, /expiresAt: channel === VerificationChannel\.PHONE && purpose === "login" \? null : expiresAt/)
  assert.match(source, /\u5982\u8be5\u624b\u673a\u53f7\u5df2\u7ed1\u5b9a\u53ef\u7528\u8d26\u53f7/)
})
