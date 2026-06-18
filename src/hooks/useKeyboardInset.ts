import { useEffect, useState } from 'react'

// How far the on-screen keyboard overlaps the bottom of the layout viewport,
// via the visualViewport API. Used to lift the fixed composer above the
// keyboard while typing. Returns 0 when inactive or unsupported (e.g. desktop).
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) {
      setInset(0)
      return
    }
    function update() {
      const v = window.visualViewport!
      const overlap = window.innerHeight - v.height - v.offsetTop
      setInset(Math.max(0, Math.round(overlap)))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return inset
}
