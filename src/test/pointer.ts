import { fireEvent } from '@testing-library/react'

// jsdom has no PointerEvent and drops clientX from synthesized pointer events,
// but a native MouseEvent typed as a pointer event reaches React's onPointer*
// handlers WITH coordinates. These helpers drive the shared tap-vs-swipe logic
// (useTapNotSwipe / FlagPanel) deterministically in tests.

export function tap(el: Element) {
  el.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }))
  fireEvent.click(el)
}

export function swipe(el: Element) {
  el.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }))
  el.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 0, bubbles: true }))
  fireEvent.click(el)
}
