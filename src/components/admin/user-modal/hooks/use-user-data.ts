"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import type { AdminUserDetailResult, AdminUserListItem } from "@/lib/admin-user-management"
import { formatDateTime } from "@/lib/formatters"
import { isVipActive } from "@/lib/vip-status"

import { parseResponse } from "@/components/admin/user-modal/hooks/utils"
import type { AdminUserMetricItem, AdminUserModalTab, UserModalDataState } from "@/components/admin/user-modal/types"

export function useUserData({
  user,
  initialTab,
}: {
  user: AdminUserListItem
  initialTab: AdminUserModalTab
}): UserModalDataState {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AdminUserModalTab>(initialTab)
  const [detail, setDetail] = useState<AdminUserDetailResult | null>(null)
  const [detailError, setDetailError] = useState("")
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const activeUser = detail ?? user
  const vipActive = isVipActive({ vipLevel: activeUser.vipLevel, vipExpiresAt: activeUser.vipExpiresAt })
  const isModerator = activeUser.role === "MODERATOR"

  const metrics = useMemo<AdminUserMetricItem[]>(
    () => [
      { label: "UID", value: String(activeUser.id) },
      { label: "角色", value: activeUser.role },
      { label: "状态", value: activeUser.status },
      { label: "等级", value: `Lv.${activeUser.level}` },
      { label: "积分", value: String(activeUser.points) },
      { label: "发帖", value: String(activeUser.postCount) },
      { label: "评论", value: String(activeUser.commentCount) },
      { label: "获赞", value: String(activeUser.likeReceivedCount) },
      { label: "收藏", value: String(activeUser.favoriteCount) },
      { label: "签到天数", value: String(activeUser.checkInDays) },
      { label: "邀请数", value: String(activeUser.inviteCount) },
      { label: "邮箱", value: activeUser.email ?? "-" },
      { label: "手机", value: activeUser.phone ?? "-" },
      { label: "注册时间", value: formatDateTime(activeUser.createdAt) },
      { label: "最近登录", value: activeUser.lastLoginAt ? formatDateTime(activeUser.lastLoginAt) : "-" },
      { label: "登录 IP", value: activeUser.lastLoginIp ?? "-" },
      { label: "VIP", value: vipActive ? `VIP${activeUser.vipLevel}` : "非 VIP" },
      { label: "VIP 到期", value: activeUser.vipExpiresAt ? formatDateTime(activeUser.vipExpiresAt) : "长期 / 无" },
      { label: "邀请人", value: activeUser.inviterName ?? "-" },
    ],
    [activeUser, vipActive],
  )

  const grantableBadges = useMemo(() => {
    if (!detail) {
      return []
    }

    const grantedBadgeIds = new Set(detail.grantedBadges.map((item) => item.badgeId))
    return detail.availableBadges.filter((item) => !grantedBadgeIds.has(item.id))
  }, [detail])

  const loadDetail = useCallback(async () => {
    setIsLoadingDetail(true)
    setDetailError("")

    const response = await fetch(`/api/admin/users/detail?userId=${user.id}`, {
      method: "GET",
      cache: "no-store",
    })
    const result = await parseResponse<AdminUserDetailResult>(response)

    if (!response.ok || !result?.data) {
      setDetailError(result?.message ?? "加载用户详情失败")
      setIsLoadingDetail(false)
      return
    }

    setDetail(result.data)
    setIsLoadingDetail(false)
  }, [user.id])

  const refreshData = useCallback(() => {
    router.refresh()
    void loadDetail()
  }, [loadDetail, router])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  return {
    activeTab,
    detail,
    detailError,
    isLoadingDetail,
    activeUser,
    vipActive,
    isModerator,
    metrics,
    grantableBadges,
    setActiveTab,
    reloadDetail: () => {
      void loadDetail()
    },
    refreshData,
  }
}
