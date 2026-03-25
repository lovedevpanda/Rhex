"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Plus } from "lucide-react"


import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

interface FriendLinkApplicationDialogProps {
  announcement: string
  disabled?: boolean
}

const INITIAL_FORM = {
  name: "",
  url: "",
  logoPath: "",
}

export function FriendLinkApplicationDialog({ announcement, disabled = false }: FriendLinkApplicationDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const canSubmit = useMemo(() => form.name.trim() && form.url.trim() && !submitting, [form.name, form.url, submitting])

  function closeDialog() {
    if (submitting) {
      return
    }

    setOpen(false)
  }

  function updateField<K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/friend-links/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message ?? "申请提交失败", "提交失败")
        return
      }

      toast.success(result.message ?? "申请已提交，请等待审核", "提交成功")
      setForm(INITIAL_FORM)
      setOpen(false)
    } catch {
      toast.error("申请提交失败，请稍后重试", "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={disabled} className="rounded-full px-5">
        <Plus className="mr-2 h-4 w-4" />
        申请友情链接
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[28px] border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">申请友情链接</h3>
                <p className="mt-2 text-sm text-muted-foreground">提交后将进入后台审核，审核通过后会展示在友情链接列表中。</p>
              </div>
              <Button type="button" variant="ghost" className="h-8 px-2" onClick={closeDialog}>
                关闭
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <section className="rounded-[24px] border border-border bg-card p-5">
                <p className="text-sm font-medium">友情链接公告：</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{announcement}</p>
              </section>

              <Field label="网站名称" hint="请输入您的网站名称">
                <input value={form.name} onChange={(event) => updateField("name", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none" placeholder="请输入您的网站名称" maxLength={40} />
              </Field>

              <Field label="网站链接" hint="请输入您的网站地址（以 http 开头）">
                <input value={form.url} onChange={(event) => updateField("url", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none" placeholder="请输入您的网站地址（以 http 开头）" />
              </Field>

              <Field label="LOGO URL" hint="仅支持填写图片 URL，例如：https://example.com/logo.png">
                <div className="space-y-3 rounded-[24px] border border-dashed border-border bg-card/60 p-4">
                  <input value={form.logoPath} onChange={(event) => updateField("logoPath", event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none" placeholder="请输入 LOGO 图片 URL" />
                  {form.logoPath ? (
                    <div className="relative h-16 w-32 overflow-hidden rounded-xl border border-border bg-white p-2">
                      <Image src={form.logoPath} alt={`${form.name || "友情链接"} logo`} fill unoptimized className="object-contain p-2" />
                    </div>
                  ) : null}

                </div>
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!canSubmit}>
                  {submitting ? "提交中..." : "提交申请"}
                </Button>
                <Button type="button" variant="ghost" disabled={submitting} onClick={closeDialog}>
                  取消
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <p className="text-xs leading-6 text-muted-foreground">{hint}</p>
      {children}
    </label>
  )
}
