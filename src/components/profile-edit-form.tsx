"use client"

import { useMemo, useRef, useState } from "react"
import { Camera, LoaderCircle, Mail, PencilLine, UserRound } from "lucide-react"

import { PasswordChangeForm } from "@/components/password-change-form"
import { AdminModal } from "@/components/admin-modal"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

interface ProfileEditFormProps {
  username: string
  initialNickname: string
  initialBio: string
  initialGender?: string | null
  initialAvatarPath?: string | null
  initialEmail?: string | null
  initialEmailVerified: boolean
  nicknameChangePointCost: number
  pointName: string
  avatarMaxFileSizeMb: number
}

type ProfileSectionKey = "basic" | "avatar" | "email" | "password"

const genderOptions = [
  { value: "unknown", label: "保密" },
  { value: "male", label: "男" },
  { value: "female", label: "女" },
]

export function ProfileEditForm({
  username,
  initialNickname,
  initialBio,
  initialGender,
  initialAvatarPath,
  initialEmail,
  initialEmailVerified,
  nicknameChangePointCost,
  pointName,
  avatarMaxFileSizeMb,
}: ProfileEditFormProps) {
  const normalizedAvatarMaxFileSizeMb = Number.isFinite(avatarMaxFileSizeMb) && avatarMaxFileSizeMb > 0 ? avatarMaxFileSizeMb : 2
  const [activeSection, setActiveSection] = useState<ProfileSectionKey>("basic")
  const [nickname, setNickname] = useState(initialNickname)
  const [bio, setBio] = useState(initialBio)
  const [gender, setGender] = useState(initialGender || "unknown")
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath ?? "")
  const [previewUrl, setPreviewUrl] = useState(initialAvatarPath ?? "")
  const [email, setEmail] = useState(initialEmail ?? "")
  const [emailCode, setEmailCode] = useState("")
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified)
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [pendingNickname, setPendingNickname] = useState(initialNickname)
  const [nicknameLoading, setNicknameLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const nicknameChanged = useMemo(() => nickname.trim() !== initialNickname.trim(), [initialNickname, nickname])
  const nicknameHint = nicknameChangePointCost > 0
    ? nicknameChanged
      ? `本次修改用户名将扣除 ${nicknameChangePointCost} ${pointName}，且用户名全站唯一。`
      : `修改用户名需消耗 ${nicknameChangePointCost} ${pointName}，用户名全站唯一。`
    : "用户名全站唯一，当前修改免费。"

  async function updateProfile(payload: { nickname?: string; bio?: string; gender?: string; avatarPath?: string; email?: string; emailCode?: string }) {
    const response = await fetch("/api/profile/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nickname: payload.nickname ?? nickname,
        bio: payload.bio ?? bio,
        gender: payload.gender ?? gender,
        avatarPath: payload.avatarPath ?? avatarPath,
        email: payload.email ?? email,
        emailCode: payload.emailCode ?? "",
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "保存失败")
    }

    return result
  }

  async function handleNicknameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!pendingNickname.trim()) {
      toast.warning("用户名不能为空", "修改用户名")
      return
    }

    setNicknameLoading(true)

    try {
      const result = await updateProfile({ nickname: pendingNickname.trim() })
      setNickname(result.data?.nickname ?? pendingNickname.trim())
      setPendingNickname(result.data?.nickname ?? pendingNickname.trim())
      setShowNicknameModal(false)
      toast.success(result.message ?? "用户名已更新", "修改用户名成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改失败", "修改用户名失败")
    } finally {
      setNicknameLoading(false)
    }
  }

  async function handleBasicSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileLoading(true)

    try {
      const result = await updateProfile({ bio, gender })
      setBio(result.data?.bio ?? bio)
      setGender(result.data?.gender ?? gender)
      toast.success(result.message ?? "基础资料已更新", "保存成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败", "基础资料保存失败")
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.warning("请选择图片文件后再上传", "头像上传")
      event.target.value = ""
      return
    }

    if (file.size > normalizedAvatarMaxFileSizeMb * 1024 * 1024) {
      toast.warning(`头像大小请控制在 ${normalizedAvatarMaxFileSizeMb}MB 内`, "头像上传")
      event.target.value = ""
      return
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(nextPreviewUrl)
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "avatars")

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "头像上传失败")
      }

      const uploadedPath = result.data?.urlPath ?? ""
      setAvatarPath(uploadedPath)
      setPreviewUrl(uploadedPath || nextPreviewUrl)
      toast.success("头像上传成功，请继续保存头像设置", "头像上传成功")
    } catch (error) {
      setPreviewUrl(avatarPath || initialAvatarPath || "")
      toast.error(error instanceof Error ? error.message : "头像上传失败", "头像上传失败")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  async function handleAvatarSave() {
    setAvatarSaving(true)

    try {
      const result = await updateProfile({ avatarPath })
      setAvatarPath(result.data?.avatarPath ?? avatarPath)
      setPreviewUrl(result.data?.avatarPath ?? avatarPath)
      toast.success(result.message ?? "头像已更新", "头像保存成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败", "头像保存失败")
    } finally {
      setAvatarSaving(false)
    }
  }

  async function handleSendEmailCode() {
    if (!email) {
      toast.warning("请先填写邮箱地址", "邮箱验证")
      return
    }

    setSendingCode(true)

    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "EMAIL", target: email }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "验证码发送失败")
      }

      toast.success(result.message ?? "验证码已发送", "邮箱验证")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "验证码发送失败", "邮箱验证")
    } finally {
      setSendingCode(false)
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailSaving(true)

    try {
      const result = await updateProfile({ email, emailCode })
      if (result.data?.emailVerifiedAt) {
        setEmailVerified(true)
      }
      setEmailCode("")
      toast.success(result.message ?? "邮箱已更新", "邮箱保存成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败", "邮箱保存失败")
    } finally {
      setEmailSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <SectionTab label="基础资料" active={activeSection === "basic"} onClick={() => setActiveSection("basic")} />
        <SectionTab label="头像" active={activeSection === "avatar"} onClick={() => setActiveSection("avatar")} />
        <SectionTab label="邮箱" active={activeSection === "email"} onClick={() => setActiveSection("email")} />
        <SectionTab label="密码" active={activeSection === "password"} onClick={() => setActiveSection("password")} />
      </div>

      {activeSection === "basic" ? (
        <form onSubmit={handleBasicSubmit} className="space-y-5">
          <div className="rounded-[24px] border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">用户名</p>
                <p className="mt-2 text-lg font-semibold">{nickname}</p>
                <p className="mt-2 text-xs text-muted-foreground">{nicknameHint}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setShowNicknameModal(true)}>
                <PencilLine className="mr-2 h-4 w-4" />
                修改用户名
              </Button>
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-medium">账号名</p>
              <p className="mt-2 rounded-full bg-secondary px-4 py-3 text-sm text-muted-foreground">{username}</p>
              <p className="mt-2 text-xs text-muted-foreground">账号名作为唯一登录标识</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">性别</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {genderOptions.map((option) => {
                  const active = gender === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGender(option.value)}
                      className={active ? "rounded-[20px] border border-foreground bg-foreground px-4 py-3 text-sm font-medium text-background" : "rounded-[20px] border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-accent/40"}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">个人简介</p>
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-[180px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="介绍一下你自己，最多 200 字" />
              <p className="text-xs text-muted-foreground">{bio.length}/200</p>
            </div>
          </div>

          <Button disabled={profileLoading}>{profileLoading ? "保存中..." : "保存基础资料"}</Button>
        </form>
      ) : null}

      {activeSection === "avatar" ? (
        <div className="space-y-5 rounded-[24px] border border-border bg-card p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <UserAvatar name={nickname || username} avatarPath={previewUrl || avatarPath || undefined} size="lg" />
                <div className="absolute -bottom-2 -right-2 rounded-full border border-border bg-background p-2 shadow-sm">
                  {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </div>
              </div>
              <div>
                <p className="text-base font-semibold">当前头像</p>
                <p className="mt-2 text-sm text-muted-foreground">支持图片上传，上传后立即预览，再手动保存到个人资料。</p>
                <p className="mt-1 text-xs text-muted-foreground">建议使用清晰正方形头像，大小控制在 {normalizedAvatarMaxFileSizeMb}MB 以内。</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? "上传中..." : "选择头像"}
              </Button>
              <Button type="button" onClick={handleAvatarSave} disabled={uploading || avatarSaving}>
                {avatarSaving ? "保存中..." : "保存头像"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === "email" ? (
        <form onSubmit={handleEmailSubmit} className="space-y-5 rounded-[24px] border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">邮箱地址</p>
              <p className="mt-1 text-xs text-muted-foreground">邮箱验证后将锁定不可再修改，请确认填写的是常用邮箱。</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">邮箱</p>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" disabled={emailVerified} placeholder="填写常用邮箱" />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={emailVerified ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-700" : "rounded-full bg-amber-100 px-3 py-1 text-amber-700"}>{emailVerified ? "已验证" : "未验证"}</span>
            {!emailVerified ? <Button type="button" variant="outline" onClick={handleSendEmailCode} disabled={sendingCode || !email}>{sendingCode ? "发送中..." : "发送邮箱验证码"}</Button> : null}
          </div>

          {!emailVerified ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">邮箱验证码</p>
              <input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="输入收到的 6 位验证码" />
            </div>
          ) : null}

          <Button disabled={emailSaving}>{emailSaving ? "保存中..." : emailVerified ? "邮箱已验证" : "保存并验证邮箱"}</Button>
        </form>
      ) : null}

      {activeSection === "password" ? (
        <div className="rounded-[24px] border border-border bg-card p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">密码修改</p>
              <p className="mt-1 text-xs text-muted-foreground">为确保账户安全，修改密码后建议重新登录并妥善保管新密码。</p>
            </div>
          </div>
          <PasswordChangeForm embedded />
        </div>
      ) : null}

      <AdminModal
        open={showNicknameModal}
        title="修改用户名"
        description="用户名全站唯一，提交后会立即生效。"
        onClose={() => {
          setPendingNickname(nickname)
          setShowNicknameModal(false)
        }}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => {
              setPendingNickname(nickname)
              setShowNicknameModal(false)
            }}>
              取消
            </Button>
            <Button type="submit" form="nickname-edit-form" disabled={nicknameLoading}>
              {nicknameLoading ? "保存中..." : "确认修改"}
            </Button>
          </div>
        }
      >
        <form id="nickname-edit-form" onSubmit={handleNicknameSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">用户名</p>
            <input value={pendingNickname} onChange={(event) => setPendingNickname(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" placeholder="输入新的用户名" />
          </div>
          <p className="text-xs text-muted-foreground">{nicknameHint}</p>
        </form>
      </AdminModal>
    </div>
  )
}

function SectionTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background" : "rounded-full bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
    >
      {label}
    </button>
  )
}
