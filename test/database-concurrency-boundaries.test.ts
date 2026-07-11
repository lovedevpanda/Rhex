import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  parseRssUniversePage,
  parseRssUniverseSourceIds,
} from "../src/app/api/rss-universe/route"
import { PublicRouteError } from "../src/lib/public-route-error"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("RSS universe query parsing caps deep pagination and rejects oversized source filters", () => {
  assert.equal(
    parseRssUniversePage(new Request("https://example.test/api/rss-universe?page=999999999")),
    10_000,
  )
  assert.equal(
    parseRssUniversePage(new Request("https://example.test/api/rss-universe?page=not-a-number")),
    1,
  )

  assert.deepEqual(
    parseRssUniverseSourceIds(new Request("https://example.test/api/rss-universe?sourceIds=one,%20two,one")),
    ["one", "two"],
  )

  const tooMany = Array.from({ length: 51 }, (_, index) => `source-${index}`).join(",")
  assert.throws(
    () => parseRssUniverseSourceIds(new Request(`https://example.test/api/rss-universe?sourceIds=${tooMany}`)),
    (error: unknown) => error instanceof PublicRouteError && error.statusCode === 400,
  )
})

test("poll votes use the unique constraint as the concurrent write authority", async () => {
  const source = await readSource("src/app/api/posts/vote/route.ts")

  assert.match(source, /tx\.pollVote\.createMany\(/)
  assert.match(source, /skipDuplicates:\s*true/)
  assert.match(source, /createdVote\.count === 0/)
  assert.ok(
    source.indexOf("createdVote.count === 0") < source.indexOf("tx.pollOption.update"),
    "the poll option count must change only after a vote row was inserted",
  )
})

test("bounty acceptance claims the post atomically before settlement", async () => {
  const source = await readSource("src/app/api/posts/accept-answer/route.ts")

  assert.match(source, /tx\.post\.updateMany\(/)
  assert.match(source, /acceptedCommentId:\s*null/)
  assert.match(source, /accepted\.count === 0/)
  assert.ok(
    source.indexOf("const accepted = await tx.post.updateMany") < source.indexOf("await tx.comment.update"),
    "the bounty claim must happen before marking a comment accepted",
  )
})

test("redeem code claiming is conditional and category limits are serialized", async () => {
  const source = await readSource("src/db/redeem-code-queries.ts")

  assert.match(source, /pg_advisory_xact_lock/)
  assert.match(source, /tx\.redeemCode\.updateMany\(/)
  assert.match(source, /redeemedById:\s*null/)
  assert.match(source, /expiresAt:\s*\{ gt: new Date\(\) \}/)
  assert.match(source, /claimed\.count !== 1/)
  assert.ok(
    source.indexOf("pg_advisory_xact_lock") < source.indexOf('SELECT COUNT(*)::int AS "count"'),
    "the same user/category must be locked before its redeemed-code count is read",
  )
})
