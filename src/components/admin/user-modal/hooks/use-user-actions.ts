"use client"

import { useEffect, useState, useTransition } from "react"

import type { AdminUserDetailResult, AdminUserEditableProfile, AdminUserListItem } from "@/lib/admin-user-management"
import { normalizeConfigurableVipLevel } from "@/lib/vip-status"

import { buildFallbackProfile, parseResponse, toEditableScopes } from "@/components/admin/user-modal/hooks/utils"
import type {
  AccountFormState,
  OperationsFormState,
  PermissionsFormState,
  ProfileFormState,
} from "@/components/admin/user-modal/types"

function createInitialProfileState(user: AdminUserListItem): ProfileFormState {
  return {
    draft: buildFallbackProfile(user),
    feedback: "",
    adminNote: "",
    noteFeedback: "",
  }
}

function createInitialPermissionsState(user: AdminUserListItem): PermissionsFormState {
  return {
    message: "",
    feedback: "",
    scopeFeedback: "",
    zoneScopes: toEditableScopes(user.moderatedZoneScopes, "zoneId"),
    boardScopes: toEditableScopes(user.moderatedBoardScopes, "boardId"),
  }
}

function createInitialAccountState(): AccountFormState {
  return {
    statusMessage: "",
    statusFeedback: "",
    newPassword: "",
    confirmPassword: "",
    passwordMessage: "",
    passwordFeedback: "",
  }
}

function createInitialOperationsState(user: AdminUserListItem): OperationsFormState {
  return {
    points: String(user.points),
    pointsMessage: "",
    pointsFeedback: "",
    vipLevelDraft: String(normalizeConfigurableVipLevel(user.vipLevel, 1)),
    vipExpiresAtDraft: user.vipExpiresAt ? user.vipExpiresAt.slice(0, 16) : "",
    vipMessage: "",
    vipFeedback: "",
    badgeId: "",
    badgeMessage: "",
    badgeFeedback: "",
    notificationTitle: "",
    notificationContent: "",
    notificationMessage: "",
    notificationFeedback: "",
  }
}

