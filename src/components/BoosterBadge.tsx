import type { CSSProperties } from 'react'

// The booster control is a big outline circle — same size/ring as the top-3
// predictor avatars — with "2×" inside it. Tapping it sets/removes the booster;
// when active the ring becomes an animated rainbow.
//  • available — solid ink circle, ink ring, tappable → set the booster here
//  • active    — rainbow ring; tappable to remove (or a static indicator when
//                onClick is omitted: locked / finished card)
//  • disabled  — 20% opacity, untappable (booster already used this round)
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

  const style: CSSProperties = { width: px, height: px }
  if (rainbow) (style as Record<string, string>)['--card-bg'] = '#141210'

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={label}
      aria-pressed={state === 'active'}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); if (interactive) onClick!() }}
      style={style}
      className={[
        'grid place-items-center rounded-full bg-ink text-paper font-display leading-none select-none border-[3px]',
        rainbow ? 'booster-rainbow border-transparent' : 'border-ink',
        state === 'disabled' ? 'opacity-20 pointer-events-none' : '',
        interactive ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <span style={{ fontSize: Math.round(px * 0.42) }}>2×</span>
    </button>
  )
}
