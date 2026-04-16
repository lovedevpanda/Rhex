"use client"

import { createContext, useContext, useMemo } from "react"

import {
  pickAddonEditorToolbarItems,
  pickPreferredAddonEditorProvider,
  type AddonEditorProviderDescriptor,
  type AddonEditorToolbarItemDescriptor,
  type AddonEditorTarget,
} from "@/addons-host/editor-types"
import {
  pickPreferredAddonSurfaceOverride,
  type AddonSurfaceKey,
  type AddonSurfaceOverrideDescriptor,
} from "@/addons-host/types"

interface AddonRuntimeContextValue {
  editorProviders: AddonEditorProviderDescriptor[]
  editorToolbarItems: AddonEditorToolbarItemDescriptor[]
  surfaceOverrides: AddonSurfaceOverrideDescriptor[]
}

const defaultAddonRuntimeContextValue: AddonRuntimeContextValue = {
  editorProviders: [],
  editorToolbarItems: [],
  surfaceOverrides: [],
}

const AddonRuntimeContext = createContext<AddonRuntimeContextValue>(
  defaultAddonRuntimeContextValue,
)

export function AddonRuntimeProvider({
  children,
  editorProviders = [],
  editorToolbarItems = [],
  surfaceOverrides = [],
}: {
  children: React.ReactNode
  editorProviders?: AddonEditorProviderDescriptor[]
  editorToolbarItems?: AddonEditorToolbarItemDescriptor[]
  surfaceOverrides?: AddonSurfaceOverrideDescriptor[]
}) {
  const value = useMemo<AddonRuntimeContextValue>(
    () => ({
      editorProviders,
      editorToolbarItems,
      surfaceOverrides,
    }),
    [editorProviders, editorToolbarItems, surfaceOverrides],
  )

  return (
    <AddonRuntimeContext.Provider value={value}>
      {children}
    </AddonRuntimeContext.Provider>
  )
}

export function useAddonRuntimeContext() {
  return useContext(AddonRuntimeContext)
}

export function usePreferredAddonEditorProvider(target: AddonEditorTarget) {
  const context = useAddonRuntimeContext()

  return useMemo(
    () => pickPreferredAddonEditorProvider(context.editorProviders, target),
    [context.editorProviders, target],
  )
}

export function useAddonEditorToolbarItems(target: AddonEditorTarget) {
  const context = useAddonRuntimeContext()

  return useMemo(
    () => pickAddonEditorToolbarItems(context.editorToolbarItems, target),
    [context.editorToolbarItems, target],
  )
}

export function usePreferredAddonSurfaceOverride(surface: AddonSurfaceKey) {
  const context = useAddonRuntimeContext()

  return useMemo(
    () => pickPreferredAddonSurfaceOverride(context.surfaceOverrides, surface),
    [context.surfaceOverrides, surface],
  )
}
