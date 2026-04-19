/**
 * @file execution-context.ts
 * @responsibility buildAddonExecutionContext —— 为 addon 执行态注入各 Facade
 *   (posts/comments/messages/notifications/follows/points/config/secrets/data 等)
 * @scope Phase B.7 抽出自 runtime/loader.ts L501-L852；各 Facade 实现已在 runtime/{posts,comments,...}.ts
 * @depends-on ../fs, ../config, ../secrets, ../permissions, ../background-jobs,
 *             @/lib/auth, @/lib/site-settings, @/lib/background-job-scheduler,
 *             @/db/addon-registry-queries, ./board-select, ./execution-facades
 * @exports buildAddonExecutionContext
 */

import { promises as fs } from "node:fs"

import {
  normalizeMountedAddonPath,
  readJsonFile,
  resolveSafeAddonChildPath,
} from "@/addons-host/runtime/fs"
import { readAddonConfigValue, writeAddonConfigValue } from "@/addons-host/runtime/config"
import { addonHasPermission } from "@/addons-host/runtime/permissions"
import { readAddonSecretValue, writeAddonSecretValue } from "@/addons-host/runtime/secrets"
import {
  enqueueAddonBackgroundJob,
  removeAddonBackgroundJob,
} from "@/addons-host/runtime/background-jobs"
import { getSessionActorFromRequest } from "@/lib/auth"
import {
  cancelScheduledBackgroundJob,
  ensureScheduledBackgroundJob,
  inspectScheduledJobState,
} from "@/lib/background-job-scheduler"
import { getSiteSettings as getPublicSiteSettings } from "@/lib/site-settings"
import { createAddonLifecycleLog } from "@/db/addon-registry-queries"
import {
  addonServerUi,
  addonServerIcons,
  renderToHtml as renderAddonElementToHtml,
  cn as addonServerCn,
} from "@/addons-host/sdk/server-ui"
import type {
  AddonBoardSelectGroup,
  AddonExecutionContextBase,
  LoadedAddonRuntime,
} from "@/addons-host/types"

import { loadAddonBoardSelectOptions } from "./board-select"
import { buildAddonDomainFacades } from "./execution-facades"

