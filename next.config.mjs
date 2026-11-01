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
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  assetPrefix,
  ...(deploymentId ? {
    deploymentId,
    generateBuildId: async () => deploymentId,
  } : {}),
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "media-src 'self' https:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "connect-src 'self' https: wss:",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
        ],
      },
    ]
  },
  serverExternalPackages: ["@napi-rs/canvas", "ioredis", "ip2region", "nodemailer"],
  experimental: {
    serverSourceMaps: false,
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
