import type { ReactNode } from "react"

export type PluginScope = "game" | "commerce" | "content" | "integration" | "other"

export type PluginRuntimeStatus = "discovered" | "active" | "disabled" | "error"

export interface PluginConfigField {
  key: string
  label: string
  description?: string
  type: "boolean" | "number" | "text"
  min?: number
  max?: number
  step?: number
  required?: boolean
  defaultValue: boolean | number | string
}

export interface PluginManifest {
  id: string
  slug: string
  packageName: string
  displayName: string
  version: string
  description: string
  author?: string
  hostVersionRange?: string
  scope: PluginScope
  uninstallStrategy: "soft" | "archive"
  entry: {
    server: string
    web?: string
    admin?: string
    sidebar?: string
  }

  publicDir?: string
  capabilities: {
    publicPage?: boolean
    adminPage?: boolean
    points?: boolean
    migrations?: boolean
  }
  pointsIntegration?: {
    enabled: boolean
    ticketKey?: string
    rewardKey?: string
  }
  configSchema: PluginConfigField[]
}

export interface PluginInstallRecord {
  pluginId: string
  enabled: boolean
  installedAt: string | null
  uninstalledAt: string | null
  config: Record<string, boolean | number | string>
}

export interface PluginLifecycleRecord extends PluginInstallRecord {
  status: PluginRuntimeStatus
  version: string | null
  sourceDir: string | null
  lastActivatedAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  failureCount: number
}

export interface HostPointApi {
  charge(input: { pluginId: string; userId: number }): Promise<{ charged: boolean; amount: number }>
  reward(input: { pluginId: string; userId: number }): Promise<{ rewarded: boolean; amount: number }>
}

export interface PluginRuntimeContext {
  points: HostPointApi
}

export interface PluginApiHandlers {
  GET?: (request: Request, context?: { pluginId: string; admin?: boolean }) => Promise<Response> | Response
  POST?: (request: Request, context?: { pluginId: string; admin?: boolean }) => Promise<Response> | Response
}

export interface PluginApiModule {
  handleGet?: PluginApiHandlers["GET"]
  handlePost?: PluginApiHandlers["POST"]
  handleAdminGet?: PluginApiHandlers["GET"]
  handleAdminPost?: PluginApiHandlers["POST"]
  resolveSidebarData?: (context: SidebarPluginRenderContext) => Promise<unknown> | unknown
  [key: string]: unknown
}

export type SidebarPluginSlot = "home-right-top" | "home-right-middle" | "home-right-bottom"

export interface SidebarPluginRenderContext {
  pluginId: string
  config: Record<string, boolean | number | string>
}

export type SidebarPluginComponent = (props: { pluginId: string; config: Record<string, boolean | number | string>; panelData: unknown }) => Promise<ReactNode> | ReactNode

export interface SidebarPluginDefinition {
  slot: SidebarPluginSlot
  order: number
  component?: SidebarPluginComponent
  resolveData?: (context: SidebarPluginRenderContext) => Promise<unknown> | unknown
}

export interface PluginServerDefinition {
  getDefaultConfig: () => Record<string, boolean | number | string>
}

export interface PluginPageProps {
  pluginId: string
  config: Record<string, boolean | number | string>
  [key: string]: unknown
}

export type PluginPageComponent = (props: PluginPageProps) => Promise<ReactNode> | ReactNode
