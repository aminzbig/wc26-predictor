// Shared visual pieces of the new poster-style match card (Figma "Main Card").
// Used by both the big deck card (MatchCard) and the expanded view (MatchDetail)
// so the two stay identical. Outlines are the app standard: border-[3px] border-ink.
import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import type { Match } from '../lib/types'
import { supabase } from '../lib/supabase'
import { Avatar } from './Avatar'
import { BoosterBadge } from './BoosterBadge'
import { useTapNotSwipe } from './tapNotSwipe'

// "Stadium · City" from API-Football's fixture.venue — whichever parts we have.
function venueLine(m: Match): string | null {
  const parts = [m.venue_name, m.venue_city].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

const STAGE_SHORT: Record<string, string> = {
  group: 'Group', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-final', sf: 'Semi-final', third: 'Third place', final: 'Final',
}

// Top-left block: group/stage (big), date-time, and stadium · city.
export function GameInfo({ match, big }: { match: Match; big?: boolean }) {
  const g = match.group_label
  const heading = g ? (/group/i.test(g) ? g : `Group ${g}`) : (STAGE_SHORT[match.stage] ?? match.stage)
  const date = new Date(match.kickoff_at).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const venue = venueLine(match)
  const sub = big ? 'text-[12px]' : 'text-[clamp(10px,calc(var(--app-vh)*0.016),12px)]'
  return (
    <div className="min-w-0">
      <div className={`font-display uppercase leading-[0.95] tracking-wide truncate ${big ? 'text-[28px]' : 'text-[clamp(20px,calc(var(--app-vh)*0.04),32px)]'}`}>
        {heading}
      </div>
      <div className={`font-sans font-700 tracking-wide opacity-80 leading-tight mt-1 truncate ${sub}`}>{date}</div>
      {venue && <div className={`font-sans font-700 tracking-wide opacity-60 leading-tight truncate ${sub}`}>{venue}</div>}
    </div>
  )
}

type TopPick = { id: string; name: string; flag_code: string | null; avatar_url: string | null; points: number }
type PredRow = {
  id: string; points_awarded: number | null
  players: { name: string | null; flag_code: string | null; avatar_url: string | null } | null
}

// Top-right avatars: the (up to 3) players who scored the most on THIS match.
// Only meaningful once finished — predictions are RLS-readable by then.
type Pop = { id: string; x: number; y: number; name: string; points: number }

export function TopThreePredictors({ match, boosted }: { match: Match; boosted?: boolean }) {
  const [top, setTop] = useState<TopPick[]>([])
  const [pop, setPop] = useState<Pop | null>(null)
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (match.status !== 'finished') return
    let active = true
    supabase.from('predictions')
      .select('id,points_awarded, players(name,flag_code,avatar_url)')
      .eq('match_id', match.id)
      .then(({ data }) => {
        if (!active) return
        const ranked = ((data ?? []) as unknown as PredRow[])
          .map(r => ({
            id: r.id, points: r.points_awarded ?? 0,
            name: r.players?.name ?? '?', flag_code: r.players?.flag_code ?? null,
            avatar_url: r.players?.avatar_url ?? null,
          }))
          .filter(r => r.points > 0)
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
          .slice(0, boosted ? 2 : 3)
        setTop(ranked)
      })
    return () => { active = false }
  }, [match.id, match.status, match.home_score])

  // Dismiss the pop on scroll/resize (its fixed position would drift) and on any
  // tap outside the avatars — e.g. tapping the card to open the detail. The avatar
  // buttons stopPropagation on pointerdown, so their own taps don't close it here.
  useEffect(() => {
    if (!pop) return
    const close = () => setPop(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('pointerdown', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('pointerdown', close)
    }
  }, [pop])
  useEffect(() => () => { if (hideT.current) clearTimeout(hideT.current) }, [])

  // Tap an avatar → show the name + points just above it (iOS-key style), and
  // stop the tap from opening the card detail. Toggles, auto-hides after a beat.
  const onTap = (e: RMouseEvent<HTMLButtonElement>, p: TopPick) => {
    e.stopPropagation()
    if (hideT.current) clearTimeout(hideT.current)
    if (pop?.id === p.id) { setPop(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setPop({ id: p.id, x: r.left + r.width / 2, y: r.top, name: p.name, points: p.points })
    hideT.current = setTimeout(() => setPop(null), 2600)
  }

  if (top.length === 0 && !boosted) return null
  // Figma: evenly-spaced circles (not overlapping), ~60px on the 550px card.
  return (
    <div className="flex items-center gap-[10px] flex-none">
      {top.map(p => (
        <button
          key={p.id}
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => onTap(e, p)}
          aria-label={`${p.name}, ${p.points} points`}
          className="block rounded-full"
        >
          <Avatar url={p.avatar_url} code={p.flag_code} label={p.name} size="lg" />
        </button>
      ))}
      {boosted && <BoosterBadge state="active" px={56} />}
      {pop && createPortal(
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center"
          style={{ left: pop.x, top: pop.y - 6 }}
        >
          <div className="bg-ink text-paper border-[3px] border-ink px-2.5 py-1.5 text-center whitespace-nowrap" style={{ boxShadow: '-3px 4px 0 rgba(20,18,16,.25)' }}>
            <div className="font-display text-[15px] uppercase leading-none">{pop.name}</div>
            <div className="font-sans font-900 text-[11px] uppercase tracking-wider text-yellow leading-none mt-1">+{pop.points} pts</div>
          </div>
          <div className="w-3 h-3 bg-ink rotate-45 -mt-[7px]" />
        </div>,
        document.body,
      )}
    </div>
  )
}

// One team's flag panel with the giant prediction number overlaid, full-bleed.
// When editable (open state) the number IS a numeric input: tapping it opens the
// on-screen number keyboard. It stops propagation so editing doesn't open the
// detail; changes are auto-saved by the parent (no explicit save button).
export function FlagPanel({ code, label, value, editable, onChange }: {
  code: string | null; label: string | null; value: number | null
  editable?: boolean; onChange?: (n: number) => void
}) {
  const numCls = 'font-display text-white leading-none text-[clamp(64px,calc(var(--app-vh)*0.20),176px)]'
  const shadow = { textShadow: '0 3px 12px rgba(0,0,0,.75), 0 0 6px rgba(0,0,0,.6)' } as const

  // Tap vs. swipe on the number (see useTapNotSwipe): a drag passes straight
  // through to the deck's framer-motion drag; a deliberate TAP focuses the real
  // <input> and enters edit mode. focus() runs inside the tap gesture, so iOS
  // opens the keyboard. The input sits behind with pointer-events:none until
  // then, so it never intercepts a swipe.
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const tap = useTapNotSwipe(() => {
    const el = inputRef.current
    if (el) { el.focus(); el.select() }  // focus in-gesture → iOS keyboard
    setEditing(true)
  })

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden bg-paper">
      {code
        ? <span className={`fi fis fi-${code} absolute inset-0 !w-full !h-full bg-cover`} />
        : <span className="absolute inset-0 grid place-items-center text-ink/50 font-sans font-800 text-[11px] uppercase px-1 text-center">{label}</span>}
      {/* Darken the flag so the white number stays legible: a flat tint plus a
          vertical gradient (darker top & bottom), with a heavy text-shadow. */}
      <div className="absolute inset-0 bg-ink/25" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/35 via-transparent to-ink/45" />
      {editable && onChange ? (
        <>
          {/* Real input — focused on tap. Hidden + click-through until editing so it
              never blocks a swipe. */}
          <input
            ref={inputRef}
            type="number" inputMode="numeric" min={0} max={99} value={value ?? 0}
            tabIndex={-1}
            data-editing={editing}
            onChange={e => onChange(e.target.value === '' ? 0 : Math.max(0, Math.min(99, Math.floor(+e.target.value))))}
            onPointerDown={e => { if (editing) e.stopPropagation() }}
            onBlur={() => setEditing(false)}
            aria-label={`${label ?? 'team'} predicted score`}
            className={`absolute inset-0 w-full h-full bg-transparent text-center outline-none cursor-text ${numCls} ${editing ? '' : 'opacity-0 pointer-events-none'}`}
            style={shadow}
          />
          {/* Tap/swipe detector + number display. A plain div, so framer-motion drags
              through it; we only intercept a genuine tap. Click-through while editing. */}
          <div
            data-testid="num-overlay"
            className={`absolute inset-0 grid place-items-center ${editing ? 'opacity-0 pointer-events-none' : 'cursor-text'}`}
            {...tap}
          >
            <span className={numCls} style={shadow}>{value == null ? '–' : value}</span>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className={numCls} style={shadow}>{value == null ? '–' : value}</span>
        </div>
      )}
    </div>
  )
}

