import type { Match, Stage } from './types'
import { computeStandings } from './standings'

export interface BracketSlot {
  code: string | null
  name: string | null
  label: string // raw seed label, e.g. '2A', '3A/B/C/D/F', 'W74'
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

  // Which groups have every match finished?
  // A group is complete when ALL seen matches are finished, at least 3 distinct
  // teams are present (guards against partial/sparse data), and the match count
  // is sufficient for a full round-robin (count >= n*(n-1)/2 for n teams).
  const groupMatches = matches.filter(m => m.stage === 'group' && m.group_label)
  const groupInfo = new Map<string, { allFinished: boolean; count: number; teams: Set<string> }>()
  for (const m of groupMatches) {
    const gl = m.group_label!
    let info = groupInfo.get(gl)
    if (!info) { info = { allFinished: true, count: 0, teams: new Set() }; groupInfo.set(gl, info) }
    info.count++
    info.allFinished = info.allFinished && m.status === 'finished'
    if (m.home_code) info.teams.add(m.home_code)
    if (m.away_code) info.teams.add(m.away_code)
  }
  const groupDone = new Map<string, boolean>()
  for (const [gl, info] of groupInfo) {
    const n = info.teams.size
    // Require ≥ 3 teams and at least one full single round-robin worth of matches.
    const hasEnoughTeams = n >= 3
    const hasEnoughMatches = info.count >= n * (n - 1) / 2
    groupDone.set(gl, info.allFinished && hasEnoughTeams && hasEnoughMatches)
  }
  const allGroupsDone = groupMatches.length > 0 && [...groupDone.values()].every(Boolean)

  // Placement slots ('1A','2A','3A'…) for groups that are complete.
  const placement = new Map<string, TeamRef>()
  for (const grp of standings) {
    if (!groupDone.get(grp.label)) continue
    const letter = byLetter(grp.label)
    ;[0, 1, 2].forEach(i => {
      const r = grp.rows[i]
      if (r) placement.set(`${i + 1}${letter}`, { code: r.code, name: r.name })
    })
  }

  // Third-place slot assignment — only once the whole group stage is complete.
  const thirdSlotLabels = new Set<string>()
  for (const m of matches) {
    if (m.stage === 'group') continue
    if (m.home_label?.startsWith('3')) thirdSlotLabels.add(m.home_label)
    if (m.away_label?.startsWith('3')) thirdSlotLabels.add(m.away_label)
  }
  let thirdMap = new Map<string, TeamRef>()
  if (allGroupsDone && thirdSlotLabels.size > 0) {
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
    const slot = (ref: TeamRef | null): BracketSlot => ({ code: ref?.code ?? null, name: ref?.name ?? null, label: raw })
    if (/^[12][A-L]$/.test(raw)) return slot(placement.get(raw) ?? null)
    if (/^3/.test(raw)) return slot(thirdMap.get(raw) ?? null)
    const w = raw.match(/^W(\d+)$/)
    if (w) return slot(resultByNo.get(+w[1])?.winner ?? null)
    const l = raw.match(/^L(\d+)$/)
    if (l) return slot(resultByNo.get(+l[1])?.loser ?? null)
    return slot(null)
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
