import type { Match, Stage } from './types'
import { computeStandings } from './standings'

export interface BracketSlot {
  code: string | null
  name: string | null
  label: string // raw seed label, e.g. '2A', '3A/B/C/D/F', 'W74'
  // True when the team is locked in (group finished, or an actual match winner);
  // false when it's only a live projection that could still change.
  confirmed: boolean
}

export interface BracketMatch {
  id: string
  match_no: number | null
  stage: Stage
  kickoff_at: string
  multiplier: number
  status: Match['status']
  home: BracketSlot
  away: BracketSlot
  home_score: number | null
  away_score: number | null
  home_pens: number | null
  away_pens: number | null
  live_home: number | null
  live_away: number | null
  live_minute: number | null
  live_status: string | null
  winnerCode: string | null
}

// Sub-tab rows for the knockout view. The third-place game folds into the Final tab.
export const KO_TABS: { key: string; label: string; stages: Stage[] }[] = [
  { key: 'r32', label: 'R32', stages: ['r32'] },
  { key: 'r16', label: 'R16', stages: ['r16'] },
  { key: 'qf', label: 'QF', stages: ['qf'] },
  { key: 'sf', label: 'SF', stages: ['sf'] },
  { key: 'final', label: 'Final', stages: ['third', 'final'] },
]

type TeamRef = { code: string; name: string }

const byLetter = (groupLabel: string) => groupLabel.replace(/^Group\s+/i, '').trim()

// Bipartite matching (Kuhn's algorithm) of third-place slots → qualifying thirds,
// honouring each slot's allowed-group set. Deterministic: callers pass slots and
// thirds in a fixed (sorted) order, and we scan thirds in that order. A maximum
// matching over the FIFA-designed slots is a complete, valid third-place bracket.
// NOTE: the official FIFA 495-row allocation table is the only bit-for-bit-official
// mapping; swap it in here if exactness is ever required. Exported for testing.
export function assignThirdPlaces(
  slots: { label: string; allowed: string[] }[],
  thirds: { letter: string; code: string; name: string }[],
): Map<string, TeamRef> {
  const slotToThird = new Array(slots.length).fill(-1)
  const thirdToSlot = new Array(thirds.length).fill(-1)

  const tryAssign = (si: number, seen: boolean[]): boolean => {
    for (let ti = 0; ti < thirds.length; ti++) {
      if (seen[ti]) continue
      if (!slots[si].allowed.includes(thirds[ti].letter)) continue
      seen[ti] = true
      if (thirdToSlot[ti] === -1 || tryAssign(thirdToSlot[ti], seen)) {
        thirdToSlot[ti] = si
        slotToThird[si] = ti
        return true
      }
    }
    return false
  }

  for (let si = 0; si < slots.length; si++) {
    tryAssign(si, new Array(thirds.length).fill(false))
  }

  const out = new Map<string, TeamRef>()
  slots.forEach((s, si) => {
    const ti = slotToThird[si]
    if (ti >= 0) out.set(s.label, { code: thirds[ti].code, name: thirds[ti].name })
  })
  return out
}

const slotRef = (s: BracketSlot): TeamRef | null =>
  s.code ? { code: s.code, name: s.name ?? s.code } : null

// Decide a knockout match: regular score first, then penalties for a level game.
function decideMatch(home: BracketSlot, away: BracketSlot, m: Match):
  { winner: TeamRef | null; loser: TeamRef | null } {
  const hs = m.home_score, as_ = m.away_score
  if (hs == null || as_ == null) return { winner: null, loser: null }
  if (hs !== as_) {
    const homeWon = hs > as_
    return { winner: homeWon ? slotRef(home) : slotRef(away), loser: homeWon ? slotRef(away) : slotRef(home) }
  }
  const hp = m.home_pens, ap = m.away_pens
  if (hp == null || ap == null || hp === ap) return { winner: null, loser: null }
  const homeWon = hp > ap
  return { winner: homeWon ? slotRef(home) : slotRef(away), loser: homeWon ? slotRef(away) : slotRef(home) }
}

