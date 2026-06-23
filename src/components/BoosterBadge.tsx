import { Avatar } from './Avatar'
import { useAuth } from '../context/AuthContext'

// The booster control is the current player's face in a big outline circle —
// the same look as the top-3 predictor avatars above a finished card. Tapping it
// sets/removes the booster; when active the ring becomes an animated rainbow.
//  • available — your avatar, ink ring, tappable → set the booster here
//  • active    — your avatar, rainbow ring; tappable to remove (or a static
//                indicator when onClick is omitted: locked / finished card)
//  • disabled  — 20% opacity, untappable (booster already used this round)
export function BoosterBadge({ state, px = 56, onClick }: {
  state: 'available' | 'active' | 'disabled'
  px?: number
  onClick?: () => void
}) {
  const { player } = useAuth()
  const interactive = state !== 'disabled' && !!onClick
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
      className={[
        'block rounded-full select-none',
        state === 'disabled' ? 'opacity-20 pointer-events-none' : '',
        interactive ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <Avatar url={player?.avatar_url} code={player?.flag_code} label={player?.name} px={px} rainbow={state === 'active'} />
    </button>
  )
}