// First 3 letters of a team name (CZECH REPUBLIC → CZE) so long names never get
// cut off in the name bar. The full name lives in the detail's "Your prediction".
const abbr3 = (name: string | null) => (name ? name.slice(0, 3).toUpperCase() : '—')

// Black band under the flags: the two team names, full width, split by a center
// divider. Full-bleed (top/bottom border only; the card frames the sides).
// `divider` is a bg-* class — per Figma the "Spacing" line is the card bg colour.
// By default shows a 3-letter abbreviation so long names never clip; `full` shows
// the whole country name at a smaller, wrapping size (used in the detail view).
export function TeamNameBar({ home, away, big, full, divider = 'bg-paper/25' }: {
  home: string | null; away: string | null; big?: boolean; full?: boolean; divider?: string
}) {
  const cls = full
    ? 'flex-1 grid place-items-center min-w-0 px-2 py-1.5 text-center font-display uppercase text-white leading-[0.9] text-[clamp(16px,calc(var(--app-vh)*0.031),26px)]'
    : `flex-1 grid place-items-center min-w-0 px-2 font-display uppercase text-white leading-[0.95] ${big ? 'text-[40px]' : 'text-[clamp(22px,calc(var(--app-vh)*0.044),44px)]'}`
  return (
    <div className={`relative flex items-stretch border-y-[3px] border-ink bg-ink ${full ? 'min-h-[clamp(44px,calc(var(--app-vh)*0.08),72px)]' : 'h-[clamp(44px,calc(var(--app-vh)*0.08),72px)]'}`}>
      <span className={cls}>{full ? (home ?? '—') : abbr3(home)}</span>
      <span className={cls}>{full ? (away ?? '—') : abbr3(away)}</span>
      {/* Spacing line — card-bg colour. Anchored full-height and extended past the
          bottom border so it meets the same-coloured bottom zone, making the line
          read as reaching the bottom of the card. */}
      <span aria-hidden className={`absolute top-0 -bottom-[6px] left-1/2 -translate-x-1/2 w-[3px] ${divider}`} />
    </div>
  )
}