export function resolveBracket(matches: Match[]): BracketMatch[] {
  const standings = computeStandings(matches)

  // Google-style live projection: a group's positions fill from its CURRENT
  // (provisional) standings as soon as the group has any played result — we don't
  // wait for the group to be mathematically decided. `computeStandings` already
  // folds in live in-progress scores, so the bracket tracks the table in real time.
  // A group is "active" once at least one of its matches has a played score.
  const groupMatches = matches.filter(m => m.stage === 'group' && m.group_label)
  const played = new Set<string>() // group labels with ≥1 played match
  for (const m of groupMatches) {
    const hasScore = (m.status === 'finished' && m.home_score != null && m.away_score != null)
      || (m.status !== 'finished' && m.live_home != null && m.live_away != null)
    if (hasScore) played.add(m.group_label!)
  }
  const groupActive = (label: string) => played.has(label)
  const groupLabels = new Set(groupMatches.map(m => m.group_label!))
  const allGroupsActive = groupLabels.size > 0 && [...groupLabels].every(groupActive)

  // A group is "complete" (positions locked) once all its matches are finished.
  // Placements from a complete group are confirmed; from an in-progress one they
  // are only a live projection (shown dimmed).
  const finished = new Map<string, boolean>()
  for (const m of groupMatches) {
    const prev = finished.get(m.group_label!)
    const f = m.status === 'finished'
    finished.set(m.group_label!, prev === undefined ? f : prev && f)
  }
  const groupComplete = (label: string) => finished.get(label) === true
  const allGroupsComplete = groupLabels.size > 0 && [...groupLabels].every(groupComplete)

  // Placement slots ('1A','2A','3A'…) projected from any group that's underway,
  // flagged confirmed only once that group is mathematically done.
  const placement = new Map<string, TeamRef & { confirmed: boolean }>()
  for (const grp of standings) {
    if (!groupActive(grp.label)) continue
    const letter = byLetter(grp.label)
    const confirmed = groupComplete(grp.label)
    ;[0, 1, 2].forEach(i => {
      const r = grp.rows[i]
      if (r) placement.set(`${i + 1}${letter}`, { code: r.code, name: r.name, confirmed })
    })
  }

  // Third-place slot assignment — the cross-group "best 8 thirds" comparison is
  // only meaningful once every group is underway, so we project it then.
  const thirdSlotLabels = new Set<string>()
  for (const m of matches) {
    if (m.stage === 'group') continue
    if (m.home_label?.startsWith('3')) thirdSlotLabels.add(m.home_label)
    if (m.away_label?.startsWith('3')) thirdSlotLabels.add(m.away_label)
  }
  let thirdMap = new Map<string, TeamRef>()
  if (allGroupsActive && thirdSlotLabels.size > 0) {
    const slots = [...thirdSlotLabels]
      .sort((a, b) => a.localeCompare(b))
      .map(label => ({ label, allowed: label.replace(/^3/, '').split('/').map(s => s.trim()) }))
    const thirds: { letter: string; code: string; name: string }[] = []
    for (const grp of standings) {
      const r = grp.rows[2]
      if (r && r.qualification === 'wildcard') thirds.push({ letter: byLetter(grp.label), code: r.code, name: r.name })
    }
    thirds.sort((a, b) => a.letter.localeCompare(b.letter))
    thirdMap = assignThirdPlaces(slots, thirds)
  }

  // Resolve in match_no order so W{n}/L{n} reference already-decided earlier rounds.
  const ko = matches
    .filter(m => m.stage !== 'group')
    .sort((a, b) => (a.match_no ?? 0) - (b.match_no ?? 0))
  const resultByNo = new Map<number, { winner: TeamRef | null; loser: TeamRef | null }>()

  const resolveSlot = (label: string | null): BracketSlot => {
    const raw = label ?? ''
    const slot = (ref: TeamRef | null, confirmed: boolean): BracketSlot =>
      ({ code: ref?.code ?? null, name: ref?.name ?? null, label: raw, confirmed: ref ? confirmed : false })
    if (/^[12][A-L]$/.test(raw)) {
      const p = placement.get(raw) ?? null
      return slot(p, p?.confirmed ?? false)
    }
    // Third-place teams are confirmed only once every group has finished.
    if (/^3/.test(raw)) return slot(thirdMap.get(raw) ?? null, allGroupsComplete)
    // Knockout winners/losers come from an actually-finished game → always confirmed.
    const w = raw.match(/^W(\d+)$/)
    if (w) return slot(resultByNo.get(+w[1])?.winner ?? null, true)
    const l = raw.match(/^L(\d+)$/)
    if (l) return slot(resultByNo.get(+l[1])?.loser ?? null, true)
    return slot(null, false)
  }

  return ko.map(m => {
    const home = resolveSlot(m.home_label)
    const away = resolveSlot(m.away_label)
    const decided = decideMatch(home, away, m)
    if (m.match_no != null) resultByNo.set(m.match_no, decided)
    return {
      id: m.id, match_no: m.match_no, stage: m.stage, kickoff_at: m.kickoff_at,
      multiplier: m.multiplier, status: m.status,
      home, away,
      home_score: m.home_score, away_score: m.away_score,
      home_pens: m.home_pens ?? null, away_pens: m.away_pens ?? null,
      live_home: m.live_home ?? null, live_away: m.live_away ?? null,
      live_minute: m.live_minute ?? null, live_status: m.live_status ?? null,
      winnerCode: decided.winner?.code ?? null,
    }
  })
}
