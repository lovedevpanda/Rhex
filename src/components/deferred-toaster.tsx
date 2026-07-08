"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { toast } from "@/components/ui/toast"

type ToasterComponent = typeof import("@/components/ui/sonner")["Toaster"]

export function DeferredToaster() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const [Toaster, setToaster] = useState<ToasterComponent | null>(null)

  useEffect(() => {
    let cancelled = false

    void import("@/components/ui/sonner").then((module) => {
      if (!cancelled) {
        setToaster(() => module.Toaster)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!Toaster) {
      return
    }

    if (searchParams.get("rhexToast") !== "register-success") {
      return
    }

    toast.success("恭喜您已经注册成为本站会员！", "注册成功")

    const nextSearchParams = new URLSearchParams(search)
    nextSearchParams.delete("rhexToast")
    const nextSearch = nextSearchParams.toString()
    const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
    router.replace(nextUrl, { scroll: false })
  }, [Toaster, pathname, router, search, searchParams])

  return Toaster ? <Toaster richColors position="top-right" /> : null
}
