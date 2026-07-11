import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("gobang serializes paid match creation and move settlement", async () => {
  const [library, route] = await Promise.all([
    readSource("src/lib/gobang.ts"),
    readSource("src/app/api/gobang/route.ts"),
  ])

  assert.match(library, /const policy = await runGobangTransaction\(async \(tx\) =>/)
  assert.match(library, /pg_advisory_xact_lock\(hashtext\(\$\{key\}\)\)/)
  assert.match(library, /gobang:user:\$\{user\.id\}/)
  assert.match(library, /gobang:match:\$\{input\.matchId\}/)
  assert.match(library, /!Number\.isInteger\(input\.x\) \|\| !Number\.isInteger\(input\.y\)/)
  assert.match(library, /where: \{ id: input\.matchId, status: "ONGOING" \}/)
  assert.match(library, /amount: match\.ticketCost \+ match\.winReward/)
  assert.ok(
    library.indexOf("if (board.flat().every((cell) => cell !== 0))") < library.indexOf("const aiMove = chooseAiMove"),
    "a full board must settle before an AI move is selected",
  )
  assert.match(route, /scope: "gobang-create"/)
  assert.match(route, /scope: "gobang-move"/)
})

test("yin yang settlement returns transaction data and validates option literals", async () => {
  const [library, route] = await Promise.all([
    readSource("src/lib/yinyang-contract.ts"),
    readSource("src/app/api/yinyang-contract/route.ts"),
  ])

  assert.match(library, /const settlement = await runYinYangTransaction\(async \(tx\) =>/)
  assert.match(library, /return \{ challenge, isCorrect \}/)
  assert.match(library, /settlement\.challenge\.question/)
  assert.doesNotMatch(library, /settledChallenge/)
  assert.match(library, /yinYangChallengeDailyStat\.upsert/)
  assert.match(library, /yinyang:challenge:\$\{input\.challengeId\}/)
  assert.match(route, /function requireYinYangOption\(value: string, invalidMessage: string\): YinYangOption/)
  assert.match(route, /correctOption: requireYinYangOption\(correctOption/)
  assert.match(route, /selectedOption: requireYinYangOption\(selectedOption/)
})

test("paid action routes keep duplicate-submission guards and readable Chinese copy", async () => {
  const [vip, ads, gobang, yinYang, selfServeAds] = await Promise.all([
    readSource("src/app/api/vip/route.ts"),
    readSource("src/app/api/self-serve-ads/route.ts"),
    readSource("src/app/api/gobang/route.ts"),
    readSource("src/app/api/yinyang-contract/route.ts"),
    readSource("src/lib/self-serve-ads.ts"),
  ])

  assert.match(vip, /pg_advisory_xact_lock/)
  assert.match(vip, /const purchase = await prisma\.\$transaction\(async \(tx\) =>/)
  assert.match(ads, /scope: "self-serve-ads-submit"/)
  assert.match(ads, /dedupeKey: JSON\.stringify\(draft\)/)
  assert.match(selfServeAds, /self-serve-ads:slot:\$\{existing\.appCode\}:\$\{existing\.slotType\}:\$\{slotIndex\}/)
  assert.match(selfServeAds, /latest\.status !== "PENDING"/)
  assert.match(selfServeAds, /status: "APPROVED"/)
  assert.match(yinYang, /scope: "yinyang-contract-create"/)
  assert.match(yinYang, /scope: "yinyang-contract-accept"/)

  for (const source of [vip, ads, gobang, yinYang, selfServeAds]) {
    assert.doesNotMatch(source, /\?\?\?\?/, "user-facing copy must not be corrupted")
  }
})
