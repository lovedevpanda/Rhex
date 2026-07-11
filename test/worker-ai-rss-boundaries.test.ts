import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("internal revalidation requires its dedicated secret and compares it safely", async () => {
  const source = await readSource("src/app/api/internal/revalidate-content/route.ts")

  assert.match(source, /INTERNAL_REVALIDATION_SECRET/)
  assert.doesNotMatch(source, /SESSION_SECRET/)
  assert.match(source, /timingSafeEqual/)
  assert.match(source, /expectedBuffer\.length !== receivedBuffer\.length/)
})

test("AI reply completion atomically retains task ownership before publishing a comment", async () => {
  const source = await readSource("src/lib/ai-reply.ts")

  assert.match(source, /resolveSafeOutboundTarget\(params\.config\.baseUrl\)/)
  assert.match(source, /tx\.aiReplyTask\.updateMany\(/)
  assert.match(source, /generatedCommentId:\s*null/)
  assert.match(source, /taskOwnership\.count !== 1/)
  assert.match(source, /status:\s*AiReplyTaskStatus\.SUCCEEDED/)

  const ownershipClaim = source.indexOf("const taskOwnership = await tx.aiReplyTask.updateMany")
  const commentCreate = source.indexOf("const comment = await tx.comment.create", ownershipClaim)
  const taskSuccess = source.indexOf("await tx.aiReplyTask.update({", commentCreate)
  assert.ok(ownershipClaim >= 0 && ownershipClaim < commentCreate, "task ownership must be checked before comment creation")
  assert.ok(commentCreate >= 0 && commentCreate < taskSuccess, "task success must be committed with the comment transaction")
})

test("RSS queue replays cannot bypass a delayed retry schedule", async () => {
  const source = await readSource("src/lib/rss-harvest.ts")

  const executeStart = source.indexOf("async function executeRssProcessQueueJob")
  const claim = source.indexOf("await claimPendingRssQueueRecord", executeStart)
  const dueChecks = source.match(/scheduledAt\.getTime\(\) > Date\.now\(\)/g) ?? []

  assert.equal(dueChecks.length >= 2, true)
  assert.ok(source.indexOf("queueItem.scheduledAt.getTime() > Date.now()", executeStart) < claim)
  assert.ok(source.indexOf("latestQueueItem.scheduledAt.getTime() > Date.now()", executeStart) < claim)
})


test("webhook delivery exposes a stable idempotency key for retried jobs", async () => {
  const source = await readSource("src/lib/user-notification-delivery.ts")

  assert.match(source, /function resolveWebhookIdempotencyKey/)
  assert.match(source, /"Idempotency-Key": resolveWebhookIdempotencyKey\(payload\)/)
  assert.match(source, /payload\.notification\.id/)
  assert.match(source, /payload\.message\.id/)
})
