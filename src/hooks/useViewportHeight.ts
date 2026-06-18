import { useEffect } from 'react'

// In-app browsers (Instagram, Threads, etc.) animate their toolbar in and out
// as you navigate, which changes the usable viewport height. CSS `vh` reports
// the *large* viewport (toolbar hidden) while `dvh` reports the *dynamic* one,
// so a layout that sizes its container in dvh but positions/scales its children
// in vh visibly jumps when the two disagree — exactly the shift you see when
// switching tabs and coming back. We sidestep the whole class of bug by
// measuring the real layout-viewport height once with JS and publishing it as a
// single `--app-vh` custom property; every viewport-relative size in the app
// derives from this one value, so they can never diverge.
//
// We read window.innerHeight (the layout viewport) rather than
// visualViewport.height so the value stays stable while the on-screen keyboard
// is open — keyboard overlap is handled separately in useKeyboardInset.
export function useViewportHeight() {
  useEffect(() => {
    const set = () => {
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`)
    }
    set()
    window.addEventListener('resize', set)
    window.addEventListener('orientationchange', set)
    return () => {
      window.removeEventListener('resize', set)
      window.removeEventListener('orientationchange', set)
    }
  }, [])
}
