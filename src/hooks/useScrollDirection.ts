import { useEffect, useRef, useState, type RefObject } from 'react'
import { shouldHide } from '../lib/scroll'

// Listens to the given scroll container and returns true when the bottom
// composer should hide (scrolling down) vs show (scrolling up / at top /
// expanded). Direction logic lives in the pure shouldHide() helper.
export function useScrollDirection(
  scrollRef: RefObject<HTMLDivElement | null> | null,
  expanded: boolean,
): boolean {
  const [hidden, setHidden] = useState(false)
  const hiddenRef = useRef(false)
  const lastTop = useRef(0)

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    function onScroll() {
      const scrollTop = el!.scrollTop
      const next = shouldHide({
        scrollTop,
        lastScrollTop: lastTop.current,
        expanded,
        currentlyHidden: hiddenRef.current,
      })
      lastTop.current = scrollTop
      if (next !== hiddenRef.current) {
        hiddenRef.current = next
        setHidden(next)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, expanded])

  // Expanding the editor always reveals the composer.
  useEffect(() => {
    if (expanded) {
      hiddenRef.current = false
      setHidden(false)
    }
  }, [expanded])

  return hidden
}
