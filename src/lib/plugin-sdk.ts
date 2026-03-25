import type { PluginManifest, PluginPageComponent, PluginServerDefinition } from "@/lib/plugin-types"

export function definePluginManifest(manifest: PluginManifest) {
  return manifest
}

export function definePluginServer(definition: PluginServerDefinition) {
  return definition
}

export function definePluginPage(component: PluginPageComponent) {
  return component
}
