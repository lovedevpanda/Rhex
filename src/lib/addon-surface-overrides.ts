import "server-only"

import type { AddonSurfaceOverrideDescriptor } from "@/addons-host/types"
import { loadAddonsRegistry } from "@/addons-host/runtime/loader"

export async function listAddonSurfaceOverrideDescriptors(): Promise<
  AddonSurfaceOverrideDescriptor[]
> {
  return (await loadAddonsRegistry()).surfaceOverrideDescriptors
}
