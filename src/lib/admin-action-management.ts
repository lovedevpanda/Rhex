import { apiError } from "@/lib/api-route"
import { adminModerationActionHandlers } from "@/lib/admin-moderation-actions"
import { adminPostActionHandlers } from "@/lib/admin-post-actions"
import { adminReportActionHandlers } from "@/lib/admin-report-actions"
import { type AdminActionContext, revalidateAdminMutationPaths, type AdminActionDefinition } from "@/lib/admin-action-types"
import { adminUserActionHandlers } from "@/lib/admin-user-actions"

const adminActionHandlers: Record<string, AdminActionDefinition> = {
  ...adminUserActionHandlers,
  ...adminPostActionHandlers,
  ...adminModerationActionHandlers,
  ...adminReportActionHandlers,
}

export async function executeAdminAction(context: AdminActionContext) {
  const definition = adminActionHandlers[context.action]
  if (!definition) {
    apiError(400, "暂不支持该操作")
  }

  const result = await definition.execute(context)
  const revalidatePaths = result.revalidatePaths ?? definition.metadata.revalidatePaths
  if (revalidatePaths?.length) {
    revalidateAdminMutationPaths(revalidatePaths)
  }
  return result
}
