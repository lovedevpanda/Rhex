import { findPostSidebarData } from "@/db/post-sidebar-queries"

export async function getPostSidebarData(postId: string, authorUsername: string) {
  const { author, postTags, relatedPosts } = await findPostSidebarData(postId, authorUsername)

  return {
    author: author
      ? {
          bio: author.bio,
        }
      : {
          bio: null,
        },
    relatedTopics: relatedPosts,
    tags: postTags.map((item) => ({
      id: item.tag.id,
      name: item.tag.name,
      slug: item.tag.slug,
    })),
  }
}
