import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("post tips serialize a sender before quota reads and keep the record plus debit transactional", async () => {
  const [queries, tips] = await Promise.all([
    readSource("src/db/post-tip-queries.ts"),
    readSource("src/lib/post-tips.ts"),
  ])

  assert.match(queries, /export async function lockPostTipSender/)
  assert.match(queries, /FROM "User"/)
  assert.match(queries, /WHERE "id" = \$\{senderId\}/)
  assert.match(queries, /FOR UPDATE/)

  const lock = tips.indexOf("await lockPostTipSender(tx, params.senderId)")
  const usageCounts = tips.indexOf("const usageCounts = await getSupportUsageCounts", lock)
  const persist = tips.indexOf("await params.onPersist({", usageCounts)
  const debit = tips.indexOf("await applyPointDelta({", persist)

  assert.ok(lock >= 0, "the sender must be locked inside the write transaction")
  assert.ok(lock < usageCounts, "quota counts must be read only after the sender lock")
  assert.ok(usageCounts < persist, "the limit must be checked before the tip/gift event is persisted")
  assert.ok(persist < debit, "the persisted event and point debit must share one transaction")
})

test("comment tips bind the supplied post and comment IDs before any settlement", async () => {
  const tips = await readSource("src/lib/post-tips.ts")

  const ownershipCheck = tips.indexOf("target.post.id !== params.postId")
  const contextValidation = tips.indexOf("validateSupportContext({", ownershipCheck)
  const persistence = tips.indexOf("await params.onPersist({", contextValidation)

  assert.ok(ownershipCheck >= 0, "comment tips must reject a comment from another post")
  assert.ok(ownershipCheck < contextValidation, "post/comment ownership must be checked before the target is accepted")
  assert.ok(contextValidation < persistence, "mismatched IDs must fail before a tip record can be created")
})

test("tip and auction mutation routes derive the actor from the authenticated session and use replay guards", async () => {
  const [postTipRoute, commentTipRoute, auctionBidRoute] = await Promise.all([
    readSource("src/app/api/posts/tip/route.ts"),
    readSource("src/app/api/comments/tip/route.ts"),
    readSource("src/app/api/posts/auction/bid/route.ts"),
  ])

  for (const source of [postTipRoute, commentTipRoute, auctionBidRoute]) {
    assert.match(source, /createUserRouteHandler/)
    assert.match(source, /withRequestWriteGuard\(createRequestWriteGuardOptions\(/)
    assert.match(source, /userId: currentUser\.id/)
  }

  assert.match(postTipRoute, /senderId: currentUser\.id/)
  assert.match(commentTipRoute, /senderId: currentUser\.id/)
  assert.match(auctionBidRoute, /userId: currentUser\.id/)
  assert.match(auctionBidRoute, /Number\.isSafeInteger\(amount\) \|\| amount <= 0/)
})

test("auction bidding and settlement lock one auction before state reads or money movement", async () => {
  const [core, bidding, settlement] = await Promise.all([
    readSource("src/lib/post-auctions.core.ts"),
    readSource("src/lib/post-auctions.bidding.ts"),
    readSource("src/lib/post-auctions.settlement.ts"),
  ])

  const lockByPost = core.indexOf("async function lockPostAuctionByPostId")
  const rowLock = core.indexOf("FOR UPDATE", lockByPost)
  const callback = core.indexOf("return callback(tx)", rowLock)
  assert.ok(lockByPost >= 0 && rowLock > lockByPost && callback > rowLock,
    "the serializable auction transaction must acquire its row lock before running bid/settlement logic")
  assert.match(core, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/)

  const bidTransaction = bidding.indexOf("return runSerializablePostAuctionTransaction(async (tx) => {")
  const auctionRead = bidding.indexOf("tx.postAuction.findUnique", bidTransaction)
  const activeCheck = bidding.indexOf("if (auction.status !== PostAuctionStatus.ACTIVE)", auctionRead)
  const bidRecord = bidding.indexOf("await tx.postAuctionBidRecord.create", activeCheck)
  assert.ok(bidTransaction >= 0 && auctionRead > bidTransaction && activeCheck > auctionRead && bidRecord > activeCheck,
    "a bid must run under the auction lock, reject non-ACTIVE state, then persist its bid record")
  assert.match(bidding, /\}, \{ postId: input\.postId \}\)/)

  const settlementTransaction = settlement.indexOf("return runSerializablePostAuctionTransaction(async (tx) => {")
  const settlingTransition = settlement.indexOf("status: PostAuctionStatus.SETTLING", settlementTransaction)
  const batchProcess = settlement.indexOf("async function processPostAuctionSettlementBatch", settlingTransition)
  const finalized = settlement.indexOf("status: PostAuctionStatus.SETTLED", batchProcess)
  assert.ok(settlementTransaction >= 0 && settlingTransition > settlementTransaction && batchProcess > settlingTransition && finalized > batchProcess,
    "settlement must transition through SETTLING before refunds/credits and only then mark SETTLED")
})