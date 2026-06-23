// The booster control is a big OUTLINE circle — same ring thickness as the card
// (border-[3px]) — with a clear (transparent) centre and "2×" inside it. Tapping
// it sets/removes the booster; when active the ring becomes a fast spinning rainbow.
//  • available — ink outline, clear centre, tappable → set the booster here
//  • active    — spinning rainbow ring; tappable to remove (or a static
//                indicator when onClick is omitted: locked / finished card)
//  • disabled  — 20% opacity, untappable (booster already used elsewhere this round)
export function BoosterBadge({ state, px = 56, onClick }: {
  state: 'available' | 'active' | 'disabled'
  px?: number
  onClick?: () => void
}) {
  const interactive = state !== 'disabled' && !!onClick
  const rainbow = state === 'active'
  const label =
    state === 'disabled' ? 'Booster already used this round'
      : state === 'active' ? (onClick ? 'Remove booster' : 'Booster active — points doubled')
        : 'Use booster (double points)'

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={label}
      aria-pressed={state === 'active'}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); if (interactive) onClick!() }}
      style={{ width: px, height: px }}
      className={[
        // clear centre (no background), 2× inherits the card's text colour
        'relative grid place-items-center rounded-full bg-transparent font-display leading-none select-none',
        rainbow ? '' : 'border-[3px] border-ink', // active: the ring layer draws the border instead
        state === 'disabled' ? 'opacity-20 pointer-events-none' : '',
        interactive ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      {rainbow && <span aria-hidden className="booster-ring" />}
      <span className="relative" style={{ fontSize: Math.round(px * 0.42) }}>2×</span>
    </button>
  )
}
