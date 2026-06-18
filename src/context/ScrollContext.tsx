import { createContext, useContext, type RefObject } from 'react'

// Holds a ref to the Shell's scroll container so floating overlays (e.g. the
// Social composer) can react to feed scrolling without prop-drilling.
const ScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export const ScrollProvider = ScrollContext.Provider

export function useScrollContainer(): RefObject<HTMLDivElement | null> | null {
  return useContext(ScrollContext)
}
