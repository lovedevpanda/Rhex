"use client"

import { Sparkles } from "lucide-react"

import Link from "next/link"
import { useMemo, useState } from "react"


import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { getPostRedPacketClaimOrderModeLabel, getPostRedPacketGrantModeLabel, type PostRedPacketSummary } from "@/lib/post-red-packets"


interface PostRedPacketPanelProps {
  pointName: string
  summary: PostRedPacketSummary
}


export function PostRedPacketPanel({ pointName, summary }: PostRedPacketPanelProps) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(summary.records.length / pageSize))
  const kingRecordId = useMemo(() => {
    if (summary.grantMode !== "RANDOM" || summary.records.length === 0) {
      return null
    }

    return summary.records.reduce((best, current) => (current.amount > best.amount ? current : best)).id
  }, [summary.grantMode, summary.records])

  const orderedRecords = useMemo(() => {
    if (!kingRecordId) {
      return summary.records
    }

    const kingRecord = summary.records.find((item) => item.id === kingRecordId)
    const otherRecords = summary.records.filter((item) => item.id !== kingRecordId)
    return kingRecord ? [kingRecord, ...otherRecords] : summary.records
  }, [kingRecordId, summary.records])
  const pagedRecords = useMemo(() => {
    const start = (page - 1) * pageSize
    return orderedRecords.slice(start, start + pageSize)
  }, [orderedRecords, page, pageSize])


  return (

    <div className="relative">
      <button
        type="button"
        title="帖子红包"
        aria-label="帖子红包"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => setOpen((current) => !current)}
      >

        <svg   className="h-4 w-4" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7811" width="200" height="200"><path d="M154.999317 115.043826m170.266862 0l380.164372 0q170.266862 0 170.266862 170.266862l0 457.126794q0 170.266862-170.266862 170.266862l-380.164372 0q-170.266862 0-170.266862-170.266862l0-457.126794q0-170.266862 170.266862-170.266862Z" fill="#F55651" p-id="7812"></path><path d="M207.173841 437.98614v269.218545c0 58.721327-1.749146 132.685212 72.114788 199.052806-56.272523-21.689409-124.289312-67.766911-124.289312-153.82489V398.405466z" fill="#F67969" p-id="7813"></path><path d="M325.266179 912.754319h380.164372a170.316837 170.316837 0 0 0 170.266862-170.316837V388.410347L821.873694 434.787701v282.012299c0 39.530698-16.591898 144.279551-114.943875 144.279551H335.761054c-84.208882 0-168.217862-58.171596-180.761737-123.839531v4.997559a170.266862 170.266862 0 0 0 170.266862 170.51674z" fill="#E3413F" p-id="7814"></path><path d="M154.999317 285.360664v129.686676c31.134797 33.183797 87.607223 74.163787 176.41386 74.163787 33.533626 100.800781 110.546022 133.035041 188.058175 133.035042 79.960957 0 158.872426-75.61308 169.417277-134.934114a256.724646 256.724646 0 0 0 186.808784-74.963397V285.360664a169.517228 169.517228 0 0 0-44.628209-114.943875l-664.675451 53.373938a169.917033 169.917033 0 0 0-11.394436 61.569937z" fill="#E3413F" p-id="7815"></path><path d="M705.430551 922.749439H325.266179a180.511859 180.511859 0 0 1-180.261982-180.311957V285.360664A180.511859 180.511859 0 0 1 325.266179 104.948755h380.164372a180.511859 180.511859 0 0 1 180.261982 180.411909v457.076818a180.511859 180.511859 0 0 1-180.261982 180.311957zM325.266179 124.938995a160.471645 160.471645 0 0 0-160.271743 160.421669v457.076818a160.471645 160.471645 0 0 0 160.271743 160.321718h380.164372a160.471645 160.471645 0 0 0 160.271743-160.321718V285.360664A160.471645 160.471645 0 0 0 705.430551 124.938995z" fill="#4B2254" p-id="7816"></path><path d="M155.948853 267.119571c0 157.023328 93.20449 175.664226 194.405076 175.664226h329.838946c101.250561 0 194.405076-51.824695 194.405075-175.664226A170.316837 170.316837 0 0 0 705.430551 114.943875H325.266179a170.416789 170.416789 0 0 0-169.317326 152.175696z" fill="#F55651" p-id="7817"></path><path d="M204.775012 241.232211c30.884919-64.968277 76.612592-77.162323 161.121328-77.162323h333.587115c79.960957 0 118.642069 13.543387 136.283456 23.488531A166.868521 166.868521 0 0 0 698.084139 114.943875H325.116252A167.068424 167.068424 0 0 0 159.197267 264.220986c-4.048023 56.572377 2.848609 86.807613 23.888336 114.294192 4.99756 4.247926 25.637482 28.236213 35.582625 24.587994a221.741728 221.741728 0 0 1-27.636505-108.546998 124.938995 124.938995 0 0 1 13.743289-53.323963z" fill="#F67969" p-id="7818"></path><path d="M722.422255 115.943387c0.649683 0 105.848316 40.830063 105.848316 151.925817S709.928355 400.254563 631.466667 400.254563H405.62694c-61.270083 0-173.115471 14.043143-236.434553-65.767887a62.369546 62.369546 0 0 0 0.499756 10.694778C202.126306 408.200683 232.861298 442.783797 350.353929 442.783797h329.838946a195.354612 195.354612 0 0 0 194.405075-175.664226A170.266862 170.266862 0 0 0 722.422255 115.943387z" fill="#E3413F" p-id="7819"></path><path d="M680.292826 452.828892h-329.838946c-94.953636 0-204.400195-21.139678-204.400195-185.759297v-1.049488A179.912152 179.912152 0 0 1 325.266179 104.948755h380.164372a179.912152 179.912152 0 0 1 179.212494 160.971401 7.396388 7.396388 0 0 1 0 1.049488c0.049976 137.033089-105.748365 185.859248-204.350219 185.859248zM165.943973 267.619327c0 145.179112 88.756662 165.219327 184.409956 165.219326h329.838946c89.00654 0 184.160078-43.428795 184.409956-165.219326A159.921913 159.921913 0 0 0 705.430551 124.938995H325.266179a159.921913 159.921913 0 0 0-159.322206 142.680332z" fill="#4B2254" p-id="7820"></path><path d="M511.225378 438.785749m-139.581845 0a139.581845 139.581845 0 1 0 279.16369 0 139.581845 139.581845 0 1 0-279.16369 0Z" fill="#F8B031" p-id="7821"></path><path d="M498.181747 410.39961m-111.195705 0a111.195705 111.195705 0 1 0 222.39141 0 111.195705 111.195705 0 1 0-222.39141 0Z" fill="#FACF5D" p-id="7822"></path><path d="M511.225378 588.362714a149.576964 149.576964 0 1 1 149.576965-149.576965 149.926794 149.926794 0 0 1-149.576965 149.576965z m0-279.16369a129.586725 129.586725 0 1 0 129.586725 129.586725 129.936554 129.936554 0 0 0-129.586725-129.586725z" fill="#4B2254" p-id="7823"></path></svg>
        {summary.claimedCount > 0 ? summary.claimedCount : ""}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="关闭红包弹层遮罩"
            className="fixed inset-0 z-30 bg-black/40 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-3 top-auto z-40 max-h-[85vh] overflow-y-auto rounded-[28px] border border-border bg-background p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-[calc(100%+12px)] sm:right-0 sm:w-[380px] sm:max-h-[70vh] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold">帖子红包</h4>
                <p className="mt-1 text-sm text-muted-foreground">条件：{summary.triggerLabel ?? "互动后领取"}</p>
              </div>
              <div className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                已领 {summary.claimedCount}/{summary.packetCount}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-[20px] bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">金额模式</p>
                <p className="mt-1 font-semibold">{summary.grantMode ? getPostRedPacketGrantModeLabel(summary.grantMode) : "固定红包"}</p>
              </div>
              <div className="rounded-[20px] bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">领取规则</p>
                <p className="mt-1 font-semibold">{summary.claimOrderMode ? getPostRedPacketClaimOrderModeLabel(summary.claimOrderMode) : "先到先得"}</p>
              </div>
              <div className="rounded-[20px] bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">红包总额</p>
                <p className="mt-1 font-semibold">{summary.totalPoints} {pointName}</p>
              </div>
              <div className="rounded-[20px] bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">剩余数量</p>
                <p className="mt-1 font-semibold">{summary.remainingCount} / {summary.remainingPoints} {pointName}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {summary.records.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  暂无红包领取记录
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {pagedRecords.map((record) => (

                    <div key={record.id} className={record.id === kingRecordId ? "flex items-center justify-between gap-3 rounded-[18px] border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-3 py-2.5 shadow-sm dark:border-amber-500/30 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-rose-500/10" : "flex items-center justify-between gap-3 rounded-[18px] border border-border/70 bg-card px-3 py-2.5"}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar name={record.nickname ?? record.username} avatarPath={record.avatarPath} size="sm" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{record.nickname ?? record.username}</p>
                            {record.id === kingRecordId ? <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-white">手气王</span> : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{record.triggerLabel} · {record.createdAt}</p>
                        </div>
                      </div>
                      <div className={record.id === kingRecordId ? "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300"}>
                        <Sparkles className="h-3.5 w-3.5" />
                        +{record.amount}
                      </div>
                    </div>

                  ))}
                </div>
              )}
            </div>

            {summary.records.length > pageSize ? (
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>第 {page} / {totalPages} 页 · 共 {summary.totalRecords} 条</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" className="h-8 rounded-full px-3" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    上一页
                  </Button>
                  <Button type="button" variant="ghost" className="h-8 rounded-full px-3" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    下一页
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-3">

              {summary.currentUserPoints <= 0 ? (
                <Link href="/points" className="text-sm text-primary hover:opacity-80">去充值 / 兑换</Link>
              ) : <span className="text-xs text-muted-foreground">系统会在互动成功后自动判断并发放红包。</span>}
              <Button type="button" variant="ghost" className="h-9 rounded-xl px-4" onClick={() => setOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        </>
      ) : null}


    </div>
  )
}
