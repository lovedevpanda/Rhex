import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("post offline requires an authenticated actor and serializes the paid status transition", async () => {
  const [route, service, queries] = await Promise.all([
    readSource("src/app/api/posts/offline/route.ts"),
    readSource("src/lib/post-offline.ts"),
    readSource("src/db/post-offline-queries.ts"),
  ])

  assert.match(route, /createUserRouteHandler/)
  assert.match(route, /actorId:\s*currentUser\.id/)
  assert.match(route, /allowStatuses:\s*\["ACTIVE", "MUTED"\]/)
  assert.match(queries, /export async function lockPostOfflineTarget/)
  assert.match(queries, /FROM "Post"/)
  assert.match(queries, /FOR UPDATE/)

  const lockIndex = service.indexOf("await lockPostOfflineTarget(tx, input.postId)")
  const targetReadIndex = service.indexOf("findPostOfflineTarget(input.postId, tx)", lockIndex)
  const debitIndex = service.indexOf("await applyPointDelta", lockIndex)
  const transitionIndex = service.indexOf("await updatePostOfflineTarget", lockIndex)

  assert.ok(lockIndex >= 0 && lockIndex < targetReadIndex, "post state must be read after its row lock")
  assert.ok(targetReadIndex < debitIndex, "the paid transition must validate status before debiting points")
  assert.ok(debitIndex < transitionIndex, "the debit and status transition must remain in one transaction")
})

test("comment offline performs a conditional transition before any owner notification", async () => {
  const [service, queries] = await Promise.all([
    readSource("src/lib/comment-offline.ts"),
    readSource("src/db/comment-offline-queries.ts"),
  ])

  assert.match(queries, /client\.comment\.updateMany\(/)
  assert.match(queries, /status:\s*CommentStatus\.NORMAL/)
  assert.match(queries, /if \(updated\.count !== 1\) \{\s*return null/)
  assert.match(service, /if \(!updated\) \{\s*apiError\(409, "评论状态已变更，请刷新后重试"\)/)
  assert.ok(
    service.indexOf("if (!updated)") < service.indexOf("await createSystemNotification"),
    "a failed conditional transition must not send a duplicate offline notification",
  )
})

test("pinning claims the selected top-level NORMAL comment before clearing any prior pin", async () => {
  const route = await readSource("src/app/api/posts/pin-comment/route.ts")

  const claimIndex = route.indexOf("const pinned = await tx.comment.updateMany")
  const clearOthersIndex = route.indexOf("id: { not: commentId }")
  assert.ok(claimIndex >= 0 && claimIndex < clearOthersIndex, "the new pin must be conditionally claimed before old pins are cleared")
  assert.match(route, /id: commentId,\s*postId,\s*parentId: null,\s*status: "NORMAL"/)
  assert.match(route, /if \(pinned\.count !== 1\) \{\s*apiError\(409/)
  assert.match(route, /const unpinned = await tx\.comment\.updateMany/)
})

test("post append rechecks interval and derives sort order under a row lock", async () => {
  const [service, queries] = await Promise.all([
    readSource("src/lib/post-update-service.ts"),
    readSource("src/db/post-update-queries.ts"),
  ])

  assert.match(queries, /export async function lockPostAppendTarget/)
  assert.match(queries, /FROM "Post"/)
  assert.match(queries, /FOR UPDATE/)
  assert.match(queries, /export function findPostAppendState/)

  const transactionIndex = service.indexOf("await runPostUpdateTransaction(async (tx) =>", service.indexOf('mode: "append"'))
  const lockIndex = service.indexOf("await lockPostAppendTarget(tx, input.postId)", transactionIndex)
  const stateReadIndex = service.indexOf("await findPostAppendState(tx, input.postId)", lockIndex)
  const intervalIndex = service.indexOf("latestAppendState.lastAppendedAt", stateReadIndex)
  const sortIndex = service.indexOf("const nextSortOrder = (latestAppendState.appendices[0]?.sortOrder ?? -1) + 1", stateReadIndex)
  const appendixCreateIndex = service.indexOf("sortOrder: nextSortOrder", sortIndex)

  assert.ok(transactionIndex >= 0 && transactionIndex < lockIndex, "append lock must be inside the write transaction")
  assert.ok(lockIndex < stateReadIndex && stateReadIndex < intervalIndex, "the interval must use state read after the lock")
  assert.ok(intervalIndex < sortIndex && sortIndex < appendixCreateIndex, "the locked state must determine the next appendix order")
})