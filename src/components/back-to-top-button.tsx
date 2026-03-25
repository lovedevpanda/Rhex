"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const VISIBILITY_SCROLL_OFFSET = 320

export function BackToTopButton() {
  const [visible, setVisible] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const viewportHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY
      const distanceToBottom = documentHeight - (scrollTop + viewportHeight)

      setVisible(scrollTop > VISIBILITY_SCROLL_OFFSET)
      setScrolledToBottom(distanceToBottom <= 24)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleScroll)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleScroll)
    }
  }, [])

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn(
        "group fixed bottom-5 right-4 z-[90] h-12 w-12 rounded-full border border-border/70 bg-background/75 text-foreground shadow-[0_16px_40px_-18px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300 supports-[backdrop-filter]:bg-background/55 hover:-translate-y-1 hover:border-primary/35 hover:bg-accent/80 hover:text-primary dark:border-border/60 dark:bg-background/65 dark:shadow-[0_18px_45px_-20px_rgba(0,0,0,0.7)] sm:bottom-8 sm:right-6",
        visible ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-3 scale-95 opacity-0",
        scrolledToBottom ? "ring-2 ring-primary/15" : "",
      )}
      onClick={handleBackToTop}
      aria-label="回到顶部"
      title="回到顶部"
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 via-white/5 to-transparent opacity-80 dark:from-white/10 dark:via-white/5 dark:to-transparent" />
      <ArrowUp className="relative h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
    </Button>
  )
}

