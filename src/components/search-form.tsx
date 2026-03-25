"use client"

import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

export function SearchForm({ defaultValue = "", compact = false }: { defaultValue?: string; compact?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [keyword, setKeyword] = useState(defaultValue)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextKeyword = keyword.trim()
    const params = new URLSearchParams(searchParams.toString())

    if (!nextKeyword) {
      params.delete("q")
      params.delete("page")
      router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`)
      return
    }

    params.set("q", nextKeyword)
    params.set("page", "1")
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "w-full" : "w-full max-w-2xl"}>
      <div className={compact ? "relative" : "flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 shadow-sm transition-shadow focus-within:shadow-soft"}>
        {compact ? (
          <>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="h-9 w-full rounded-full border border-border bg-muted/50 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="搜索节点、帖子、用户..."
              maxLength={50}
              type="search"
            />
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="搜索节点、帖子、作者"
              maxLength={50}
            />
            <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90">
              搜索
            </button>
          </>
        )}
      </div>
    </form>
  )
}
