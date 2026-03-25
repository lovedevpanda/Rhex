interface PostAuthorInlineCardProps {
  author: {
    bio?: string | null
  }
}

export function PostAuthorInlineCard({ author }: PostAuthorInlineCardProps) {
  return <p className="line-clamp-1 text-sm text-muted-foreground">{author.bio?.trim() || "这个楼主还没有留下简介。"}</p>
}
