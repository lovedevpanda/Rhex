"use client"

import { type ReactNode, useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { REPORT_REASON_OPTIONS } from "@/lib/reports"


interface ReportDialogProps {
  targetType: "POST" | "COMMENT" | "USER"
  targetId: string
  targetLabel: string
  buttonText?: string
  buttonClassName?: string
  icon?: ReactNode
}

export function ReportDialog({ targetType, targetId, targetLabel, buttonText = "举报", buttonClassName, icon }: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reasonType, setReasonType] = useState<string>(REPORT_REASON_OPTIONS[0])
  const [reasonDetail, setReasonDetail] = useState("")
  const [isPending, startTransition] = useTransition()


  const title = useMemo(() => (targetType === "POST" ? "举报帖子" : targetType === "COMMENT" ? "举报回复" : "举报用户"), [targetType])

  function reset() {
    setReasonType(REPORT_REASON_OPTIONS[0])
    setReasonDetail("")
  }

  function submit() {
    startTransition(async () => {
      const response = await fetch("/api/reports/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reasonType,
          reasonDetail,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "举报失败", "举报失败")
        return
      }

      toast.success(result.message ?? "举报已提交", "举报成功")
      setTimeout(() => {
        setOpen(false)
        reset()
      }, 600)
    })
  }


  return (
    <>
      <Button type="button" variant="ghost" title={buttonText} aria-label={buttonText} className={buttonClassName ?? "h-8 px-2 text-xs text-muted-foreground hover:text-foreground"} onClick={() => setOpen(true)}>

        {icon ?? buttonText}
        {icon ? <span className="sr-only">{buttonText}</span> : null}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-lg rounded-[28px] bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">举报对象：{targetLabel}</p>
              </div>
              <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => {
                setOpen(false)
                reset()
              }}>
                关闭
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-foreground">举报原因</span>
                <select
                  value={reasonType}
                  onChange={(event) => setReasonType(event.target.value)}
                  className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30"
                >
                  {REPORT_REASON_OPTIONS.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-foreground">补充说明</span>
                <textarea
                  value={reasonDetail}
                  onChange={(event) => setReasonDetail(event.target.value)}
                  placeholder="可补充时间、上下文或其它判断依据，帮助管理员更快处理。"
                  className="min-h-[140px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
                />
              </label>



              <div className="flex items-center gap-3">
                <Button type="button" disabled={isPending} onClick={submit}>
                  {isPending ? "提交中..." : "提交举报"}
                </Button>
                <Button type="button" variant="ghost" disabled={isPending} onClick={() => {
                  setOpen(false)
                  reset()
                }}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

