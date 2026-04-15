import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps:false,
  serverExternalPackages: ["@napi-rs/canvas", "ioredis", "nodemailer"],
  experimental: {
    serverSourceMaps:false,
    proxyClientMaxBodySize: "64mb",
  },
  turbopack: {
    root: projectRoot,
  }
}

export default nextConfig
