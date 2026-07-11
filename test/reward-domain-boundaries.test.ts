import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("board application submission serializes a user and slug before checking pending state", async () => {
  const source = await readSource("src/db/board-application-queries.ts")

  assert.match(source, /createPendingBoardApplicationIfAbsent/)
  assert.match(source, /pg_advisory_xact_lock/)
  assert.match(source, /board-application-submit/)
  assert.match(source, /applicantId:\s*data\.applicantId/)
  assert.match(source, /status:\s*BoardApplicationStatus\.PENDING/)
  assert.ok(
    source.indexOf("pg_advisory_xact_lock") < source.indexOf("tx.boardApplication.findFirst"),
    "the business key must be locked before checking for a pending application",
  )
})

test("board application review claims the pending state before board creation", async () => {
  const source = await readSource("src/db/board-application-queries.ts")

  assert.match(source, /const claimed = await tx\.boardApplication\.updateMany\(/)
  assert.match(source, /claimed\.count !== 1/)
  assert.match(source, /status:\s*BoardApplicationStatus\.PENDING/)
  assert.ok(
    source.indexOf("const claimed = await tx.boardApplication.updateMany") < source.indexOf("const board = await tx.board.create"),
    "the application must be conditionally claimed before creating the board",
  )

  assert.match(source, /export function rejectBoardApplication[\s\S]*?\.updateMany\(/)
  assert.match(source, /export function updateBoardApplicationByAdmin[\s\S]*?\.updateMany\(/)
})

test("board application service turns lost conditional transitions into conflicts", async () => {
  const source = await readSource("src/lib/board-applications.ts")

  assert.match(source, /createPendingBoardApplicationIfAbsent/)
  assert.match(source, /if \(!application\) \{[\s\S]*?apiError\(409/)
  assert.match(source, /updated\.count !== 1/)
  assert.match(source, /rejected\.count !== 1/)
})

test("badge display toggles serialize per user before counting display slots", async () => {
  const dbSource = await readSource("src/db/badge-queries.ts")
  const serviceSource = await readSource("src/lib/badges.ts")

  assert.match(dbSource, /function lockUserBadgeDisplayState/)
  assert.match(dbSource, /pg_advisory_xact_lock/)
  assert.match(dbSource, /badge-display-state/)
  assert.match(dbSource, /client:\s*Prisma\.TransactionClient \| typeof prisma = prisma/)

  assert.match(serviceSource, /runBadgeTransaction\(async \(tx\) => \{/)
  assert.match(serviceSource, /await lockUserBadgeDisplayState\(tx, userId\)/)
  assert.match(serviceSource, /findDisplayedUserBadges\(userId, tx\)/)
  assert.match(serviceSource, /updateUserBadgeDisplayById\(userBadge\.id,[\s\S]*?\}, tx\)/)
  assert.ok(
    serviceSource.indexOf("await lockUserBadgeDisplayState(tx, userId)") < serviceSource.indexOf("findDisplayedUserBadges(userId, tx)"),
    "the display state must be locked before counting used display slots",
  )
})