export function getPostPath(post: { slug: string }) {
  return `/posts/${post.slug}`
}

