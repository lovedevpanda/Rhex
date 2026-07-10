import * as React from "react"

const DEFAULT_MOBILE_BREAKPOINT = 768
export function useIsMobile(breakpoint = DEFAULT_MOBILE_BREAKPOINT) {
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const mediaQueryList = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    mediaQueryList.addEventListener("change", onStoreChange)

    return () => {
      mediaQueryList.removeEventListener("change", onStoreChange)
    }
  }, [breakpoint])
  const getSnapshot = React.useCallback(
    () => window.innerWidth < breakpoint,
    [breakpoint],
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
