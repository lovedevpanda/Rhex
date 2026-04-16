"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, LoaderCircle, Mail, PencilLine, UserRound } from "lucide-react"

import { PasswordChangeForm } from "@/components/profile/password-change-form"
import { Modal } from "@/components/ui/modal"
import { AvatarCropModal } from "@/components/profile/avatar-crop-modal"
import { AddonEditor } from "@/components/addon-editor"
import { UserAvatar } from "@/components/user/user-avatar"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { UserProfileVisibility } from "@/lib/user-profile-settings"

interface ProfileEditFormProps {
  username: string
  initialNickname: string
  initialBio: string
  initialIntroduction: string
  initialGender?: string | null
  initialAvatarPath?: string | null
  initialEmail?: string | null
  initialEmailVerified: boolean
  passwordChangeRequireEmailVerification?: boolean
  emailDeliveryEnabled?: boolean
  initialActivityVisibility: UserProfileVisibility
  initialIntroductionVisibility: UserProfileVisibility
  nicknameChangePointCost: number
  nicknameChangePriceDescription?: string
  introductionChangePointCost: number
  introductionChangePriceDescription?: string
  avatarChangePointCost: number
  avatarChangePriceDescription?: string
  pointName: string
  avatarMaxFileSizeMb: number
  markdownEmojiMap?: MarkdownEmojiItem[]
  markdownImageUploadEnabled?: boolean
  initialSection?: ProfileSectionKey
  availableSections?: ProfileSectionKey[]
}

type ProfileSectionKey = "basic" | "avatar" | "email" | "password" | "privacy"

const profileSectionLabels: Record<ProfileSectionKey, string> = {
  basic: "基础资料",
  avatar: "头像",
  email: "邮箱",
  password: "密码",
  privacy: "隐私",
}

const genderOptions = [
  { value: "unknown", label: "保密" },
  { value: "male", label: "男" },
  { value: "female", label: "女" },
]

const visibilityOptions: Array<{ value: UserProfileVisibility; label: string }> = [
  { value: "PUBLIC", label: "公开" },
  { value: "MEMBERS", label: "登录公开" },
  { value: "PRIVATE", label: "仅自己可见" },
]

const visibilityLabelMap: Record<UserProfileVisibility, string> = {
  PUBLIC: "公开",
  MEMBERS: "登录公开",
  PRIVATE: "仅自己可见",
}

function getActivityVisibilityDescription(visibility: UserProfileVisibility) {
  if (visibility === "PUBLIC") {
    return "任何访问你主页的人都能看到最近帖子与最近回复。"
  }

  if (visibility === "MEMBERS") {
    return "只有登录用户能看到最近帖子与最近回复。"
  }

  return "只有你自己能看到最近帖子与最近回复。"
}

function getIntroductionVisibilityDescription(visibility: UserProfileVisibility) {
  if (visibility === "PUBLIC") {
    return "任何访问你主页的人都能看到“介绍”标签内容。"
  }

  if (visibility === "MEMBERS") {
    return "只有登录用户能看到“介绍”标签内容。"
  }

  return "只有你自己能看到“介绍”标签内容。"
}

function revokeObjectUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

