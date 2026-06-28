import { useRef, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react'

// Distinguish a deliberate tap from a swipe: a drag (pointer travels > SWIPE_PX)
// passes straight through to the deck's framer-motion drag / the modal scroll,
// while a genuine tap runs onTap. Shared by the score number (FlagPanel) and the
// advancer picker (WinnerPicker) so the two behave identically.
export const SWIPE_PX = 10

export function exceededSwipe(from: { x: number; y: number }, x: number, y: number): boolean {
  return Math.hypot(x - from.x, y - from.y) > SWIPE_PX
}

export function useTapNotSwipe(onTap: () => void) {
  const down = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  return {
    onPointerDown: (e: RPointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; swiped.current = false },
    onPointerMove: (e: RPointerEvent) => {
      if (down.current && !swiped.current && exceededSwipe(down.current, e.clientX, e.clientY)) swiped.current = true
    },
    onClick: (e: RMouseEvent) => {
      if (swiped.current) return
      e.stopPropagation()
      onTap()
    },
  }
}
