"use client"

import { useState } from "react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import type { AdminPostListItem } from "@/lib/admin-post-management"

interface AdminPostPreviewModalProps {
  post: AdminPostListItem
}

export function AdminPostPreviewModal({ post }: AdminPostPreviewModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        预览
      </Button>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={post.title}
        description={`${post.boardName} · ${post.authorName} · ${post.createdAt}`}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Info label="类型" value={post.typeLabel} />
          <Info label="状态" value={post.statusLabel} />
          <Info label="评论数" value={String(post.commentCount)} />
          <Info label="点赞数" value={String(post.likeCount)} />
          <Info label="收藏数" value={String(post.favoriteCount)} />
          <Info label="浏览数" value={String(post.viewCount)} />
          <Info label="打赏次数" value={String(post.tipCount)} />
          <Info label="热度分" value={String(Math.round(post.score))} />
        </div>
        {post.summary ? (
          <div className="mt-4 rounded-[18px] border border-border p-4">
            <p className="text-xs text-muted-foreground">摘要</p>
            <p className="mt-2 text-sm font-medium leading-7">{post.summary}</p>
          </div>
        ) : null}
        {post.reviewNote ? (
          <div className="mt-4 rounded-[18px] border border-border p-4">
            <p className="text-xs text-muted-foreground">审核备注</p>
            <p className="mt-2 text-sm font-medium">{post.reviewNote}</p>
          </div>
        ) : null}
      </AdminModal>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}
