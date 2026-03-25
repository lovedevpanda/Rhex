export function buildPluginAssetUrl(pluginId: string, assetPath: string) {
  const normalizedPluginId = String(pluginId).trim()
  const normalizedPath = String(assetPath).replace(/^\/+/, "")

  return `/api/plugins/${encodeURIComponent(normalizedPluginId)}/assets/${normalizedPath}`
}

export function createPluginAssetUrlBuilder(pluginId: string) {
  return (assetPath: string) => buildPluginAssetUrl(pluginId, assetPath)
}