export function buildAddonExecutionContext(addon: LoadedAddonRuntime, input?: {
  request?: Request
  pathname?: string
  searchParams?: URLSearchParams
}): AddonExecutionContextBase {
  const permissionSet = addon.permissionSet
  let currentUserPromise: ReturnType<typeof getSessionActorFromRequest> | undefined
  let siteSettingsPromise: ReturnType<typeof getPublicSiteSettings> | undefined
  let boardSelectOptionsPromise: Promise<AddonBoardSelectGroup[]> | undefined
  const assertRuntimePermission = (permission: string, message?: string) => {
    if (!addonHasPermission(permissionSet, permission)) {
      void createAddonLifecycleLog({
        addonId: addon.manifest.id,
        action: "PERMISSION_DENIED",
        status: "FAILED",
        message:
          message
          || `addon "${addon.manifest.id}" requires permission "${permission}"`,
        metadataJson: {
          permission,
          pathname: input?.pathname ?? null,
        },
      })

      throw new Error(
        message
          || `addon "${addon.manifest.id}" requires permission "${permission}"`,
      )
    }
  }

  return {
    manifest: addon.manifest,
    state: addon.state,
    enabled: addon.enabled,
    rootDir: addon.rootDir,
    assetRootDir: addon.assetRootDir,
    assetBaseUrl: addon.assetBaseUrl,
    publicBaseUrl: addon.publicBaseUrl,
    adminBaseUrl: addon.adminBaseUrl,
    publicApiBaseUrl: addon.publicApiBaseUrl,
    adminApiBaseUrl: addon.adminApiBaseUrl,
    request: input?.request,
    pathname: input?.pathname,
    searchParams: input?.searchParams,
    permissions: [...addon.resolvedPermissions],
    hasPermission: (permission: string) => addonHasPermission(permissionSet, permission),
    assertPermission: assertRuntimePermission,
    ui: addonServerUi,
    icons: addonServerIcons,
    cn: addonServerCn,
    renderToHtml: renderAddonElementToHtml,
    getCurrentUser: () => {
      if (!currentUserPromise) {
        currentUserPromise = getSessionActorFromRequest(input?.request)
      }

      return currentUserPromise
    },
    getSiteSettings: () => {
      if (!siteSettingsPromise) {
        siteSettingsPromise = getPublicSiteSettings()
      }

      return siteSettingsPromise
    },
    getBoardSelectOptions: () => {
      if (!boardSelectOptionsPromise) {
        boardSelectOptionsPromise = loadAddonBoardSelectOptions()
      }

      return boardSelectOptionsPromise
    },
    asset: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.assetBaseUrl}/${relativePath}` : addon.assetBaseUrl
    },
    publicPage: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.publicBaseUrl}/${relativePath}` : addon.publicBaseUrl
    },
    adminPage: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.adminBaseUrl}/${relativePath}` : addon.adminBaseUrl
    },
    publicApi: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.publicApiBaseUrl}/${relativePath}` : addon.publicApiBaseUrl
    },
    adminApi: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.adminApiBaseUrl}/${relativePath}` : addon.adminApiBaseUrl
    },
    readAssetText: async (targetPath: string) => {
      const filePath = await resolveSafeAddonChildPath(addon.assetRootDir, targetPath)
      return fs.readFile(filePath, "utf8")
    },
    readAssetJson: async <T = unknown>(targetPath: string) => {
      const filePath = await resolveSafeAddonChildPath(addon.assetRootDir, targetPath)
      return readJsonFile<T>(filePath)
    },
    readConfig: async <T = unknown>(configKey: string, fallback?: T) => {
      assertRuntimePermission(
        "config:read",
        `addon "${addon.manifest.id}" is not allowed to read config`,
      )
      return readAddonConfigValue<T>(addon.manifest.id, configKey, fallback)
    },
    writeConfig: async <T = unknown>(configKey: string, value: T) => {
      assertRuntimePermission(
        "config:write",
        `addon "${addon.manifest.id}" is not allowed to write config`,
      )
      const previousValue = await readAddonConfigValue(
        addon.manifest.id,
        configKey,
      )
      const { executeAddonActionHook } = await import("@/addons-host/runtime/hooks")
      await executeAddonActionHook("addon.config.changed.before", {
        addonId: addon.manifest.id,
        configKey,
        previousValue,
        value,
      }, {
        request: input?.request,
        pathname: input?.pathname,
        searchParams: input?.searchParams,
        throwOnError: true,
      })
      await writeAddonConfigValue(addon.manifest.id, configKey, value)
      await executeAddonActionHook("addon.config.changed.after", {
        addonId: addon.manifest.id,
        configKey,
        previousValue,
        value,
      }, {
        request: input?.request,
        pathname: input?.pathname,
        searchParams: input?.searchParams,
      })
    },
    readSecret: async <T = unknown>(secretKey: string, fallback?: T) => {
      assertRuntimePermission(
        "secret:read",
        `addon "${addon.manifest.id}" is not allowed to read secrets`,
      )
      return readAddonSecretValue<T>(addon.manifest.id, secretKey, fallback)
    },
    writeSecret: async <T = unknown>(secretKey: string, value: T) => {
      assertRuntimePermission(
        "secret:write",
        `addon "${addon.manifest.id}" is not allowed to write secrets`,
      )
      await writeAddonSecretValue(addon.manifest.id, secretKey, value)
    },
    backgroundJobs: {
      enqueue: async (jobKey, payload, options) => {
        assertRuntimePermission(
          "background-job:enqueue",
          `addon "${addon.manifest.id}" is not allowed to enqueue background jobs`,
        )
        return enqueueAddonBackgroundJob(addon, jobKey, payload, options)
      },
      remove: async (jobId) => {
        assertRuntimePermission(
          "background-job:delete",
          `addon "${addon.manifest.id}" is not allowed to remove background jobs`,
        )
        return removeAddonBackgroundJob(addon, jobId)
      },
    },
    scheduler: {
      inspect: (input) => inspectScheduledJobState(input.state, {
        enabled: input.enabled,
        configured: input.configured,
      }),
      ensure: async (currentState, options) => {
        const ensuredJob = await ensureScheduledBackgroundJob(currentState, {
          enabled: options.enabled,
          configured: options.configured,
          jobName: "addon.background-job.run",
          delayMs: options.delayMs,
          payload: (token) => ({
            addonId: addon.manifest.id,
            jobKey: options.jobKey,
            payload: {
              token,
              ...(options.payload ?? {}),
            },
          }),
          refreshToken: options.refreshToken,
        })

        return {
          scheduled: ensuredJob.scheduled,
          state: ensuredJob.state,
        }
      },
      cancel: (currentState, options) => cancelScheduledBackgroundJob(currentState, options),
    },
    ...buildAddonDomainFacades(addon, input, assertRuntimePermission),
  }
}