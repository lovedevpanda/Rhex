import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("check-in consumes the user/day uniqueness boundary before any point settlement", async () => {
  const source = await readSource("src/db/check-in-queries.ts")

  assert.match(source, /tx\.userCheckInLog\.createMany\(/)
  assert.match(source, /skipDuplicates:\s*true/)
  assert.match(source, /created\.count === 0/)
  assert.ok(
    source.indexOf("created.count === 0") < source.indexOf("await applyPointDelta"),
    "a duplicate check-in must return before either a make-up deduction or a reward credit",
  )
})

test("post reward-pool daily limits are checked under the sender lock in the write transaction", async () => {
  const [queries, rewards] = await Promise.all([
    readSource("src/db/post-red-packet-queries.ts"),
    readSource("src/lib/post-red-packets.ts"),
  ])

  assert.match(queries, /export async function lockPostRewardPoolSender/)
  assert.match(queries, /FROM "User"/)
  assert.match(queries, /WHERE "id" = \$\{senderId\}/)
  assert.match(queries, /FOR UPDATE/)
  assert.match(queries, /sumTodayPostRedPacketPoints\([\s\S]*client\?: Prisma\.TransactionClient/)
  assert.match(rewards, /await lockPostRewardPoolSender\(params\.tx, params\.senderId\)/)
  assert.match(rewards, /sumTodayPostRedPacketPoints\(params\.senderId, start, end, params\.tx\)/)
  assert.match(rewards, /totalPoints: totalPoolPoints,\s*tx: params\.tx/)
  assert.ok(
    rewards.indexOf("await assertPostRedPacketDailyLimit({") < rewards.indexOf("await createPostRewardPoolRecord(params.tx"),
    "the daily budget must be reserved before the reward-pool row is created",
  )
})

test("RSS tips lock the sender before counting limits and creating a debit", async () => {
  const [queries, interactions] = await Promise.all([
    readSource("src/db/rss-interaction-queries.ts"),
    readSource("src/lib/rss-interactions.ts"),
  ])

  assert.match(queries, /export async function lockRssTipSender/)
  assert.match(queries, /FROM "User"/)
  assert.match(queries, /WHERE "id" = \$\{senderId\}/)
  assert.match(queries, /FOR UPDATE/)
  assert.match(interactions, /await lockRssTipSender\(tx, input\.senderId\)/)
  const tipTransactionStart = interactions.indexOf("await lockRssTipSender(tx, input.senderId)")
  const usageCountRead = interactions.indexOf("countRssEntryTipsBySender", tipTransactionStart)
  const tipRecordCreate = interactions.indexOf("await tx.rssEntryTip.create", tipTransactionStart)
  const pointDebit = interactions.indexOf("await applyPointDelta", tipRecordCreate)

  assert.ok(
    tipTransactionStart < usageCountRead,
    "tip limits must be counted only after same-sender tip requests are serialized",
  )
  assert.ok(
    tipTransactionStart < tipRecordCreate,
    "the sender lock must cover creation of the RSS tip record",
  )
  assert.ok(
    tipRecordCreate < pointDebit,
    "the tip record and point debit must remain in one transaction so failed debits roll back the record",
  )
})

test("red-packet and jackpot claims retain conditional pool updates before granting points", async () => {
  const [queries, rewards] = await Promise.all([
    readSource("src/db/post-red-packet-queries.ts"),
    readSource("src/lib/post-red-packets.ts"),
  ])

  assert.match(queries, /tx\.postRedPacket\.updateMany\(/)
  assert.match(queries, /remainingCount: packet\.remainingCount/)
  assert.match(queries, /remainingPoints: packet\.remainingPoints/)
  assert.match(queries, /remainingPoints: expectedRemainingPoints/)
  assert.ok(
    queries.indexOf("const updatedPacket = await tx.postRedPacket.updateMany") < queries.indexOf("await tx.postRedPacketClaim.create"),
    "a normal red-packet claim must conditionally reserve pool funds before its claim row is created",
  )
  assert.ok(
    rewards.indexOf("const updatedPacket = await settleJackpotClaim") < rewards.indexOf("const rewardClaim = await createJackpotRewardClaim"),
    "a jackpot claim must conditionally reserve pool funds before its claim row is created",
  )
  assert.ok(
    rewards.indexOf("const rewardClaim = await createJackpotRewardClaim") < rewards.indexOf("await applyPointDelta"),
    "a jackpot reward credit must remain transactional with its unique claim row",
  )
})