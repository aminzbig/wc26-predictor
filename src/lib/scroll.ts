// Pure decision for the auto-hiding bottom composer. Kept framework-free so the
// direction/threshold logic is unit-testable without a DOM.
export const TOP_THRESHOLD = 8 // px from top where the pill is always shown
export const DELTA_THRESHOLD = 6 // px of movement before we react (dead zone)

export function shouldHide(args: {
  scrollTop: number
  lastScrollTop: number
  expanded: boolean
  currentlyHidden: boolean
}): boolean {
  const { scrollTop, lastScrollTop, expanded, currentlyHidden } = args
  if (expanded) return false // composing → always visible
  if (scrollTop <= TOP_THRESHOLD) return false // at the top → always visible
  const delta = scrollTop - lastScrollTop
  if (delta > DELTA_THRESHOLD) return true // scrolling down → hide
  if (delta < -DELTA_THRESHOLD) return false // scrolling up → show
  return currentlyHidden // within dead zone → keep current state
}
