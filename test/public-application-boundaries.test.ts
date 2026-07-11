import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8")
}

test("report submission serializes the durable duplicate check and creation", async () => {
  const [service, queries] = await Promise.all([
    readSource("src/lib/reports.ts"),
    readSource("src/db/report-queries.ts"),
  ])

  assert.match(queries, /export function lockReportSubmission/)
  assert.match(queries, /pg_advisory_xact_lock/)
  assert.match(queries, /reporterId:\s*number, targetType: TargetType, targetId: string/)
  assert.match(queries, /author: \{ select: \{ id: true, username: true, nickname: true \} \}/)
  assert.match(service, /ownerUserId: post\.author\.id/)
  assert.match(service, /normalizedReasonDetail\.length > 4_000/)
  assert.match(service, /hookedReasonDetail\.length > 4_000/)
  assert.match(service, /Invalid user report target/)

  const transactionIndex = service.indexOf("await prisma.$transaction")
  const lockIndex = service.indexOf("await lockReportSubmission(tx", transactionIndex)
  const duplicateIndex = service.indexOf("await findDuplicatedPendingReport(", lockIndex)
  const createIndex = service.indexOf("return createReportRecord({", duplicateIndex)

  assert.ok(transactionIndex >= 0 && transactionIndex < lockIndex, "the report lock must be acquired in the write transaction")
  assert.ok(lockIndex < duplicateIndex && duplicateIndex < createIndex, "duplicate detection must run after locking and before creation")
  assert.match(service, /client:\s*tx/)
})

