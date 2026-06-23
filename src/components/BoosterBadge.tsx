// The booster control is a big OUTLINE circle — same ring thickness as the card
// (border-[3px]) — with a clear (transparent) centre and a rocket icon inside it.
// Tapping it sets/removes the booster; when active the ring becomes a fast spinning
// rainbow.
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
  const icon = Math.round(px * 0.54)

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
        // clear centre (no background); the rocket inherits the card's text colour
        'relative grid place-items-center rounded-full bg-transparent select-none',
        rainbow ? '' : 'border-[3px] border-ink', // active: the ring layer draws the border instead
        state === 'disabled' ? 'opacity-20 pointer-events-none' : '',
        interactive ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      {rainbow && <span aria-hidden className="booster-ring" />}
      <svg aria-hidden viewBox="0 0 95 96" fill="currentColor" className="relative" style={{ width: icon, height: icon }}>
        <path d="M21.2873 75.4057C20.3873 75.4057 19.5873 74.7057 19.5873 73.7057C19.5873 72.0057 19.6873 69.3057 20.2873 66.0057L15.3873 61.1057C10.0873 67.3057 3.38729 83.5057 0.187292 91.8057C-0.612708 93.7057 1.28729 95.6057 3.28729 94.9057C11.4873 91.7057 27.7873 85.0057 33.9873 79.7057L29.0873 74.8057C25.6873 75.3057 22.8873 75.4057 21.2873 75.4057Z" />
        <path d="M94.3873 3.30563C94.1873 1.70563 92.9873 0.505629 91.3873 0.305629C84.3873 -0.494371 64.1873 -0.994371 43.7873 16.1056C41.5873 18.0056 38.6873 19.0056 35.8873 18.4056C31.4873 17.5056 24.2873 17.4056 18.5873 23.2056L8.68728 33.2056C7.88728 34.0056 8.08728 35.4056 9.18728 35.9056L24.5873 42.9056L20.1873 49.9056C19.1873 51.6056 19.3873 53.7056 20.7873 55.1056L39.9873 74.2056C41.3873 75.6056 43.5873 75.8056 45.2873 74.8056L52.1873 70.4056L59.2873 85.8056C59.7873 86.8056 61.1873 87.1056 61.9873 86.3056L71.8873 76.3056C77.5873 70.6056 77.3873 63.5056 76.5873 59.1056C76.0873 56.3056 76.8873 53.4056 78.6873 51.3056C95.7873 30.6056 95.2873 10.3056 94.3873 3.30563ZM71.1873 37.4056C67.3873 41.2056 61.2873 41.2056 57.4873 37.4056C53.6873 33.6056 53.6873 27.4056 57.4873 23.6056C61.2873 19.8056 67.4873 19.8056 71.2873 23.6056C74.9873 27.5056 74.9873 33.6056 71.1873 37.4056Z" />
      </svg>
      {/* periodic glint on the tappable state → reads as a clickable button */}
      {state === 'available' && interactive && <span aria-hidden className="booster-shine" />}
    </button>
  )
}
