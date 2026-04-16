"use client"

import { installRhexClientGlobal, type RhexClientSession, type RhexClientSite } from "@/addons-host/sdk/client"

interface RhexGlobalSdkBootstrapProps {
  session: RhexClientSession
  site: RhexClientSite
}

export function RhexGlobalSdkBootstrap({
  session,
  site,
}: RhexGlobalSdkBootstrapProps) {
  installRhexClientGlobal({ session, site })
  return null
}
