"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"


interface PurchaseUnlockButtonProps {
  postId: string
  blockId: string
  price: number
  pointName: string
}

export function PurchaseUnlockButton({ postId, blockId, price, pointName }: PurchaseUnlockButtonProps) {
  const [loading, setLoading] = useState(false)


  async function handlePurchase() {
    setLoading(true)

    const response = await fetch("/api/posts/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postId, blockId }),
    })
    const result = await response.json()
    setLoading(false)

    if (!response.ok) {
      toast.error(result.message ?? "购买失败", "购买失败")
      return
    }

    toast.success(result.message ?? "购买成功", "购买成功")
    window.location.reload()
  }


  return (
    <div className="space-y-3">
      <Button type="button" onClick={handlePurchase} disabled={loading}>
        {loading ? "购买中..." : `使用 ${price} ${pointName} 解锁`}
      </Button>
    </div>

  )
}
