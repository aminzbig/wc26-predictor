export type Reaction = 'heart' | 'up' | 'down' | 'sandal' | 'dead'
export type SocialColor = 'orange' | 'green' | 'blue' | 'yellow' | 'red' | 'paper'
export type SocialFont = 'sans' | 'impact' | 'hand' | 'mono' | 'serif' | 'pixel'

export interface SocialPostRow {
  id: string
  author_id: string
  body: string
  color: SocialColor
  font: SocialFont
  match_id: string | null
  heart_count: number
  up_count: number
  down_count: number
  sandal_count: number
  dead_count: number
  created_at: string
}

export interface PlayerLite { name: string; flag_code: string | null }
export interface MatchLite {
  id: string
  home_code: string | null; away_code: string | null
  home_label: string | null; away_label: string | null
}
export interface PostView extends SocialPostRow {
  author_name: string
  author_flag: string | null
  match_label: string | null
  match_home: string | null
  match_away: string | null
}

type CountCol = 'heart_count' | 'up_count' | 'down_count' | 'sandal_count' | 'dead_count'

export const REACTIONS: { key: Reaction; emoji: string; column: CountCol }[] = [
  { key: 'heart',  emoji: '❤️', column: 'heart_count' },
  { key: 'up',     emoji: '👍', column: 'up_count' },
  { key: 'down',   emoji: '👎', column: 'down_count' },
  { key: 'sandal', emoji: '🩴', column: 'sandal_count' },
  { key: 'dead',   emoji: '💀', column: 'dead_count' },
]

export function hottest(row: SocialPostRow): Reaction | null {
  let best: Reaction | null = null
  let max = 0
  for (const r of REACTIONS) {
    const c = row[r.column]
    if (c > max) { max = c; best = r.key }
  }
  return max > 0 ? best : null
}

export function bump(row: SocialPostRow, key: Reaction): SocialPostRow {
  const col = REACTIONS.find(r => r.key === key)!.column
  return { ...row, [col]: row[col] + 1 }
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const COLOR_CLASS: Record<SocialColor, string> = {
  orange: 'bg-orange',
  green:  'bg-green',
  blue:   'bg-blue text-paper',
  yellow: 'bg-yellow',
  red:    'bg-red text-paper',
  paper:  'bg-paper',
}
export const PALETTE: SocialColor[] = ['orange', 'green', 'blue', 'yellow', 'red', 'paper']
export const colorClass = (c: SocialColor): string => COLOR_CLASS[c]
export const isLight = (c: SocialColor): boolean => c === 'blue' || c === 'red'

const FONT_CLASS: Record<SocialFont, string> = {
  sans:   'font-sans',
  impact: 'font-display',
  hand:   'font-hand',
  mono:   'font-mono',
  serif:  'font-serif',
  pixel:  'font-pixel',
}
export const FONTS: { key: SocialFont; label: string }[] = [
  { key: 'sans',   label: 'Archivo' },
  { key: 'impact', label: 'Anton' },
  { key: 'hand',   label: 'Caveat' },
  { key: 'mono',   label: 'Mono' },
  { key: 'serif',  label: 'Playfair' },
  { key: 'pixel',  label: 'Pixel' },
]
export const fontClass = (f: SocialFont): string => FONT_CLASS[f]
export const validFont = (f: string): f is SocialFont => f in FONT_CLASS

export const validBody = (s: string): boolean => s.trim().length >= 1 && s.length <= 280
export const validColor = (c: string): c is SocialColor => (PALETTE as string[]).includes(c)

// Per-device "reactions I tapped" tracking (no server-side per-user state).
export const addReaction = (arr: Reaction[], key: Reaction): Reaction[] =>
  arr.includes(key) ? arr : [...arr, key]

export function matchLabel(m: MatchLite): string {
  const h = (m.home_code ?? m.home_label ?? '?').toUpperCase()
  const a = (m.away_code ?? m.away_label ?? '?').toUpperCase()
  return `${h}–${a}`
}

export function toView(
  row: SocialPostRow,
  players: Record<string, PlayerLite>,
  matches: Record<string, MatchLite>,
): PostView {
  const a = players[row.author_id]
  const m = row.match_id ? matches[row.match_id] : null
  return {
    ...row,
    author_name: a?.name ?? 'Someone',
    author_flag: a?.flag_code ?? null,
    match_label: m ? matchLabel(m) : null,
    match_home: m?.home_code ?? null,
    match_away: m?.away_code ?? null,
  }
}

export function upsertPost(list: SocialPostRow[], row: SocialPostRow): SocialPostRow[] {
  const next = list.filter(p => p.id !== row.id)
  next.push(row)
  next.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return next
}
export const removePost = (list: SocialPostRow[], id: string): SocialPostRow[] =>
  list.filter(p => p.id !== id)