export function ProfileEditForm({
  username,
  initialNickname,
  initialBio,
  initialIntroduction,
  initialGender,
  initialAvatarPath,
  initialEmail,
  initialEmailVerified,
  passwordChangeRequireEmailVerification = false,
  emailDeliveryEnabled = false,
  initialActivityVisibility,
  initialIntroductionVisibility,
  nicknameChangePointCost,
  nicknameChangePriceDescription,
  introductionChangePointCost,
  introductionChangePriceDescription,
  avatarChangePointCost,
  avatarChangePriceDescription,
  pointName,
  avatarMaxFileSizeMb,
  markdownEmojiMap,
  markdownImageUploadEnabled,
  initialSection = "basic",
  availableSections = ["basic", "avatar", "email", "password", "privacy"],
}: ProfileEditFormProps) {
  const normalizedAvatarMaxFileSizeMb = Number.isFinite(avatarMaxFileSizeMb) && avatarMaxFileSizeMb > 0 ? avatarMaxFileSizeMb : 2
  const normalizedSections = useMemo<ProfileSectionKey[]>(
    () => (availableSections.length > 0 ? availableSections : ["basic"]),
    [availableSections],
  )
  const [activeSection, setActiveSection] = useState<ProfileSectionKey>(
    normalizedSections.includes(initialSection) ? initialSection : normalizedSections[0],
  )
  const [nickname, setNickname] = useState(initialNickname)
  const [bio, setBio] = useState(initialBio)
  const [introduction, setIntroduction] = useState(initialIntroduction)
  const [gender, setGender] = useState(initialGender || "unknown")
  const [savedAvatarPath, setSavedAvatarPath] = useState(initialAvatarPath ?? "")
  const [pendingAvatarPath, setPendingAvatarPath] = useState(initialAvatarPath ?? "")
  const [previewUrl, setPreviewUrl] = useState(initialAvatarPath ?? "")
  const [cropSourceUrl, setCropSourceUrl] = useState("")
  const [cropSourceName, setCropSourceName] = useState("")
  const [cropSourceType, setCropSourceType] = useState("")
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null)
  const [email, setEmail] = useState(initialEmail ?? "")
  const [emailCode, setEmailCode] = useState("")
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified)
  const [activityVisibility, setActivityVisibility] = useState(initialActivityVisibility)
  const [introductionVisibility, setIntroductionVisibility] = useState(initialIntroductionVisibility)
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [privacySavingKey, setPrivacySavingKey] = useState<"activity" | "introduction" | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [showIntroductionModal, setShowIntroductionModal] = useState(false)
  const [pendingNickname, setPendingNickname] = useState(initialNickname)
  const [pendingIntroduction, setPendingIntroduction] = useState(initialIntroduction)
  const [nicknameLoading, setNicknameLoading] = useState(false)
  const [introductionLoading, setIntroductionLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewBlobUrlRef = useRef("")
  const cropSourceBlobUrlRef = useRef("")

  const nicknameChanged = useMemo(() => nickname.trim() !== initialNickname.trim(), [initialNickname, nickname])
  const introductionChanged = useMemo(() => introduction.trim() !== initialIntroduction.trim(), [initialIntroduction, introduction])
  const normalizedSavedAvatarPath = savedAvatarPath.trim()
  const normalizedPendingAvatarPath = pendingAvatarPath.trim()
  const hasSavedAvatar = normalizedSavedAvatarPath.length > 0
  const avatarChanged = useMemo(() => normalizedPendingAvatarPath !== normalizedSavedAvatarPath, [normalizedPendingAvatarPath, normalizedSavedAvatarPath])
  const avatarRequiresPayment = avatarChanged && hasSavedAvatar
  const nicknameHint = nicknameChangePointCost > 0
    ? nicknameChanged
      ? `本次修改昵称将扣除 ${nicknameChangePointCost} ${pointName}。${nicknameChangePriceDescription ? `${nicknameChangePriceDescription}。` : ""}昵称全站唯一。`
      : `修改昵称需消耗 ${nicknameChangePointCost} ${pointName}。${nicknameChangePriceDescription ? `${nicknameChangePriceDescription}。` : ""}昵称全站唯一。`
    : `${nicknameChangePriceDescription ? `${nicknameChangePriceDescription}，` : ""}昵称全站唯一，当前修改免费。`
  const introductionHint = introductionChangePointCost > 0
    ? introductionChanged
      ? `本次修改介绍将扣除 ${introductionChangePointCost} ${pointName}。${introductionChangePriceDescription ? `${introductionChangePriceDescription}。` : ""}支持 Markdown。`
      : `修改介绍需消耗 ${introductionChangePointCost} ${pointName}。${introductionChangePriceDescription ? `${introductionChangePriceDescription}。` : ""}支持 Markdown。`
    : `${introductionChangePriceDescription ? `${introductionChangePriceDescription}，` : ""}当前修改介绍免费，支持 Markdown。`
  const avatarHint = avatarChangePointCost > 0
    ? !hasSavedAvatar
      ? avatarChanged
        ? `这是你首次设置头像，本次保存免费。${avatarChangePriceDescription ? `${avatarChangePriceDescription}。` : ""}上传后需手动确认保存。`
        : `你还没有上传过头像，首次设置免费。${avatarChangePriceDescription ? `${avatarChangePriceDescription}。` : ""}上传后需手动确认保存。`
      : avatarRequiresPayment
        ? normalizedPendingAvatarPath
          ? `本次更换头像将扣除 ${avatarChangePointCost} ${pointName}。${avatarChangePriceDescription ? `${avatarChangePriceDescription}。` : ""}上传后需手动确认保存。`
          : `本次重置头像将扣除 ${avatarChangePointCost} ${pointName}。${avatarChangePriceDescription ? `${avatarChangePriceDescription}。` : ""}重置后会恢复默认头像。`
        : `更换头像或重置头像需消耗 ${avatarChangePointCost} ${pointName}。${avatarChangePriceDescription ? `${avatarChangePriceDescription}。` : ""}上传后需手动确认保存。`
    : `${avatarChangePriceDescription ? `${avatarChangePriceDescription}，` : ""}首次设置、更换头像和重置头像当前都免费。`
  const avatarRules = [
    avatarChangePointCost > 0
      ? `首次设置头像不需要消耗${pointName}，更换头像或重置头像会消耗 ${avatarChangePointCost} ${pointName}。`
      : `首次设置头像不需要消耗${pointName}，更换头像或重置头像当前也免费。`,
    "请不要上传涉及违法、暴力、色情、政治敏感等违规图片作为头像。",
    "若发现违规头像，将视情况做封禁账号处理。",
  ]

  useEffect(() => {
    setActiveSection(normalizedSections.includes(initialSection) ? initialSection : normalizedSections[0])
  }, [initialSection, normalizedSections])

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        revokeObjectUrl(previewBlobUrlRef.current)
      }

      if (cropSourceBlobUrlRef.current) {
        revokeObjectUrl(cropSourceBlobUrlRef.current)
      }
    }
  }, [])

  function updatePreviewUrl(nextUrl: string) {
    setPreviewUrl((current) => {
      if (current !== nextUrl) {
        revokeObjectUrl(current)
      }

      previewBlobUrlRef.current = nextUrl.startsWith("blob:") ? nextUrl : ""
      return nextUrl
    })
  }

  function updateCropSource(nextUrl: string, name = "", type = "") {
    setCropSourceUrl((current) => {
      if (current !== nextUrl) {
        revokeObjectUrl(current)
      }

      cropSourceBlobUrlRef.current = nextUrl.startsWith("blob:") ? nextUrl : ""
      return nextUrl
    })
    setCropSourceName(name)
    setCropSourceType(type)
  }

  function clearCropSource() {
    updateCropSource("")
    setCropSourceFile(null)
  }

  async function uploadAvatarFile(file: File) {
    const fallbackPreviewUrl = previewUrl || pendingAvatarPath || savedAvatarPath || initialAvatarPath || ""
    const nextPreviewUrl = URL.createObjectURL(file)

    updatePreviewUrl(nextPreviewUrl)
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
      setPendingAvatarPath(uploadedPath)
      updatePreviewUrl(uploadedPath || nextPreviewUrl)
      clearCropSource()
      toast.success("头像上传成功，请继续保存头像设置", "头像上传成功")
    } catch (error) {
      updatePreviewUrl(fallbackPreviewUrl)
      toast.error(error instanceof Error ? error.message : "头像上传失败", "头像上传失败")
      throw error
    } finally {
      setUploading(false)
    }
  }

  async function updateProfile(payload: {
    nickname?: string
    bio?: string
    introduction?: string
    gender?: string
    avatarPath?: string
    email?: string
    emailCode?: string
    activityVisibility?: UserProfileVisibility
    introductionVisibility?: UserProfileVisibility
  }) {
    const response = await fetch("/api/profile/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nickname: payload.nickname ?? nickname,
        bio: payload.bio ?? bio,
        introduction: payload.introduction ?? introduction,
        gender: payload.gender ?? gender,
        avatarPath: payload.avatarPath ?? savedAvatarPath,
        email: payload.email ?? email,
        emailCode: payload.emailCode ?? "",
        activityVisibility: payload.activityVisibility ?? activityVisibility,
        introductionVisibility: payload.introductionVisibility ?? introductionVisibility,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "保存失败")
    }

    return result
  }

  async function handleVisibilityChange(field: "activity" | "introduction", nextVisibility: UserProfileVisibility) {
    setPrivacySavingKey(field)

    try {
      const result = await updateProfile(field === "activity"
        ? { activityVisibility: nextVisibility }
        : { introductionVisibility: nextVisibility })
      setActivityVisibility(result.data?.activityVisibility ?? (field === "activity" ? nextVisibility : activityVisibility))
      setIntroductionVisibility(result.data?.introductionVisibility ?? (field === "introduction" ? nextVisibility : introductionVisibility))
      toast.success(result.message ?? "隐私设置已更新", "隐私设置")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "隐私设置保存失败", "隐私设置")
    } finally {
      setPrivacySavingKey(null)
    }
  }

  async function handleNicknameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!pendingNickname.trim()) {
      toast.warning("昵称不能为空", "修改昵称")
      return
    }

    setNicknameLoading(true)

    try {
      const result = await updateProfile({ nickname: pendingNickname })
      setNickname(result.data?.nickname ?? pendingNickname.trim())
      setPendingNickname(result.data?.nickname ?? pendingNickname.trim())
      setShowNicknameModal(false)
      toast.success(result.message ?? "昵称已更新", "修改昵称成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改失败", "修改昵称失败")
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

  async function handleIntroductionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIntroductionLoading(true)

    try {
      const result = await updateProfile({ introduction: pendingIntroduction })
      setIntroduction(result.data?.introduction ?? pendingIntroduction)
      setPendingIntroduction(result.data?.introduction ?? pendingIntroduction)
      setShowIntroductionModal(false)
      toast.success(result.message ?? "个人介绍已更新", "修改介绍成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改失败", "修改介绍失败")
    } finally {
      setIntroductionLoading(false)
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

    setCropSourceFile(file)
    updateCropSource(URL.createObjectURL(file), file.name, file.type)
    event.target.value = ""
  }

  async function handleAvatarCropConfirm(croppedFile: File) {
    await uploadAvatarFile(croppedFile)
  }

  async function handleAvatarOriginalUpload() {
    if (!cropSourceFile) {
      return
    }

    await uploadAvatarFile(cropSourceFile)
  }

  async function handleAvatarSave() {
    setAvatarSaving(true)

    try {
      const result = await updateProfile({ avatarPath: pendingAvatarPath })
      const nextAvatarPath = result.data?.avatarPath ?? pendingAvatarPath
      setSavedAvatarPath(nextAvatarPath)
      setPendingAvatarPath(nextAvatarPath)
      updatePreviewUrl(nextAvatarPath)
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
      {normalizedSections.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {normalizedSections.map((section) => (
            <SectionTab
              key={section}
              label={profileSectionLabels[section]}
              active={activeSection === section}
              onClick={() => setActiveSection(section)}
            />
          ))}
        </div>
      ) : null}

      {activeSection === "basic" ? (
        <form onSubmit={handleBasicSubmit} className="space-y-5">
          <div className="rounded-[24px]  bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">昵称</p>
                <p className="mt-2 text-lg font-semibold">{nickname}</p>
                <p className="mt-2 text-xs text-muted-foreground">{nicknameHint}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setShowNicknameModal(true)}>
                <PencilLine className="mr-2 h-4 w-4" />
                修改昵称
              </Button>
            </div>
          </div>

          <div className="rounded-[24px] bg-card p-5 space-y-4">
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
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-[180px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-hidden" placeholder="介绍一下你自己，最多 200 字" />
              <p className="text-xs text-muted-foreground">{bio.length}/200</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">个人介绍</p>
                  <p className="mt-2 text-xs text-muted-foreground">{introductionHint}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {introduction.trim() ? `当前已填写 ${introduction.length} 个字符。` : "当前还没有填写个人介绍。"}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setShowIntroductionModal(true)}>
                  <PencilLine className="mr-2 h-4 w-4" />
                  修改介绍
                </Button>
              </div>
            </div>
          </div>

          <Button disabled={profileLoading}>{profileLoading ? "保存中..." : "保存基础资料"}</Button>
        </form>
      ) : null}

      {activeSection === "avatar" ? (
        <div className="space-y-5 rounded-[24px]  bg-card p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <UserAvatar name={nickname || username} avatarPath={previewUrl || pendingAvatarPath || undefined} size="lg" />
                <div className="absolute -bottom-2 -right-2 rounded-full  bg-background p-2 shadow-xs">
                  {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </div>
              </div>
              <div>
                <p className="text-base font-semibold">当前头像</p>
                <p className="mt-2 text-sm text-muted-foreground">支持图片上传，先裁剪再上传，并在保存前预览最终效果。</p>
                <p className="mt-1 text-xs text-muted-foreground">{avatarHint}</p>
                <p className="mt-1 text-xs text-muted-foreground">建议使用清晰正方形头像，大小控制在 {normalizedAvatarMaxFileSizeMb}MB 以内。</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? "上传中..." : "选择头像"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingAvatarPath("")
                  updatePreviewUrl("")
                }}
                disabled={uploading || avatarSaving || (!normalizedPendingAvatarPath && !normalizedSavedAvatarPath)}
              >
                重置头像
              </Button>
              <Button type="button" onClick={handleAvatarSave} disabled={uploading || avatarSaving || !avatarChanged}>
                {avatarSaving ? "保存中..." : "保存头像"}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <AvatarPreviewCard label="大尺寸" size="lg" avatarPath={previewUrl || pendingAvatarPath || undefined} name={nickname || username} />
            <AvatarPreviewCard label="中尺寸" size="md" avatarPath={previewUrl || pendingAvatarPath || undefined} name={nickname || username} />
            <AvatarPreviewCard label="小尺寸" size="sm" avatarPath={previewUrl || pendingAvatarPath || undefined} name={nickname || username} />
          </div>
          <div className="rounded-[20px] border border-dashed border-border bg-background/60 p-4">
            <p className="text-sm font-medium">头像上传说明</p>
            <div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
              {avatarRules.map((rule, index) => (
                <p key={rule}>{index + 1}. {rule}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <AvatarCropModal
        key={cropSourceUrl || "avatar-crop-modal"}
        open={Boolean(cropSourceUrl)}
        imageSrc={cropSourceUrl}
        imageName={cropSourceName}
        imageType={cropSourceType}
        previewName={nickname || username}
        onClose={clearCropSource}
        onConfirm={handleAvatarCropConfirm}
        onUploadOriginal={handleAvatarOriginalUpload}
      />

      {activeSection === "email" ? (
        <form onSubmit={handleEmailSubmit} className="space-y-5 rounded-[24px] bg-card p-5">
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
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" disabled={emailVerified} placeholder="填写常用邮箱" />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={emailVerified ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-700" : "rounded-full bg-amber-100 px-3 py-1 text-amber-700"}>{emailVerified ? "已验证" : "未验证"}</span>
            {!emailVerified ? <Button type="button" variant="outline" onClick={handleSendEmailCode} disabled={sendingCode || !email}>{sendingCode ? "发送中..." : "发送邮箱验证码"}</Button> : null}
          </div>

          {!emailVerified ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">邮箱验证码</p>
              <input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" placeholder="输入收到的 6 位验证码" />
            </div>
          ) : null}

          <Button disabled={emailSaving}>{emailSaving ? "保存中..." : emailVerified ? "邮箱已验证" : "保存并验证邮箱"}</Button>
        </form>
      ) : null}

      {activeSection === "password" ? (
        <div className="rounded-[24px]  bg-card p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">密码修改</p>
              <p className="mt-1 text-xs text-muted-foreground">为确保账户安全，修改密码后建议重新登录并妥善保管新密码。</p>
            </div>
          </div>
          <PasswordChangeForm
            embedded
            requireEmailVerification={passwordChangeRequireEmailVerification}
            emailDeliveryEnabled={emailDeliveryEnabled}
            currentEmail={email}
            currentEmailVerified={emailVerified}
          />
        </div>
      ) : null}

      {activeSection === "privacy" ? (
        <div className="space-y-5 rounded-[24px] bg-card p-5">
          <div>
            <p className="text-sm font-medium">主页隐私</p>
            <p className="mt-1 text-xs text-muted-foreground">分别控制“活动轨迹”和“介绍”在主页上的可见范围，登录公开表示只有登录后才能查看。</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PrivacyVisibilityCard
              title="活动轨迹"
              description="控制主页里的最近帖子与最近回复。"
              value={activityVisibility}
              saving={privacySavingKey === "activity"}
              currentDescription={getActivityVisibilityDescription(activityVisibility)}
              onChange={(nextVisibility) => handleVisibilityChange("activity", nextVisibility)}
            />
            <PrivacyVisibilityCard
              title="介绍"
              description="控制主页里“介绍”标签的详细内容。"
              value={introductionVisibility}
              saving={privacySavingKey === "introduction"}
              currentDescription={getIntroductionVisibilityDescription(introductionVisibility)}
              onChange={(nextVisibility) => handleVisibilityChange("introduction", nextVisibility)}
            />
          </div>
        </div>
      ) : null}

      <Modal
        open={showNicknameModal}
        title="修改昵称"
        hideHeaderCloseButtonOnMobile
        description="昵称全站唯一，提交后会立即生效。"
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
            <p className="text-sm font-medium">昵称</p>
            <input value={pendingNickname} onChange={(event) => setPendingNickname(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" placeholder="输入新的昵称" />
          </div>
          <p className="text-xs text-muted-foreground">{nicknameHint}</p>
        </form>
      </Modal>

      <Modal
        open={showIntroductionModal}
        title="修改个人介绍"
        hideHeaderCloseButtonOnMobile
        description="个人介绍支持 Markdown，提交后会按当前身份即时结算。"
        onClose={() => {
          setPendingIntroduction(introduction)
          setShowIntroductionModal(false)
        }}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => {
              setPendingIntroduction(introduction)
              setShowIntroductionModal(false)
            }}>
              取消
            </Button>
            <Button type="submit" form="introduction-edit-form" disabled={introductionLoading}>
              {introductionLoading ? "保存中..." : "确认修改"}
            </Button>
          </div>
        }
      >
        <form id="introduction-edit-form" onSubmit={handleIntroductionSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">个人介绍</p>
            <span className="text-xs text-muted-foreground">{pendingIntroduction.length}/20000</span>
          </div>
          <AddonEditor
            context="profile"
            value={pendingIntroduction}
            onChange={setPendingIntroduction}
            minHeight={320}
            uploadFolder="profiles"
            markdownEmojiMap={markdownEmojiMap}
            markdownImageUploadEnabled={markdownImageUploadEnabled}
            placeholder="写一段更完整的自我介绍、经历、兴趣或作品清单。支持 Markdown 语法。"
          />
          <p className="text-xs text-muted-foreground">{introductionHint}</p>
        </form>
      </Modal>
    </div>
  )
}

function PrivacyVisibilityCard({
  title,
  description,
  value,
  saving,
  currentDescription,
  onChange,
}: {
  title: string
  description: string
  value: UserProfileVisibility
  saving: boolean
  currentDescription: string
  onChange: (nextVisibility: UserProfileVisibility) => void
}) {
  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="mt-4 rounded-[18px] border border-border/70 bg-card px-4 py-3">
        <p className="text-sm font-medium">当前：{visibilityLabelMap[value]}</p>
        <p className="mt-1 text-xs text-muted-foreground">{currentDescription}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {visibilityOptions.map((option) => {
          const active = option.value === value

          return (
            <Button
              key={option.value}
              type="button"
              variant={active ? "default" : "outline"}
              disabled={saving || active}
              onClick={() => onChange(option.value)}
              className="justify-center"
            >
              {saving && active ? "保存中..." : option.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function AvatarPreviewCard({
  label,
  size,
  avatarPath,
  name,
}: {
  label: string
  size: "lg" | "md" | "sm"
  avatarPath?: string
  name: string
}) {
  return (
    <div className="rounded-[20px] border border-border bg-background/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{size === "lg" ? "64px" : size === "md" ? "44px" : "36px"} 展示效果</p>
        </div>
        <UserAvatar name={name} avatarPath={avatarPath} size={size} />
      </div>
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
