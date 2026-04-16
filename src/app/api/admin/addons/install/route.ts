import { apiError, apiSuccess, createAdminRouteHandler } from "@/lib/api-route"
import { installAddonFromZip } from "@/addons-host/installer"
import { getAddonsAdminData } from "@/addons-host/management"

export const dynamic = "force-dynamic"

function parseBooleanField(value: FormDataEntryValue | null, fallback: boolean) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (["true", "1", "on", "yes"].includes(normalized)) {
    return true
  }
  if (["false", "0", "off", "no"].includes(normalized)) {
    return false
  }

  return fallback
}

export const POST = createAdminRouteHandler(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    apiError(400, "请上传插件 zip 文件")
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    apiError(400, "只支持上传 .zip 插件包")
  }

  const installed = await installAddonFromZip({
    zipBuffer: Buffer.from(await file.arrayBuffer()),
    originalName: file.name,
    replaceExisting: parseBooleanField(formData.get("replaceExisting"), false),
    enableAfterInstall: parseBooleanField(formData.get("enableAfterInstall"), true),
  })

  return apiSuccess(
    await getAddonsAdminData(),
    installed.replacedExisting
      ? `已覆盖安装插件 ${installed.name}`
      : `已安装插件 ${installed.name}`,
  )
}, {
  errorMessage: "插件安装失败",
  logPrefix: "[api/admin/addons/install:POST] unexpected error",
  unauthorizedMessage: "无权安装插件",
})