test("verification applications bound input and serialize user verification state", async () => {
  const [service, queries, unbindRoute] = await Promise.all([
    readSource("src/lib/verifications.ts"),
    readSource("src/db/verification-queries.ts"),
    readSource("src/app/api/verifications/unbind/route.ts"),
  ])

  assert.match(queries, /export async function lockUserVerificationState/)
  assert.match(queries, /FROM "User"/)
  assert.match(queries, /FOR UPDATE/)
  assert.match(service, /const verificationTypeId = input\.verificationTypeId\.trim\(\)/)
  assert.match(service, /verificationTypeId\.length > 100/)
  assert.match(service, /VERIFICATION_CONTENT_MAX_LENGTH = 4_000/)
  assert.match(service, /VERIFICATION_FORM_VALUE_MAX_LENGTH = 1_000/)
  assert.match(service, /VERIFICATION_CUSTOM_DESCRIPTION_MAX_LENGTH = 600/)
  assert.match(service, /if \(!allowedFieldIds\.has\(key\)\)/)
  assert.match(service, /if \(text\.length > VERIFICATION_FORM_VALUE_MAX_LENGTH\)/)

  const transactionIndex = service.indexOf("await prisma.$transaction", service.indexOf("export async function submitVerificationApplication"))
  const lockIndex = service.indexOf("await lockUserVerificationState(tx, input.userId)", transactionIndex)
  const pendingCheckIndex = service.indexOf('latestApplicationInTx?.status === "PENDING"', lockIndex)
  const createIndex = service.indexOf("await createUserVerificationApplication({", pendingCheckIndex)

  assert.ok(transactionIndex >= 0 && transactionIndex < lockIndex, "verification writes must lock the user row")
  assert.ok(lockIndex < pendingCheckIndex && pendingCheckIndex < createIndex, "locked state must reject pending applications before creation")
  assert.match(service, /tx\.userVerification\.updateMany\([\s\S]*?status: "APPROVED"/)
  assert.match(unbindRoute, /withRequestWriteGuard\([\s\S]*?scope: "verifications-unbind"/)
})

test("friend link applications validate public destinations and atomically deduplicate", async () => {
  const [service, queries, route, autoReview] = await Promise.all([
    readSource("src/lib/friend-links.ts"),
    readSource("src/db/friend-links.ts"),
    readSource("src/app/api/friend-links/apply/route.ts"),
    readSource("src/lib/friend-link-auto-review.ts"),
  ])

  assert.match(service, /await resolveSafeOutboundTarget\(url\)/)
  assert.match(service, /Website URL and placement page must use the same host/)
  assert.match(service, /parsed\.username \|\| parsed\.password/)
  assert.match(queries, /createFriendLinkIfAbsent/)
  assert.match(queries, /pg_advisory_xact_lock/)
  assert.match(queries, /mode: "insensitive"/)
  assert.match(route, /identity: \{ ip: getRequestIp\(request\) \}/)
  assert.match(route, /dedupeWindowMs: 60_000/)
  assert.match(autoReview, /safeOutboundFetch\(currentUrl/)
  assert.match(autoReview, /FRIEND_LINK_VERIFY_MAX_RESPONSE_BYTES/)
})

test("favorite collection mutations serialize collection policy and only count inserted rows", async () => {
  const [service, route] = await Promise.all([
    readSource("src/lib/favorite-collections.ts"),
    readSource("src/app/api/favorite-collections/route.ts"),
  ])

  assert.match(service, /async function lockFavoriteCollection/)
  assert.match(service, /FROM "favorite_collection"/)
  assert.match(service, /FOR UPDATE/)
  assert.match(service, /tx\.favoriteCollectionItem\.createMany\([\s\S]*?skipDuplicates:\s*true/)
  assert.match(service, /created\.count !== 1[\s\S]*?This post is already in the collection/)
  assert.match(service, /tx\.favorite\.createMany\([\s\S]*?skipDuplicates:\s*true/)

  const lockIndex = service.indexOf("await lockFavoriteCollection(tx, params.collectionId)", service.indexOf("export async function addPostToFavoriteCollection"))
  const policyIndex = service.indexOf("canContributeToCollection(collection, params.userId)", lockIndex)
  const favoriteIndex = service.indexOf("await ensureUserFavoriteInTransaction", policyIndex)
  assert.ok(lockIndex >= 0 && lockIndex < policyIndex && policyIndex < favoriteIndex, "contribution policy must be checked under the collection lock")

  const claimIndex = service.indexOf("const claimed = await tx.favoriteCollectionSubmission.updateMany")
  const itemIndex = service.indexOf("await createCollectionItemInTransaction(tx", claimIndex)
  assert.ok(claimIndex >= 0 && claimIndex < itemIndex, "a submission must be conditionally claimed before approval creates an item")
  assert.match(route, /withRequestWriteGuard\([\s\S]*?scope: "favorite-collections"/)
  assert.match(route, /body\.decision === "APPROVE" \|\| body\.decision === "REJECT"/)
})

test("public follow, RSS application, and payment application routes bind writes to the current actor", async () => {
  const [boardRoute, rssRoute, paymentRoute] = await Promise.all([
    readSource("src/app/api/boards/follow/route.ts"),
    readSource("src/app/api/rss-universe/apply/route.ts"),
    readSource("src/app/api/payment/applications/route.ts"),
  ])

  assert.match(boardRoute, /createUserRouteHandler/)
  assert.match(boardRoute, /userId: currentUser\.id/)
  assert.match(boardRoute, /targetType: "board"/)
  assert.match(boardRoute, /withRequestWriteGuard\(createRequestWriteGuardOptions\("boards-follow-toggle"/)

  assert.match(rssRoute, /createUserRouteHandler/)
  assert.match(rssRoute, /applicantId: currentUser\.id/)
  assert.match(rssRoute, /withRequestWriteGuard\(createRequestWriteGuardOptions\("rss-source-application-create"/)

  assert.match(paymentRoute, /withRequestWriteGuard\([\s\S]*?userId: currentUser\.id/)
  assert.match(paymentRoute, /scope: "payment-applications"/)
  assert.match(paymentRoute, /ownerId: currentUser\.id/)
  assert.match(paymentRoute, /Unsupported Payment application action/)
})