type Side = 'home' | 'away'

// Slide-up "who advances" band for a knockout tie. Rendered inside the (relative,
// overflow-hidden) flags container, pinned just above TeamNameBar, so it appears
// to emerge from behind the names. The parent wraps it in <AnimatePresence> and
// mounts it only when it should show. Tap selects; a swipe passes through
// (useTapNotSwipe) so the deck still slides / the modal still scrolls.
export function WinnerPicker({ homeLabel, awayLabel, homeCode, awayCode, value, editable, onChange }: {
  homeLabel: string | null; awayLabel: string | null
  homeCode: string | null; awayCode: string | null
  value: Side | null; editable?: boolean; onChange?: (side: Side) => void
}) {
  const homeTap = useTapNotSwipe(() => { if (editable) onChange?.('home') })
  const awayTap = useTapNotSwipe(() => { if (editable) onChange?.('away') })
  const needs = editable && value == null
  const reduce = useReducedMotion()

  const half = (side: Side, label: string | null, code: string | null, handlers: ReturnType<typeof useTapNotSwipe>) => {
    const chosen = value === side
    const dimmed = value != null && !chosen
    const mark = <span className="font-display text-[15px] leading-none">{side === 'home' ? '▸' : '◂'}</span>
    const flag = code
      ? <span className={`fi fis fi-${code} !w-[26px] !h-[18px] bg-cover border-2 ${chosen ? 'border-ink' : 'border-paper'} flex-none`} />
      : null
    return (
      <div
        {...(editable ? handlers : {})}
        role={editable ? 'button' : undefined}
        aria-label={`${label ?? 'team'} advances`}
        className={`flex-1 flex items-center justify-center gap-2 select-none ${editable ? 'cursor-pointer' : ''} ${chosen ? 'bg-yellow text-ink' : 'text-paper'} ${dimmed ? 'opacity-40' : ''}`}
      >
        {side === 'away' && mark}
        {side === 'home' && flag}
        <span className="font-display text-[22px] uppercase leading-none">{abbr3(label)}</span>
        {side === 'away' && flag}
        {side === 'home' && mark}
      </div>
    )
  }

  return (
    <motion.div
      initial={reduce ? false : { y: '115%' }} animate={{ y: 0 }} exit={reduce ? { opacity: 0 } : { y: '115%' }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
      className={`absolute inset-x-0 bottom-0 z-[6] bg-ink border-t-[3px] border-ink ${needs ? 'winner-needs' : ''}`}
    >
      <div className="h-[18px] grid place-items-center bg-black/25 font-sans font-900 text-[9px] uppercase tracking-[0.22em] text-yellow leading-none">
        {value
          ? `✓ ${abbr3(value === 'home' ? homeLabel : awayLabel)} goes through`
          : (editable ? 'Who advances?' : 'No advancer picked')}
      </div>
      <div className="winner-choices relative flex h-[46px] overflow-hidden">
        {half('home', homeLabel, homeCode, homeTap)}
        {half('away', awayLabel, awayCode, awayTap)}
        <span aria-hidden className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-blue z-[2] pointer-events-none" />
      </div>
    </motion.div>
  )
}

// Detail-view summary: surfaces the chosen advancer as the match winner.
export function AdvancerBadge({ side, homeLabel, awayLabel, homeCode, awayCode }: {
  side: Side; homeLabel: string | null; awayLabel: string | null; homeCode: string | null; awayCode: string | null
}) {
  const label = side === 'home' ? homeLabel : awayLabel
  const code = side === 'home' ? homeCode : awayCode
  return (
    <div className="mt-2 inline-flex items-center gap-2 bg-ink text-yellow border-[3px] border-yellow px-3 py-2">
      <Trophy size={16} />
      {code && <span className={`fi fis fi-${code} !w-[24px] !h-[17px] bg-cover border-2 border-yellow flex-none`} />}
      <span className="font-display text-[16px] uppercase tracking-wide leading-none">{label ?? '—'} to advance</span>
    </div>
  )
}

// Big "home – away" score. The en-dash glyph renders below the digits' optical
// centre, so the separator is a small bar vertically centred via flex items-center
// (bg-current = same colour as the score). Used by the live & full-time banners.
export function ScoreLine({ home, away, className = '' }: { home: number | null | undefined; away: number | null | undefined; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-[0.16em] font-display leading-none ${className}`}>
      <span>{home}</span>
      {/* nudge up to the digits' optical centre (Anton has minimal descender) */}
      <span className="inline-block w-[0.34em] h-[0.1em] rounded-[1px] bg-current shrink-0 -translate-y-[0.06em]" />
      <span>{away}</span>
    </div>
  )
}

// Google-style "Penalties 4–1" line, shown small beneath the full-time score on a
// knockout game decided on penalties. Renders nothing unless both scores are present.
export function PensLine({ home, away, className = '' }:
  { home: number | null | undefined; away: number | null | undefined; className?: string }) {
  if (home == null || away == null) return null
  return (
    <div className={`font-sans font-900 uppercase tracking-widest opacity-80 ${className}`}>
      Penalties {home}–{away}
    </div>
  )
}

// Exact 8-point star from the Figma asset ("Star Background [RAINBOW]"), upright.
const STAR_PATH = 'M100.012 1.89155C101.577 -0.630517 105.246 -0.630518 106.811 1.89155L128.472 36.8129C129.377 38.2719 131.112 38.9907 132.784 38.5989L172.793 29.2225C175.683 28.5453 178.278 31.1401 177.6 34.0296L168.224 74.0394C167.832 75.7111 168.551 77.4463 170.01 78.3513L204.931 100.012C207.453 101.577 207.453 105.246 204.931 106.811L170.01 128.472C168.551 129.377 167.832 131.112 168.224 132.784L177.6 172.793C178.278 175.683 175.683 178.278 172.793 177.6L132.784 168.224C131.112 167.832 129.377 168.551 128.472 170.01L106.811 204.931C105.246 207.453 101.577 207.453 100.012 204.931L78.3513 170.01C77.4463 168.551 75.7111 167.832 74.0394 168.224L34.0296 177.6C31.1401 178.278 28.5453 175.683 29.2225 172.793L38.5989 132.784C38.9907 131.112 38.2719 129.377 36.8129 128.472L1.89155 106.811C-0.630517 105.246 -0.630518 101.577 1.89155 100.012L36.8129 78.3513C38.2719 77.4463 38.9907 75.7111 38.5989 74.0394L29.2225 34.0296C28.5453 31.1401 31.1401 28.5453 34.0296 29.2225L74.0394 38.5989C75.7111 38.9907 77.4463 38.2719 78.3513 36.8129L100.012 1.89155Z'

// Star colour scales with the score. A perfect (exact-score) prediction is the
// match max = 30×multiplier; risky decisive wins exceed it — both read as RAINBOW.
// 0 → black, low → yellow, high → blue, max → rainbow. (Thresholds scale with the
// per-match multiplier, so a 2× match needs twice the points for the same colour.)
function starFill(points: number, multiplier: number): { color: string; rainbow?: boolean; darkText?: boolean } {
  const max = 30 * (multiplier || 1)
  if (points >= max) return { color: 'url(#ptsRainbow)', rainbow: true }
  if (points <= 0) return { color: '#141210' }              // ink / black
  if (points >= max * 0.4) return { color: '#1f49d6' }      // blue
  return { color: '#ffd200', darkText: true }               // yellow
}

export function PointsStar({ points, multiplier = 1 }: { points: number; multiplier?: number }) {
  const fill = starFill(points, multiplier)
  const textColor = fill.darkText ? '#141210' : '#fff'
  const textShadow = fill.darkText ? 'none' : '0 1px 3px rgba(0,0,0,.45)'
  const numCls = 'font-display leading-[0.92] text-[clamp(14px,calc(var(--app-vh)*0.035),32px)]'
  return (
    <div className="relative w-full h-full select-none pointer-events-none">
      <svg viewBox="0 0 206.823 206.823" className="absolute inset-0 w-full h-full" style={{ filter: 'drop-shadow(0 6px 13px rgba(20,18,16,.65)) drop-shadow(0 2px 3px rgba(20,18,16,.55))' }}>
        <defs>
          {/* Animated rainbow: each stop eases through the full palette (phase-shifted
              by one hue per stop), so the colours flow across the star and dissolve
              into one another gradually — no rotation. */}
          <linearGradient id="ptsRainbow" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#e22a1c">
              <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#e22a1c;#ef7c1b;#ffd200;#1ba94c;#1f49d6;#8e3cd6;#e22a1c" />
            </stop>
            <stop offset="20%" stopColor="#ef7c1b">
              <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#ef7c1b;#ffd200;#1ba94c;#1f49d6;#8e3cd6;#e22a1c;#ef7c1b" />
            </stop>
            <stop offset="40%" stopColor="#ffd200">
              <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#ffd200;#1ba94c;#1f49d6;#8e3cd6;#e22a1c;#ef7c1b;#ffd200" />
            </stop>
            <stop offset="60%" stopColor="#1ba94c">
              <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#1ba94c;#1f49d6;#8e3cd6;#e22a1c;#ef7c1b;#ffd200;#1ba94c" />
            </stop>
            <stop offset="80%" stopColor="#1f49d6">
              <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#1f49d6;#8e3cd6;#e22a1c;#ef7c1b;#ffd200;#1ba94c;#1f49d6" />
            </stop>
            <stop offset="100%" stopColor="#8e3cd6">
              <animate attributeName="stop-color" dur="7s" repeatCount="indefinite" values="#8e3cd6;#e22a1c;#ef7c1b;#ffd200;#1ba94c;#1f49d6;#8e3cd6" />
            </stop>
          </linearGradient>
        </defs>
        <path d={STAR_PATH} fill={fill.color} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" style={{ color: textColor }}>
        <div>
          <div className={numCls} style={{ textShadow }}>{points}</div>
          <div className={numCls} style={{ textShadow }}>POINTS</div>
        </div>
      </div>
    </div>
  )
}
