import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("lottery draw claims the active state before freezing participants or issuing prizes", async () => {
  const [queries, lottery] = await Promise.all([
    readSource("src/db/lottery-queries.ts"),
    readSource("src/lib/lottery.ts"),
  ])

  assert.match(queries, /export class LotteryDrawClaimConflictError extends Error/)
  assert.match(queries, /const claimed = await tx\.post\.updateMany\(/)
  assert.match(queries, /lotteryStatus: LotteryStatus\.ACTIVE/)
  assert.match(queries, /lotteryLockedAt: null/)
  assert.match(queries, /lotteryDrawnAt: null/)
  assert.match(queries, /if \(claimed\.count !== 1\)[\s\S]*?throw new LotteryDrawClaimConflictError\(\)/)
  assert.match(queries, /const post = await findLotteryDrawContext\(input\.postId, tx\)/)
  assert.doesNotMatch(queries, /lotteryWinner\.deleteMany\(\{\s*where: \{ postId: post\.id \}/)

  const drawTransaction = queries.slice(queries.indexOf("export async function executeLotteryDrawTransaction"))
  assert.ok(
    drawTransaction.indexOf("claimed.count !== 1") < drawTransaction.indexOf("await tx.lotteryParticipant.updateMany"),
    "a losing draw request must stop before the participant snapshot is frozen",
  )
  assert.ok(
    drawTransaction.indexOf("claimed.count !== 1") < drawTransaction.indexOf("await tx.lotteryWinner.createMany"),
    "a losing draw request must stop before winner records or automatic prizes are issued",
  )
  assert.match(queries, /WHERE "id" = \$\{input\.postId\}[\s\S]*?"lotteryStatus" = 'ACTIVE'::"LotteryStatus"[\s\S]*?"lotteryLockedAt" IS NULL[\s\S]*?"lotteryDrawnAt" IS NULL[\s\S]*?FOR UPDATE/)
  assert.match(lottery, /if \(!participant\) \{\s*return \{ joined: false/)
  assert.match(lottery, /if \(post\.lotteryStatus !== LotteryStatus\.ACTIVE \|\| post\.lotteryLockedAt \|\| post\.lotteryDrawnAt\)/)
  assert.match(lottery, /buildDraw: \(lockedPost\) => \{\s*assertLotteryDrawTriggerSatisfied\(lockedPost\)/)
})

test("god-comment promotions and demotions serialize on the post and only change counters after conditional state changes", async () => {
  const [queries, comments] = await Promise.all([
    readSource("src/db/post-god-comment-queries.ts"),
    readSource("src/lib/god-comments.ts"),
  ])

  assert.match(queries, /export async function lockGodCommentPost/)
  assert.match(queries, /FROM "Post"[\s\S]*?WHERE "id" = \$\{postId\}[\s\S]*?FOR UPDATE/)
  assert.match(comments, /const lockedPost = await lockGodCommentPost\(tx, initial\.postId\)/)
  assert.match(comments, /export async function promoteGodComment[\s\S]*?lockAndFindGodCommentActionComment\(tx, input\.commentId\)/)
  assert.match(comments, /export async function demoteGodComment[\s\S]*?lockAndFindGodCommentActionComment\(tx, input\.commentId\)/)
  assert.match(comments, /const marked = await tx\.comment\.updateMany\(/)
  assert.match(comments, /if \(marked\.count !== 1\)/)
  assert.match(comments, /const unmarked = await tx\.comment\.updateMany\(/)
  assert.match(comments, /if \(unmarked\.count !== 1\)/)

  const promotion = comments.slice(comments.indexOf("export async function promoteGodComment"), comments.indexOf("export async function demoteGodComment"))
  const demotion = comments.slice(comments.indexOf("export async function demoteGodComment"))
  assert.ok(
    promotion.indexOf("const marked = await tx.comment.updateMany") < promotion.indexOf("await tx.user.update"),
    "the promotion counter changes only after the conditional mark succeeds",
  )
  assert.ok(
    demotion.indexOf("const unmarked = await tx.comment.updateMany") < demotion.indexOf("await tx.$executeRaw"),
    "the demotion counter changes only after the conditional unmark succeeds",
  )
})

test("post block purchases lock and validate the current post before consuming the unique purchase boundary", async () => {
  const [queries, unlock, route] = await Promise.all([
    readSource("src/db/post-unlock-queries.ts"),
    readSource("src/lib/post-unlock.ts"),
    readSource("src/app/api/posts/purchase/route.ts"),
  ])

  assert.match(queries, /export async function findPostUnlockPurchaseContext/)
  assert.match(queries, /FROM "Post"[\s\S]*?WHERE "id" = \$\{postId\}[\s\S]*?FOR UPDATE/)
  assert.match(queries, /ON CONFLICT \("postId", "blockId", "buyerId"\) DO NOTHING/)
  assert.match(unlock, /const post = await findPostUnlockPurchaseContext\(options\.postId, tx\)/)
  assert.match(unlock, /parsePostContentDocument\(post\.content\)/)
  assert.match(unlock, /const price = targetBlock\.price\s*\n\s*const sellerId = post\.authorId/)

  const purchaseIndex = unlock.indexOf("const purchaseRecord = await createPostBlockPurchase")
  const firstPointDeltaIndex = unlock.indexOf("await applyPointDelta")
  assert.ok(purchaseIndex < firstPointDeltaIndex, "only the request that inserts the unique purchase record may debit points")

  const routeCall = route.match(/purchasePostBlock\(\{([\s\S]*?)\}\)/)
  assert.ok(routeCall, "the route must call the server-side purchase service")
  assert.doesNotMatch(routeCall[1], /\b(price|sellerId)\b/)
})