import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const isProductionBuild = process.env.NODE_ENV === "production"
const normalizeAssetPrefix = (value) => {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return undefined
  }

  return trimmedValue.replace(/\/+$/, "")
}
const assetPrefix = isProductionBuild
  ? normalizeAssetPrefix(process.env.NEXT_ASSET_PREFIX)
  : undefined
const deploymentId = process.env.NEXT_DEPLOYMENT_ID?.trim() || process.env.GITHUB_SHA?.trim() || undefined

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.50.207", "*.yuminga.com", "localhost"],
  assetPrefix,
  ...(deploymentId ? {
    deploymentId,
    generateBuildId: async () => deploymentId,
  } : {}),
  reactStrictMode: true,
  productionBrowserSourceMaps:false,
  typescript: {
    ignoreBuildErrors: isProductionBuild,
  },
  serverExternalPackages: ["@napi-rs/canvas", "ioredis", "ip2region", "nodemailer"],
  experimental: {
    serverSourceMaps:false,
    proxyClientMaxBodySize: "64mb",
    staticGenerationRetryCount: 1,
    staticGenerationMaxConcurrency: 4,
    staticGenerationMinPagesPerWorker: 25,
  },
  turbopack: {
    root: projectRoot,
  }
}

export default nextConfig
