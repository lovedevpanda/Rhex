"use client"

import { AdminUserActionButton } from "@/components/admin-user-action-button"

interface AdminUserStatusToggleProps {
  userId: number
  action: "user.activate" | "user.vip"
  label: string
}

export function AdminUserStatusToggle({ userId, action, label }: AdminUserStatusToggleProps) {
  return <AdminUserActionButton userId={userId} action={action} label={label} />
}
