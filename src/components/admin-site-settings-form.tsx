"use client"

import Image from "next/image"
import { useState, useTransition } from "react"
import { Loader2, Upload } from "lucide-react"


import { Button } from "@/components/ui/button"

interface AdminSiteSettingsFormProps {
  initialSettings: {
    siteName: string
    siteSlogan: string
    siteDescription: string
    siteLogoText: string
    siteLogoPath?: string | null
    siteSeoKeywords?: string[]
    vipMonthlyPrice: number

    vipQuarterlyPrice: number
    vipYearlyPrice: number
    uploadProvider: string
    uploadLocalPath: string
    uploadBaseUrl?: string | null
    uploadOssBucket?: string | null
    uploadOssRegion?: string | null
    uploadOssEndpoint?: string | null
  }
}

export function AdminSiteSettingsForm({ initialSettings }: AdminSiteSettingsFormProps) {
  const [siteName, setSiteName] = useState(initialSettings.siteName)
  const [siteSlogan, setSiteSlogan] = useState(initialSettings.siteSlogan)
  const [siteDescription, setSiteDescription] = useState(initialSettings.siteDescription)
  const [siteLogoText, setSiteLogoText] = useState(initialSettings.siteLogoText)
  const [siteLogoPath, setSiteLogoPath] = useState(initialSettings.siteLogoPath ?? "")
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [vipMonthlyPrice, setVipMonthlyPrice] = useState(String(initialSettings.vipMonthlyPrice))
  const [vipQuarterlyPrice, setVipQuarterlyPrice] = useState(String(initialSettings.vipQuarterlyPrice))
  const [vipYearlyPrice, setVipYearlyPrice] = useState(String(initialSettings.vipYearlyPrice))
  const [uploadProvider, setUploadProvider] = useState(initialSettings.uploadProvider)
  const [uploadLocalPath, setUploadLocalPath] = useState(initialSettings.uploadLocalPath)
  const [uploadBaseUrl, setUploadBaseUrl] = useState(initialSettings.uploadBaseUrl ?? "")
  const [uploadOssBucket, setUploadOssBucket] = useState(initialSettings.uploadOssBucket ?? "")
  const [uploadOssRegion, setUploadOssRegion] = useState(initialSettings.uploadOssRegion ?? "")
  const [uploadOssEndpoint, setUploadOssEndpoint] = useState(initialSettings.uploadOssEndpoint ?? "")
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  async function uploadSiteLogo(file: File) {
    if (!file.type.startsWith("image/")) {
      setFeedback("请先选择图片格式的站点 Logo")
      return
    }

    setIsUploadingLogo(true)
    setFeedback("")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "site-logo")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || result.code !== 0) {
        setFeedback(result.message ?? "站点 Logo 上传失败")
        return
      }

      setSiteLogoPath(String(result.data?.urlPath ?? ""))
      setFeedback("站点 Logo 上传成功")
    } catch {
      setFeedback("站点 Logo 上传失败，请稍后再试")
    } finally {
      setIsUploadingLogo(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const response = await fetch("/api/admin/site-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              siteName,
              siteSlogan,
              siteDescription,
              siteLogoText,
              siteLogoPath,
              vipMonthlyPrice: Number(vipMonthlyPrice),
              vipQuarterlyPrice: Number(vipQuarterlyPrice),
              vipYearlyPrice: Number(vipYearlyPrice),
              uploadProvider,
              uploadLocalPath,
              uploadBaseUrl,
              uploadOssBucket,
              uploadOssRegion,
              uploadOssEndpoint,
            }),
          })
          const result = await response.json()
          setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
        })
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="站点名称" value={siteName} onChange={setSiteName} placeholder="如 兴趣论坛" />
        <Field label="Logo 文案" value={siteLogoText} onChange={setSiteLogoText} placeholder="如 兴趣论坛" />
      </div>
      <Field label="站点 Slogan" value={siteSlogan} onChange={setSiteSlogan} placeholder="如 Waste your time on things you love" />
      <div className="space-y-2">
        <p className="text-sm font-medium">站点描述</p>
        <textarea value={siteDescription} onChange={(event) => setSiteDescription(event.target.value)} className="min-h-[140px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" />
      </div>
      <div className="space-y-3 rounded-[24px] border border-border p-5">
        <div>
          <h3 className="text-sm font-semibold">站点 Logo</h3>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">支持上传图片或直接填写图片地址；未设置时，前台继续使用默认 SVG 图标。</p>
        </div>
        <div className="space-y-3 rounded-[18px] border border-dashed border-border bg-card/60 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent">
              {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploadingLogo ? "上传中..." : "上传站点 Logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingLogo}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void uploadSiteLogo(file)
                  }
                  event.target.value = ""
                }}
              />
            </label>
            <Button type="button" variant="ghost" disabled={!siteLogoPath || isUploadingLogo} onClick={() => setSiteLogoPath("")}>清空图片 Logo</Button>
          </div>
          <input value={siteLogoPath} onChange={(event) => setSiteLogoPath(event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="或直接填写站点 Logo 地址" />
          {siteLogoPath ? (
            <div className="relative h-16 w-40 overflow-hidden rounded-xl border border-border bg-white p-2">
              <Image src={siteLogoPath} alt="站点 Logo 预览" fill sizes="160px" className="object-contain" unoptimized />
            </div>
          ) : null}

        </div>
      </div>
      <div className="rounded-[24px] border border-border p-5">
        <h3 className="text-sm font-semibold">VIP 套餐价格</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="月卡积分价格（VIP1）" value={vipMonthlyPrice} onChange={setVipMonthlyPrice} placeholder="如 3000" />
          <Field label="季卡积分价格（VIP2）" value={vipQuarterlyPrice} onChange={setVipQuarterlyPrice} placeholder="如 8000" />
          <Field label="年卡积分价格（VIP3）" value={vipYearlyPrice} onChange={setVipYearlyPrice} placeholder="如 30000" />
        </div>
      </div>

      <div className="rounded-[24px] border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">上传存储设置</h3>
        <div className="space-y-2">
          <p className="text-sm font-medium">存储策略</p>
          <select value={uploadProvider} onChange={(event) => setUploadProvider(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
            <option value="local">本地存储</option>
            <option value="oss">OSS（预留）</option>
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="本地上传目录" value={uploadLocalPath} onChange={setUploadLocalPath} placeholder="如 uploads" />
          <Field label="资源访问基础 URL" value={uploadBaseUrl} onChange={setUploadBaseUrl} placeholder="留空则自动使用 /uploads" />
          <Field label="OSS Bucket" value={uploadOssBucket} onChange={setUploadOssBucket} placeholder="如 my-bucket" />
          <Field label="OSS Region" value={uploadOssRegion} onChange={setUploadOssRegion} placeholder="如 ap-guangzhou" />
          <Field label="OSS Endpoint" value={uploadOssEndpoint} onChange={setUploadOssEndpoint} placeholder="如 https://oss.example.com" />
        </div>
        <p className="text-xs leading-6 text-muted-foreground">当前先完整支持本地上传，OSS 配置项先保留在后台设置中，后续可继续接入真实云存储实现。</p>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={isPending}>{isPending ? "保存中..." : "保存站点设置"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </form>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
  )
}
