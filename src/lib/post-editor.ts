import { replacePostTaxonomy } from "@/db/post-taxonomy-queries"
import { extractSummaryFromContent } from "@/lib/content"
import { getAllPostContentText } from "@/lib/post-content"
export { normalizeManualTags } from "@/lib/post-tags"

export async function syncPostTaxonomy(postId: string, title: string, content: string, manualTags?: string[]) {
  const normalizedContent = getAllPostContentText(content)

  await replacePostTaxonomy(postId, extractSummaryFromContent(normalizedContent) || title, manualTags)
}