export function useUserActions({
  user,
  detail,
  refreshData,
}: {
  user: AdminUserListItem
  detail: AdminUserDetailResult | null
  refreshData: () => void
}) {
  const [profileState, setProfileState] = useState<ProfileFormState>(() => createInitialProfileState(user))
  const [permissionsState, setPermissionsState] = useState<PermissionsFormState>(() => createInitialPermissionsState(user))
  const [accountState, setAccountState] = useState<AccountFormState>(createInitialAccountState)
  const [operationsState, setOperationsState] = useState<OperationsFormState>(() => createInitialOperationsState(user))
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const sourceUser = detail ?? user
    const nextGrantedBadgeIds = new Set(detail?.grantedBadges.map((item) => item.badgeId) ?? [])
    const nextDefaultBadgeId = detail?.availableBadges.find((item) => !nextGrantedBadgeIds.has(item.id))?.id ?? ""
    const timer = window.setTimeout(() => {
      setProfileState((current) => ({
        ...current,
        draft: detail?.editableProfile ?? buildFallbackProfile(user),
      }))
      setPermissionsState((current) => ({
        ...current,
        zoneScopes: toEditableScopes(sourceUser.moderatedZoneScopes, "zoneId"),
        boardScopes: toEditableScopes(sourceUser.moderatedBoardScopes, "boardId"),
      }))
      setOperationsState((current) => ({
        ...current,
        points: String(sourceUser.points),
        vipLevelDraft: String(normalizeConfigurableVipLevel(sourceUser.vipLevel, 1)),
        vipExpiresAtDraft: sourceUser.vipExpiresAt ? sourceUser.vipExpiresAt.slice(0, 16) : "",
        badgeId: current.badgeId && !nextGrantedBadgeIds.has(current.badgeId) ? current.badgeId : nextDefaultBadgeId,
      }))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [detail, user])

  async function submitAdminAction(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = await parseResponse<null>(response)
    return {
      ok: response.ok,
      message: result?.message ?? (response.ok ? "操作成功" : "操作失败"),
    }
  }

  function saveProfile() {
    setProfileState((current) => ({ ...current, feedback: "" }))
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.profile.update",
        targetId: String(user.id),
        message: "后台更新用户基础资料",
        ...profileState.draft,
      })

      setProfileState((current) => ({ ...current, feedback: result.message }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function saveNote() {
    setProfileState((current) => ({ ...current, noteFeedback: "" }))
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.profile.note",
        targetId: String(user.id),
        message: profileState.adminNote,
      })

      setProfileState((current) => ({
        ...current,
        adminNote: result.ok ? "" : current.adminNote,
        noteFeedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function saveModeratorScopes() {
    setPermissionsState((current) => ({ ...current, scopeFeedback: "" }))
    startTransition(async () => {
      const response = await fetch("/api/admin/moderator-scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          zoneScopes: permissionsState.zoneScopes.map((scope) => ({
            zoneId: scope.id,
            canEditSettings: scope.canEditSettings,
            canWithdrawTreasury: scope.canWithdrawTreasury,
          })),
          boardScopes: permissionsState.boardScopes.map((scope) => ({
            boardId: scope.id,
            canEditSettings: scope.canEditSettings,
            canWithdrawTreasury: scope.canWithdrawTreasury,
          })),
        }),
      })
      const result = await parseResponse<null>(response)

      setPermissionsState((current) => ({
        ...current,
        scopeFeedback: result?.message ?? (response.ok ? "版主管辖范围已保存" : "保存失败"),
      }))
      if (response.ok) {
        refreshData()
      }
    })
  }

  function runPermissionAction(action: string, confirmText?: string) {
    setPermissionsState((current) => ({ ...current, feedback: "" }))
    if (confirmText && typeof window !== "undefined" && !window.confirm(confirmText)) {
      return
    }

    startTransition(async () => {
      const result = await submitAdminAction({
        action,
        targetId: String(user.id),
        message: permissionsState.message,
      })

      setPermissionsState((current) => ({
        ...current,
        message: result.ok ? "" : current.message,
        feedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function runStatusAction(action: string, confirmText?: string) {
    setAccountState((current) => ({ ...current, statusFeedback: "" }))
    if (confirmText && typeof window !== "undefined" && !window.confirm(confirmText)) {
      return
    }

    startTransition(async () => {
      const result = await submitAdminAction({
        action,
        targetId: String(user.id),
        message: accountState.statusMessage,
      })

      setAccountState((current) => ({
        ...current,
        statusMessage: result.ok ? "" : current.statusMessage,
        statusFeedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function saveVip() {
    setOperationsState((current) => ({ ...current, vipFeedback: "" }))
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.vip.configure",
        targetId: String(user.id),
        vipLevel: normalizeConfigurableVipLevel(Number(operationsState.vipLevelDraft), 1),
        vipExpiresAt: operationsState.vipExpiresAtDraft || null,
        message: operationsState.vipMessage,
      })

      setOperationsState((current) => ({
        ...current,
        vipMessage: result.ok ? "" : current.vipMessage,
        vipFeedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function savePassword() {
    setAccountState((current) => ({ ...current, passwordFeedback: "" }))

    if (!accountState.newPassword || !accountState.confirmPassword) {
      setAccountState((current) => ({ ...current, passwordFeedback: "请完整填写新密码与确认密码" }))
      return
    }
    if (accountState.newPassword !== accountState.confirmPassword) {
      setAccountState((current) => ({ ...current, passwordFeedback: "两次输入的新密码不一致" }))
      return
    }
    if (accountState.newPassword.length < 6 || accountState.newPassword.length > 64) {
      setAccountState((current) => ({ ...current, passwordFeedback: "新密码长度需为 6-64 位" }))
      return
    }

    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.password.update",
        targetId: String(user.id),
        newPassword: accountState.newPassword,
        message: accountState.passwordMessage,
      })

      setAccountState((current) => ({
        ...current,
        newPassword: result.ok ? "" : current.newPassword,
        confirmPassword: result.ok ? "" : current.confirmPassword,
        passwordMessage: result.ok ? "" : current.passwordMessage,
        passwordFeedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function savePoints() {
    setOperationsState((current) => ({ ...current, pointsFeedback: "" }))
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.points.adjust",
        targetId: String(user.id),
        message: operationsState.pointsMessage,
        points: Number(operationsState.points) || 0,
      })

      setOperationsState((current) => ({
        ...current,
        pointsMessage: result.ok ? "" : current.pointsMessage,
        pointsFeedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function grantBadge() {
    setOperationsState((current) => ({ ...current, badgeFeedback: "" }))
    if (!operationsState.badgeId) {
      setOperationsState((current) => ({ ...current, badgeFeedback: "请先选择要颁发的勋章" }))
      return
    }

    const selectedBadge = detail?.availableBadges.find((item) => item.id === operationsState.badgeId)
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.badge.grant",
        targetId: String(user.id),
        badgeId: operationsState.badgeId,
        badgeName: selectedBadge?.name ?? "",
        message: operationsState.badgeMessage,
      })

      setOperationsState((current) => ({
        ...current,
        badgeMessage: result.ok ? "" : current.badgeMessage,
        badgeFeedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  function sendNotification() {
    setOperationsState((current) => ({ ...current, notificationFeedback: "" }))
    if (!operationsState.notificationTitle.trim()) {
      setOperationsState((current) => ({ ...current, notificationFeedback: "请填写通知标题" }))
      return
    }
    if (!operationsState.notificationContent.trim()) {
      setOperationsState((current) => ({ ...current, notificationFeedback: "请填写通知内容" }))
      return
    }

    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.notification.send",
        targetId: String(user.id),
        title: operationsState.notificationTitle,
        content: operationsState.notificationContent,
        message: operationsState.notificationMessage,
      })

      setOperationsState((current) => ({
        ...current,
        notificationTitle: result.ok ? "" : current.notificationTitle,
        notificationContent: result.ok ? "" : current.notificationContent,
        notificationMessage: result.ok ? "" : current.notificationMessage,
        notificationFeedback: result.message,
      }))
      if (result.ok) {
        refreshData()
      }
    })
  }

  return {
    isPending,
    profile: {
      state: profileState,
      setField: (field: keyof AdminUserEditableProfile, value: string) => {
        setProfileState((current) => ({
          ...current,
          draft: {
            ...current.draft,
            [field]: value,
          },
        }))
      },
      setAdminNote: (value: string) => {
        setProfileState((current) => ({ ...current, adminNote: value }))
      },
      saveProfile,
      saveNote,
    },
    permissions: {
      state: permissionsState,
      setMessage: (value: string) => {
        setPermissionsState((current) => ({ ...current, message: value }))
      },
      runPermissionAction,
      saveModeratorScopes,
      toggleZoneScope: (id: string) => {
        setPermissionsState((current) => ({
          ...current,
          zoneScopes: current.zoneScopes.some((item) => item.id === id)
            ? current.zoneScopes.filter((item) => item.id !== id)
            : [...current.zoneScopes, { id, canEditSettings: false, canWithdrawTreasury: true }],
        }))
      },
      toggleZoneScopeEdit: (id: string) => {
        setPermissionsState((current) => ({
          ...current,
          zoneScopes: current.zoneScopes.map((item) => item.id === id ? { ...item, canEditSettings: !item.canEditSettings } : item),
        }))
      },
      toggleZoneScopeWithdraw: (id: string) => {
        setPermissionsState((current) => ({
          ...current,
          zoneScopes: current.zoneScopes.map((item) => item.id === id ? { ...item, canWithdrawTreasury: !item.canWithdrawTreasury } : item),
        }))
      },
      toggleBoardScope: (id: string) => {
        setPermissionsState((current) => ({
          ...current,
          boardScopes: current.boardScopes.some((item) => item.id === id)
            ? current.boardScopes.filter((item) => item.id !== id)
            : [...current.boardScopes, { id, canEditSettings: false, canWithdrawTreasury: true }],
        }))
      },
      toggleBoardScopeEdit: (id: string) => {
        setPermissionsState((current) => ({
          ...current,
          boardScopes: current.boardScopes.map((item) => item.id === id ? { ...item, canEditSettings: !item.canEditSettings } : item),
        }))
      },
      toggleBoardScopeWithdraw: (id: string) => {
        setPermissionsState((current) => ({
          ...current,
          boardScopes: current.boardScopes.map((item) => item.id === id ? { ...item, canWithdrawTreasury: !item.canWithdrawTreasury } : item),
        }))
      },
    },
    account: {
      state: accountState,
      setStatusMessage: (value: string) => {
        setAccountState((current) => ({ ...current, statusMessage: value }))
      },
      runStatusAction,
      setNewPassword: (value: string) => {
        setAccountState((current) => ({ ...current, newPassword: value }))
      },
      setConfirmPassword: (value: string) => {
        setAccountState((current) => ({ ...current, confirmPassword: value }))
      },
      setPasswordMessage: (value: string) => {
        setAccountState((current) => ({ ...current, passwordMessage: value }))
      },
      savePassword,
    },
    operations: {
      state: operationsState,
      setPoints: (value: string) => {
        setOperationsState((current) => ({ ...current, points: value }))
      },
      setPointsMessage: (value: string) => {
        setOperationsState((current) => ({ ...current, pointsMessage: value }))
      },
      savePoints,
      setVipLevelDraft: (value: string) => {
        setOperationsState((current) => ({ ...current, vipLevelDraft: value }))
      },
      setVipExpiresAtDraft: (value: string) => {
        setOperationsState((current) => ({ ...current, vipExpiresAtDraft: value }))
      },
      setVipMessage: (value: string) => {
        setOperationsState((current) => ({ ...current, vipMessage: value }))
      },
      saveVip,
      setBadgeId: (value: string) => {
        setOperationsState((current) => ({ ...current, badgeId: value }))
      },
      setBadgeMessage: (value: string) => {
        setOperationsState((current) => ({ ...current, badgeMessage: value }))
      },
      grantBadge,
      setNotificationTitle: (value: string) => {
        setOperationsState((current) => ({ ...current, notificationTitle: value }))
      },
      setNotificationContent: (value: string) => {
        setOperationsState((current) => ({ ...current, notificationContent: value }))
      },
      setNotificationMessage: (value: string) => {
        setOperationsState((current) => ({ ...current, notificationMessage: value }))
      },
      sendNotification,
    },
  }
}

export type UserActionsState = ReturnType<typeof useUserActions>
