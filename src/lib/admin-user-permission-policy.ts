import { UserRole } from "@/db/types"

export interface AdminRoleChangePolicyInput {
  actorId: number
  targetId: number
  targetRole: UserRole
  nextRole: UserRole
  actorIsFounder: boolean
  actorCanManageAdmins?: boolean
  actorCanManageFounder?: boolean
  targetIsFounder?: boolean
}

export function getBlockedAdminRoleChangeMessage(input: AdminRoleChangePolicyInput) {
  if (input.actorId === input.targetId) {
    return "\u4e0d\u80fd\u4fee\u6539\u5f53\u524d\u767b\u5f55\u7ba1\u7406\u5458\u7684\u7528\u6237\u7ec4"
  }

  if (input.targetIsFounder && !(input.actorIsFounder || input.actorCanManageFounder)) {
    return "不能调整超级管理员账号"
  }

  if (
    input.targetRole === UserRole.ADMIN
    && input.nextRole !== UserRole.ADMIN
    && !(input.actorIsFounder || input.actorCanManageAdmins)
  ) {
    return "不能降级管理员账号"
  }

  if (input.nextRole === UserRole.ADMIN && !(input.actorIsFounder || input.actorCanManageAdmins)) {
    return "不能提升管理员账号"
  }

  return null
}
