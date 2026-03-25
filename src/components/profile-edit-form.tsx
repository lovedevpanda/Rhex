"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"



interface ProfileEditFormProps {
  username: string
  initialNickname: string
  initialBio: string
  initialAvatarPath?: string | null
  initialEmail?: string | null
  initialEmailVerified: boolean
  nicknameChangePointCost: number
  pointName: string
}

export function ProfileEditForm({ username, initialNickname, initialBio, initialAvatarPath, initialEmail, initialEmailVerified, nicknameChangePointCost, pointName }: ProfileEditFormProps) {
  const router = useRouter()
  const [nickname, setNickname] = useState(initialNickname)
  const [bio, setBio] = useState(initialBio)
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath ?? "")
  const [previewUrl, setPreviewUrl] = useState(initialAvatarPath ?? "")
  const [email, setEmail] = useState(initialEmail ?? "")
  const [emailCode, setEmailCode] = useState("")
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)


  const [uploading, setUploading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)

  const nicknameChanged = useMemo(() => nickname.trim() !== initialNickname.trim(), [initialNickname, nickname])
  const nicknameHint = nicknameChangePointCost > 0
    ? nicknameChanged
      ? `本次修改昵称将扣除 ${nicknameChangePointCost} ${pointName}，且昵称全站唯一。`
      : `修改昵称需消耗 ${nicknameChangePointCost} ${pointName}，昵称全站唯一。`
    : "昵称全站唯一，当前改昵称免费。"

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setMessage("请选择图片文件后再上传")
      event.target.value = ""
      return
    }

    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    setMessage("")
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "avatars")

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
    const result = await response.json()
    setUploading(false)

    if (!response.ok) {
      setMessage(result.message ?? "头像上传失败")
      return
    }

    setAvatarPath(result.data?.urlPath ?? "")
    setPreviewUrl(result.data?.urlPath ?? previewUrl)
    setMessage("头像上传成功，记得保存资料")
  }

  async function handleSendEmailCode() {
    if (!email) {
      setMessage("请先填写邮箱地址")
      return
    }

    setSendingCode(true)
    setMessage("")
    const response = await fetch("/api/auth/send-verification-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: "EMAIL", target: email }),
    })

    const result = await response.json()
    setMessage(result.message ?? (response.ok ? "验证码已发送" : "验证码发送失败"))
    setSendingCode(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    const response = await fetch("/api/profile/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nickname, bio, avatarPath, email, emailCode }),
    })

    const result = await response.json()

    if (!response.ok) {
      setMessage(result.message ?? "保存失败")
      setLoading(false)
      return
    }

    if (result.data?.emailVerifiedAt) {
      setEmailVerified(true)
    }

    setMessage(result.message ?? (emailCode && !emailVerified ? "资料与邮箱验证已更新" : "资料已更新"))
    router.push(`/settings?tab=profile`)
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-[24px] border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={nickname || username} avatarPath={previewUrl || avatarPath || undefined} size="lg" />
          <div className="space-y-2">
            <p className="text-sm font-medium">头像上传</p>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="block w-full text-sm" disabled={uploading} />
            <p className="text-xs text-muted-foreground">仅支持图片文件，实际允许格式与大小限制以后台上传安全设置为准；上传后会先在这里实时预览，再保存到个人资料。</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">昵称</p>
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" />
        <p className="text-xs text-muted-foreground">{nicknameHint}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">个人简介</p>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-[160px] w-full rounded-[24px] border border-border bg-card px-4 py-3 text-sm outline-none" />
      </div>

      <div className="rounded-[24px] border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-sm font-medium">邮箱地址</p>
          <p className="mt-1 text-xs text-muted-foreground">邮箱一旦完成验证，将锁定不可再修改。</p>
        </div>
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" disabled={emailVerified} placeholder="填写常用邮箱" />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={emailVerified ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-700" : "rounded-full bg-amber-100 px-3 py-1 text-amber-700"}>{emailVerified ? "已验证" : "未验证"}</span>
          {!emailVerified ? <Button type="button" variant="outline" onClick={handleSendEmailCode} disabled={sendingCode || !email}>{sendingCode ? "发送中..." : "发送邮箱验证码"}</Button> : null}
        </div>
        {!emailVerified ? <input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm outline-none" placeholder="输入收到的邮箱验证码后保存资料" /> : null}
      </div>

      <Button disabled={loading || uploading}>{loading ? "保存中..." : uploading ? "上传中..." : emailCode && !emailVerified ? "保存并验证邮箱" : "保存资料"}</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

    </form>

  )
}
