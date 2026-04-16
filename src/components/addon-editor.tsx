"use client"

import { useMemo } from "react"

import { AddonClientComponentHost } from "@/addons-host/client/addon-client-component-host"
import { usePreferredAddonEditorProvider } from "@/addons-host/client/addon-runtime-provider"
import type {
  AddonEditorComponentProps,
  AddonEditorTarget,
} from "@/addons-host/editor-types"
import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import type { RefinedRichPostEditorProps } from "@/components/refined-rich-post-editor/types"
import {
  useMarkdownEmojiMap,
  useMarkdownImageUploadEnabled,
} from "@/components/site-settings-provider"

interface AddonEditorProps extends RefinedRichPostEditorProps {
  context?: AddonEditorTarget
}

export function AddonEditor({
  context = "generic",
  value,
  onChange,
  placeholder,
  minHeight = 240,
  disabled = false,
  uploadFolder = "posts",
  markdownEmojiMap,
  markdownImageUploadEnabled,
}: AddonEditorProps) {
  const provider = usePreferredAddonEditorProvider(context)
  const resolvedMarkdownEmojiMap = useMarkdownEmojiMap(markdownEmojiMap)
  const resolvedMarkdownImageUploadEnabled = useMarkdownImageUploadEnabled(
    markdownImageUploadEnabled,
  )

  const resolvedEditorProps = {
    value,
    onChange,
    placeholder,
    minHeight,
    disabled,
    uploadFolder,
    markdownEmojiMap: resolvedMarkdownEmojiMap,
    markdownImageUploadEnabled: resolvedMarkdownImageUploadEnabled,
  } satisfies RefinedRichPostEditorProps

  const fallback = <RefinedRichPostEditor {...resolvedEditorProps} context={context} />

  const addonEditorProps = useMemo(
    () =>
      ({
        ...resolvedEditorProps,
        context,
        markdownEmojiMap: resolvedMarkdownEmojiMap,
        markdownImageUploadEnabled: resolvedMarkdownImageUploadEnabled,
        providerCode: provider?.providerCode ?? "default-editor",
        providerLabel: provider?.label ?? "默认编辑器",
      }) satisfies AddonEditorComponentProps,
    [
      context,
      provider?.label,
      provider?.providerCode,
      resolvedEditorProps,
      resolvedMarkdownEmojiMap,
      resolvedMarkdownImageUploadEnabled,
    ],
  )

  if (!provider?.clientModuleUrl) {
    return fallback
  }

  return (
    <AddonClientComponentHost
      moduleUrl={provider.clientModuleUrl}
      props={addonEditorProps}
      fallback={fallback}
    />
  )
}
