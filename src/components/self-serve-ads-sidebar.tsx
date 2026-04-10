"use client"

import Image from "next/image"
import Link from "next/link"

import type { SelfServeAdItem } from "@/lib/self-serve-ads.shared"


type SelfServeAdsSidebarPanelData = {
  title: string
  pointName: string
  placeholderLabel: string
  imageSlots: SelfServeAdItem[]
  textSlots: SelfServeAdItem[]
  prices: {
    IMAGE: Record<1 | 3 | 6 | 12, number>
    TEXT: Record<1 | 3 | 6 | 12, number>
  }
}

interface SelfServeAdsSidebarProps {
  AppId: string
  config: Record<string, boolean | number | string>
  panelData: unknown
}

function isSidebarPanelData(value: unknown): value is SelfServeAdsSidebarPanelData {
  if (!value || typeof value !== "object") return false
  const payload = value as Record<string, unknown>
  return typeof payload.title === "string"
    && typeof payload.pointName === "string"
    && typeof payload.placeholderLabel === "string"
    && Array.isArray(payload.imageSlots)
    && Array.isArray(payload.textSlots)
    && !!payload.prices
}

function buildPurchaseHref(slotType: "IMAGE" | "TEXT", slotIndex: number) {
  return `/funs/self-serve-ads/purchase?slotType=${slotType}&slotIndex=${slotIndex}`
}

export function SelfServeAdsSidebar({ panelData }: SelfServeAdsSidebarProps) {
  const resolvedPanelData = isSidebarPanelData(panelData) ? panelData : null
  if (!resolvedPanelData) return null

  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg  className="h-5 w-5 text-orange-500 dark:text-orange-400" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4848" width="200" height="200"><path d="M947.2 947.2H76.8C34.304 947.2 0 912.896 0 870.4v-512c0-42.496 34.304-76.8 76.8-76.8h870.4c42.496 0 76.8 34.304 76.8 76.8v512c0 42.496-34.304 76.8-76.8 76.8zM76.8 332.8c-14.336 0-25.6 11.264-25.6 25.6v512c0 14.336 11.264 25.6 25.6 25.6h870.4c14.336 0 25.6-11.264 25.6-25.6v-512c0-14.336-11.264-25.6-25.6-25.6H76.8z" fill="#8A8A8A" p-id="4849"></path><path d="M384 332.8H230.4V122.88c0-14.336 11.264-25.6 25.6-25.6s25.6 11.264 25.6 25.6V281.6h51.2V122.88c0-14.336 11.264-25.6 25.6-25.6s25.6 11.264 25.6 25.6V332.8z m409.6 0H640V122.88c0-14.336 11.264-25.6 25.6-25.6s25.6 11.264 25.6 25.6V281.6h51.2V122.88c0-14.336 11.264-25.6 25.6-25.6s25.6 11.264 25.6 25.6V332.8zM489.984 777.728h-80.896l-26.112-79.872H256.512l-25.6 79.872h-80.896l127.488-348.672h87.552l124.928 348.672zM365.568 640.512L326.144 519.68c-2.56-7.68-4.608-17.92-5.632-30.208h-2.048c-1.024 10.24-3.072 19.968-6.144 29.696l-39.936 121.856h93.184z m194.048 137.216v-348.16h120.32c123.904 0 185.856 56.832 185.856 169.984 0 53.76-17.408 97.28-52.224 129.536-34.816 32.768-79.36 49.152-134.144 49.152H559.616z m74.24-287.744V716.8h40.448c35.328 0 62.976-10.752 82.944-31.744 19.968-20.992 30.208-49.664 30.208-85.504 0-34.816-10.752-61.44-31.744-80.896-20.992-19.456-48.128-29.184-81.92-29.184h-39.936z" fill="#8A8A8A" p-id="4850"></path></svg>
          <h3 className="font-semibold">{resolvedPanelData.title}</h3>
        </div>
        <Link href="/funs/self-serve-ads" className="shrink-0 text-[11px] text-muted-foreground transition hover:text-foreground">说明</Link>
      </div>

      <div className="space-y-2">
        {resolvedPanelData.imageSlots.map((item) => item.isPlaceholder ? (
          <Link key={item.id} href={buildPurchaseHref("IMAGE", item.slotIndex)} className="flex h-[52px] w-full items-center justify-center rounded-[16px] border border-dashed border-border bg-background text-xs font-medium text-muted-foreground transition hover:border-foreground/20 hover:text-foreground">
            购买图片广告位
          </Link>
        ) : (
          <a key={item.id} href={item.linkUrl ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[16px] border border-border bg-background transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5">
            <div className="h-[58px] w-full bg-muted/20">
              {item.imageUrl ? <Image src={item.imageUrl} alt={`图片广告位 ${item.slotIndex + 1}`} width={320} height={58} unoptimized className="h-[58px] w-full object-cover" /> : null}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {resolvedPanelData.textSlots.map((item) => item.isPlaceholder ? (
          <Link key={item.id} href={buildPurchaseHref("TEXT", item.slotIndex)} className="flex py-2 items-center justify-center rounded-[12px] border border-dashed border-border bg-background px-3 text-[11px] text-muted-foreground transition hover:border-foreground/20 hover:text-foreground">
            购买广告位
          </Link>
        ) : (
          <a key={item.id} href={item.linkUrl ?? "#"} target="_blank" rel="noreferrer" className="truncate rounded-[12px] px-3 py-2 text-center text-[11px] font-medium transition hover:opacity-90" style={{ color: item.textColor ?? "#0f172a", backgroundColor: item.backgroundColor ?? "#f8fafc" }}>
            {item.title}
          </a>
        ))}
      </div>
    </section>
  )
}
