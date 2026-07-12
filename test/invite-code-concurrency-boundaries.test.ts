import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("invite-code purchases lock the purchaser before checking unused-code holdings", async () => {
  const source = await readSource("src/db/invite-code-write-queries.ts")

  assert.match(source, /async function lockInviteCodePurchaseUser/)
  assert.match(source, /PrismaClient\.sql`[\s\S]*FROM "User"[\s\S]*FOR UPDATE/)
  assert.match(source, /await lockInviteCodePurchaseUser\(tx, params\.userId\)/)

  const lock = source.indexOf("await lockInviteCodePurchaseUser(tx, params.userId)")
  const unusedCount = source.indexOf("const unusedCount = await tx.inviteCode.count")
  const inviteCodeCreate = source.indexOf("const inviteCodes = await Promise.all")
  const pointDebit = source.indexOf("const purchaseResult = await applyPointDelta")

  assert.ok(lock >= 0 && lock < unusedCount, "must lock before counting unused invite codes")
  assert.ok(lock < inviteCodeCreate, "must retain the lock while creating invite codes")
  assert.ok(lock < pointDebit, "must retain the lock while debiting points")
})
