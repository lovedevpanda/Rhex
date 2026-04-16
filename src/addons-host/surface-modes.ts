import type { AddonSurfaceKey } from "@/addons-host/types"

export type AddonSurfaceExecutionMode = "server" | "client" | "hybrid"

const CLIENT_ONLY_ADDON_SURFACES = new Set<AddonSurfaceKey>([
  "collection.content",
  "collection.hero",
  "collection.pending",
  "comment.author.badges",
  "comment.author.meta",
  "comment.author.name",
  "comment.author.row",
  "comment.author.verification",
  "history.panel",
  "messages.header",
  "messages.sidebar",
  "messages.thread",
  "post.create.editor",
  "post.create.enhancements",
  "post.create.form",
  "post.create.submit",
  "post.create.tools",
  "settings.content",
])

const HYBRID_ADDON_SURFACES = new Set<AddonSurfaceKey>([
  "messages.page",
  "settings.page",
])

export function getAddonSurfaceExecutionMode(
  surface: AddonSurfaceKey,
): AddonSurfaceExecutionMode {
  if (CLIENT_ONLY_ADDON_SURFACES.has(surface)) {
    return "client"
  }

  if (HYBRID_ADDON_SURFACES.has(surface)) {
    return "hybrid"
  }

  return "server"
}

export function isAddonClientOnlySurface(surface: AddonSurfaceKey) {
  return getAddonSurfaceExecutionMode(surface) === "client"
}
