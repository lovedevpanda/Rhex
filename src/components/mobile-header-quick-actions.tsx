"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, PenSquare } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

interface MobileHeaderQuickActionsProps {
  isLoggedIn: boolean
  checkInEnabled: boolean
  checkedInToday: boolean
}

export function MobileHeaderQuickActions({ isLoggedIn, checkInEnabled, checkedInToday: initialCheckedInToday }: MobileHeaderQuickActionsProps) {
  const router = useRouter()
  const [checkedInToday, setCheckedInToday] = useState(initialCheckedInToday)
  const [loading, setLoading] = useState(false)

  async function handleCheckIn() {
    if (!isLoggedIn) {
      router.push("/login")
      return
    }

    if (!checkInEnabled || checkedInToday || loading) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-in" }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message ?? "签到失败", "签到失败")
        return
      }

      setCheckedInToday(true)
      toast.success(result.message ?? "签到成功", "签到成功")
      router.refresh()
    } catch {
      toast.error("签到失败，请稍后再试", "签到失败")
    } finally {
      setLoading(false)
    }
  }

  const checkInLabel = !isLoggedIn ? "签到" : checkedInToday ? "已签" : loading ? "签到中" : "签到"

  return (
    <div className="flex items-center gap-1 sm:hidden">
      <Link href={isLoggedIn ? "/write" : "/login"}>
        <Button variant="ghost" className="h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium">
          <PenSquare className="h-3.5 w-3.5" />
          <span>发帖</span>
        </Button>
      </Link>

      <Button
        type="button"
        variant="ghost"
        className="h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium"
        onClick={handleCheckIn}
        disabled={(isLoggedIn && (!checkInEnabled || checkedInToday)) || loading}
        aria-label={checkInEnabled ? "签到" : "签到功能未开启"}
        title={checkInEnabled ? "签到" : "签到功能未开启"}
      >
        <CheckCircle2 className={checkedInToday ? "h-3.5 w-3.5 text-emerald-600" : "h-3.5 w-3.5"} />
        <span>{checkInLabel}</span>
      </Button>
    </div>
  )
}
