import "server-only"
import { getAvatarUrl } from "./avatar"
import { executeAddonWaterfallHook } from "@/addons-host/runtime/hooks"

/**
 * 异步版：叠加 `user.avatar.url.value` waterfall hook，支持插件替换/代理头像 URL。
 * 仅可在 server component/server action/route handler 等 server-only 上下文使用，
 * 禁止被 client component 直接 import（会把 addons-host runtime 拉进客户端 bundle）。
 */
export async function getAvatarUrlWithAddons(
  avatarPath: string | null | undefined,
  name: string,
): Promise<string> {
  const base = getAvatarUrl(avatarPath, name)
  const { value } = await executeAddonWaterfallHook("user.avatar.url.value", base)
  return value
}