# Knockout Bracket on the Standings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Group Stage / Knockout toggle to the Standings page, where the Knockout view shows a live-updating bracket resolved from the app's own match results, with Google-style penalty scores.

**Architecture:** A new pure `resolveBracket(matches)` turns the seeded label slots (`2A`, `3A/B/C/D/F`, `W74`, `L101`) into real teams using the existing `computeStandings()` plus match results — display-only, no DB writes, so it rides the existing realtime subscription. The Standings screen gets a top segmented toggle (matching the Matches deck/grid control) that defaults to Knockout once the group stage is complete. Penalties are stored in two new nullable columns, auto-captured by the `tick` edge function, and shown under the score on both the main match card and the knockout cards.

**Tech Stack:** React 18 + TypeScript, Tailwind, Vitest + Testing Library, Supabase (Postgres + Deno edge functions), API-Football.

## Global Constraints

- **Styling:** Tailwind only, using the project tokens `ink` (#141210) and `paper` (#f2eee2). Toggle controls use the established pattern: `border-[3px] border-ink`, `font-display`, active tab inverts to `bg-ink text-paper`.
- **No new API integration.** Only the existing API-Football response is read; only the `tick` function changes server-side.
- **Display-only bracket.** `resolveBracket` never mutates `matches`; the DB keeps the label slots.
- **Test runner:** `npx vitest run <path>` for a single file; tests live beside source as `*.test.ts(x)`.
- **Group label format:** group rows are labelled `Group A` … `Group L`; slot labels use the bare letter (`2A`). Knockout rows have `stage !== 'group'` and `home_code`/`away_code` null until resolved.
- **Migration numbering:** next file is `0024_`.

---

### Task 1: Penalty columns + Match type

**Files:**
- Create: `supabase/migrations/0024_penalties.sql`
- Modify: `src/lib/types.ts:9-27` (the `Match` interface)

**Interfaces:**
- Produces: `Match.home_pens?: number | null`, `Match.away_pens?: number | null` — consumed by Tasks 2, 3, 4.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0024_penalties.sql`:

```sql
-- Penalty shoot-out score for knockout games that finish level after extra time.
-- Nullable; only set when a match was decided on penalties.
alter table matches add column if not exists home_pens int;
alter table matches add column if not exists away_pens int;
```

- [ ] **Step 2: Add the fields to the `Match` type**

In `src/lib/types.ts`, the `Match` interface currently has this line (line 17):

```ts
  live_home?: number | null; live_away?: number | null; live_minute?: number | null; live_status?: string | null
```

Add a new line directly after it:

```ts
  home_pens?: number | null; away_pens?: number | null
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (a clean exit, or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0024_penalties.sql src/lib/types.ts
git commit -m "feat(db): add penalty-score columns to matches"
```

---

### Task 2: `resolveBracket` — bracket resolution library

**Files:**
- Create: `src/lib/bracket.ts`
- Test: `src/lib/bracket.test.ts`

**Interfaces:**
- Consumes: `computeStandings(matches)` from `./standings`; `Match` (incl. `home_pens`/`away_pens`) from `./types`.
- Produces:
  - `interface BracketSlot { code: string | null; name: string | null; label: string }`
  - `interface BracketMatch { id: string; match_no: number | null; stage: Stage; kickoff_at: string; multiplier: number; status: Match['status']; home: BracketSlot; away: BracketSlot; home_score: number | null; away_score: number | null; home_pens: number | null; away_pens: number | null; live_home: number | null; live_away: number | null; live_minute: number | null; live_status: string | null; winnerCode: string | null }`
  - `const KO_TABS` (Task 6 consumes it): `{ key: string; label: string; stages: Stage[] }[]`
  - `function resolveBracket(matches: Match[]): BracketMatch[]`
  - `function assignThirdPlaces(slots, thirds): Map<string, { code: string; name: string }>` (exported for testing)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/bracket.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { resolveBracket, assignThirdPlaces } from './bracket'
import type { Match } from './types'

let _id = 0
function mk(p: Partial<Match>): Match {
  return {
    id: String(++_id), match_no: null, stage: 'group', group_label: null,
    home_code: null, away_code: null, home_label: null, away_label: null,
    kickoff_at: '2026-06-11T00:00:00Z', home_score: null, away_score: null,
    home_pens: null, away_pens: null,
    multiplier: 1, status: 'scheduled', prob_home: null, prob_draw: null, prob_away: null,
    ...p,
  } as Match
}
// A finished group match.
function g(group: string, home: string, away: string, hs: number, as_: number): Match {
  return mk({
    stage: 'group', group_label: group, home_code: home, away_code: away,
    home_label: home.toUpperCase(), away_label: away.toUpperCase(),
    home_score: hs, away_score: as_, status: 'finished',
  })
}
// Group A: mx 1st, kr 2nd. Group B: br 1st, ar 2nd. Both groups complete.
function twoDoneGroups(): Match[] {
  return [
    g('Group A', 'mx', 'za', 2, 0), g('Group A', 'mx', 'kr', 2, 1),
    g('Group A', 'kr', 'za', 2, 0), g('Group A', 'za', 'mx', 0, 1),
    g('Group A', 'kr', 'mx', 0, 1), g('Group A', 'za', 'kr', 0, 1),
    g('Group B', 'br', 'cm', 2, 0), g('Group B', 'br', 'ar', 2, 1),
    g('Group B', 'ar', 'cm', 2, 0), g('Group B', 'cm', 'br', 0, 1),
    g('Group B', 'ar', 'br', 0, 1), g('Group B', 'cm', 'ar', 0, 1),
  ]
}

describe('assignThirdPlaces', () => {
  test('produces a complete, constraint-valid matching', () => {
    const slots = [
      { label: '3A/B/C/D/F', allowed: ['A', 'B', 'C', 'D', 'F'] },
      { label: '3C/D/F/G/H', allowed: ['C', 'D', 'F', 'G', 'H'] },
      { label: '3A/E/H/I/J', allowed: ['A', 'E', 'H', 'I', 'J'] },
      { label: '3E/H/I/J/K', allowed: ['E', 'H', 'I', 'J', 'K'] },
      { label: '3B/E/F/I/J', allowed: ['B', 'E', 'F', 'I', 'J'] },
      { label: '3E/F/G/I/J', allowed: ['E', 'F', 'G', 'I', 'J'] },
      { label: '3C/E/F/H/I', allowed: ['C', 'E', 'F', 'H', 'I'] },
      { label: '3D/E/I/J/L', allowed: ['D', 'E', 'I', 'J', 'L'] },
    ]
    const thirds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(letter =>
      ({ letter, code: letter.toLowerCase(), name: `T${letter}` }))
    const out = assignThirdPlaces(slots, thirds)
    expect(out.size).toBe(8)
    // every slot got a third whose group letter is in its allowed set, no duplicates
    const usedLetters = new Set<string>()
    for (const s of slots) {
      const ref = out.get(s.label)!
      expect(ref).toBeDefined()
      expect(s.allowed).toContain(ref.code.toUpperCase())
      expect(usedLetters.has(ref.code)).toBe(false)
      usedLetters.add(ref.code)
    }
  })
})

describe('resolveBracket', () => {
  test('returns only knockout matches, sorted by match_no', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 74, stage: 'r32', home_label: '2A', away_label: '2B', multiplier: 1.5 }),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B', multiplier: 1.5 }),
    ])
    expect(out.map(b => b.match_no)).toEqual([73, 74])
  })

  test('resolves group-placement slots once both groups are complete', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(b => b.match_no === 73)!
    expect(m.home).toMatchObject({ code: 'mx', label: '1A' }) // Group A winner
    expect(m.away).toMatchObject({ code: 'ar', label: '2B' }) // Group B runner-up
  })

  test('leaves a slot TBD (null code, raw label) while its group is unfinished', () => {
    const out = resolveBracket([
      g('Group A', 'mx', 'za', 2, 0), // group A not complete
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
    ])
    const m = out.find(b => b.match_no === 73)!
    expect(m.home).toMatchObject({ code: null, label: '1A' })
  })

  test('resolves W/L from a finished knockout game decided on penalties', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      // r32 #73: mx (1A) vs br (1B), 1-1, mx win 4-3 on pens
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B',
        home_score: 1, away_score: 1, home_pens: 4, away_pens: 3, status: 'finished', multiplier: 1.5 }),
      // r16 #89: winner of 73 vs runner-up of A
      mk({ match_no: 89, stage: 'r16', home_label: 'W73', away_label: '2A', multiplier: 2 }),
      // third-place style loser reference
      mk({ match_no: 90, stage: 'r16', home_label: 'L73', away_label: '2B', multiplier: 2 }),
    ])
    const r32 = out.find(b => b.match_no === 73)!
    expect(r32.winnerCode).toBe('mx')
    const r16w = out.find(b => b.match_no === 89)!
    expect(r16w.home).toMatchObject({ code: 'mx', label: 'W73' })
    const r16l = out.find(b => b.match_no === 90)!
    expect(r16l.home).toMatchObject({ code: 'br', label: 'L73' })
  })

  test('winnerCode is null for a level game with no penalties', () => {
    const out = resolveBracket([
      ...twoDoneGroups(),
      mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '1B',
        home_score: 1, away_score: 1, status: 'finished', multiplier: 1.5 }),
    ])
    expect(out.find(b => b.match_no === 73)!.winnerCode).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/bracket.test.ts`
Expected: FAIL — `resolveBracket`/`assignThirdPlaces` not found (module missing).

- [ ] **Step 3: Implement `src/lib/bracket.ts`**

Create `src/lib/bracket.ts`:

```ts
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
  const groupMatches = matches.filter(m => m.stage === 'group' && m.group_label)
  const groupDone = new Map<string, boolean>()
  for (const m of groupMatches) {
    const prev = groupDone.get(m.group_label!)
    const done = m.status === 'finished'
    groupDone.set(m.group_label!, prev === undefined ? done : prev && done)
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/bracket.test.ts`
Expected: PASS (all tests in both describes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket.ts src/lib/bracket.test.ts
git commit -m "feat(bracket): resolve knockout slots from standings + results"
```

---

### Task 3: Capture penalty scores in the `tick` edge function

**Files:**
- Modify: `supabase/functions/tick/index.ts` (the `FT_SHORT` full-time block, ~lines 115-122)

**Interfaces:**
- Consumes: `Match.home_pens`/`away_pens` columns (Task 1). API-Football fixture shape `f.score.penalty.{home,away}`.
- Produces: nothing for later tasks (server-side write only).

- [ ] **Step 1: Add penalty capture to the full-time write**

In `supabase/functions/tick/index.ts`, find this block inside `if (FT_SHORT.has(short)) {`:

```ts
          const hg = f.goals?.home, ag = f.goals?.away
          if (hg != null && ag != null) {
            await db.from('matches')
              .update({ home_score: hg, away_score: ag, live_home: null, live_away: null, live_minute: null, live_status: null })
              .eq('id', m.id)
```

Replace it with (adds `pen_h`/`pen_a` and writes them):

```ts
          const hg = f.goals?.home, ag = f.goals?.away
          // Penalty shoot-out score (only present when the game was decided on pens).
          const pen_h = f.score?.penalty?.home ?? null
          const pen_a = f.score?.penalty?.away ?? null
          if (hg != null && ag != null) {
            await db.from('matches')
              .update({ home_score: hg, away_score: ag, home_pens: pen_h, away_pens: pen_a, live_home: null, live_away: null, live_minute: null, live_status: null })
              .eq('id', m.id)
```

- [ ] **Step 2: Verify the edit landed and is well-formed**

Run: `grep -n "home_pens: pen_h" supabase/functions/tick/index.ts`
Expected: one match, inside the full-time update.

Run: `npx tsc --noEmit` (the edge file is Deno, excluded from the app tsconfig; this confirms no app-side breakage)
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/tick/index.ts
git commit -m "feat(tick): capture penalty score on full-time"
```

> **Deploy note (not part of TDD):** `tick` must be deployed with `verify_jwt=false` (custom `CRON_SECRET`) — see the `tick verify_jwt gotcha` memory. Migration `0024` and this function deploy are operational steps done after the branch merges.

---

### Task 4: Penalty line under the score (`PensLine`) + main card

**Files:**
- Modify: `src/components/matchFace.tsx` (add `PensLine`, after `ScoreLine` ~line 259)
- Modify: `src/components/MatchCard.tsx:123-127` (finished branch)
- Test: `src/components/matchFace.test.tsx` (append cases)

**Interfaces:**
- Consumes: nothing new.
- Produces: `function PensLine({ home, away, className? }): JSX.Element | null` — consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/matchFace.test.tsx`:

```ts
import { PensLine } from './matchFace'

test('PensLine renders the penalty score when both are present', () => {
  render(<PensLine home={4} away={3} />)
  expect(screen.getByText(/penalties 4.?3/i)).toBeInTheDocument()
})

test('PensLine renders nothing without a penalty score', () => {
  const { container } = render(<PensLine home={null} away={2} />)
  expect(container).toBeEmptyDOMElement()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/matchFace.test.tsx`
Expected: FAIL — `PensLine` is not exported.

- [ ] **Step 3: Add `PensLine` to `matchFace.tsx`**

In `src/components/matchFace.tsx`, directly after the `ScoreLine` function (it ends at line 259 with its closing `}`), add:

```tsx
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
```

- [ ] **Step 4: Show it on the main card**

In `src/components/MatchCard.tsx`, the finished branch currently reads (lines 123-127):

```tsx
        ) : finished ? (
          <div>
            <div className="font-sans font-900 text-[11px] uppercase tracking-widest opacity-80 leading-none">Full time</div>
            <ScoreLine home={match.home_score} away={match.away_score} className="text-[clamp(41px,calc(var(--app-vh)*0.084),67px)] mt-1" />
          </div>
```

Replace it with (adds the `PensLine` and the import):

```tsx
        ) : finished ? (
          <div>
            <div className="font-sans font-900 text-[11px] uppercase tracking-widest opacity-80 leading-none">Full time</div>
            <ScoreLine home={match.home_score} away={match.away_score} className="text-[clamp(41px,calc(var(--app-vh)*0.084),67px)] mt-1" />
            <PensLine home={match.home_pens} away={match.away_pens} className="text-[10px] mt-1" />
          </div>
```

Then update the import on line 6 of `MatchCard.tsx`:

```tsx
import { GameInfo, TopThreePredictors, FlagPanel, TeamNameBar, PointsStar, ScoreLine } from './matchFace'
```

to:

```tsx
import { GameInfo, TopThreePredictors, FlagPanel, TeamNameBar, PointsStar, ScoreLine, PensLine } from './matchFace'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/matchFace.test.tsx src/components/MatchCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/matchFace.tsx src/components/MatchCard.tsx src/components/matchFace.test.tsx
git commit -m "feat(card): show Google-style penalty line under the score"
```

---

### Task 5: `KnockoutCard` — one knockout matchup

**Files:**
- Create: `src/components/KnockoutCard.tsx`
- Test: `src/components/KnockoutCard.test.tsx`

**Interfaces:**
- Consumes: `BracketMatch` from `../lib/bracket`; `Flag` from `./Flag`; `PensLine` from `./matchFace`.
- Produces: `function KnockoutCard({ match }: { match: BracketMatch }): JSX.Element` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Create `src/components/KnockoutCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { KnockoutCard } from './KnockoutCard'
import type { BracketMatch } from '../lib/bracket'

function bm(p: Partial<BracketMatch>): BracketMatch {
  return {
    id: '1', match_no: 73, stage: 'r32', kickoff_at: '2026-06-28T19:00:00Z',
    multiplier: 1.5, status: 'scheduled',
    home: { code: null, name: null, label: '1A' },
    away: { code: null, name: null, label: '2B' },
    home_score: null, away_score: null, home_pens: null, away_pens: null,
    live_home: null, live_away: null, live_minute: null, live_status: null,
    winnerCode: null, ...p,
  }
}

test('shows the raw label for an unresolved (TBD) slot', () => {
  render(<KnockoutCard match={bm({})} />)
  expect(screen.getByText('1A')).toBeInTheDocument()
  expect(screen.getByText('2B')).toBeInTheDocument()
})

test('shows team names and a final score when resolved', () => {
  render(<KnockoutCard match={bm({
    status: 'finished',
    home: { code: 'mx', name: 'Mexico', label: '1A' },
    away: { code: 'br', name: 'Brazil', label: '2B' },
    home_score: 2, away_score: 1, winnerCode: 'mx',
  })} />)
  expect(screen.getByText('Mexico')).toBeInTheDocument()
  expect(screen.getByText('Brazil')).toBeInTheDocument()
})

test('shows the penalty line for a game decided on penalties', () => {
  render(<KnockoutCard match={bm({
    status: 'finished',
    home: { code: 'mx', name: 'Mexico', label: '1A' },
    away: { code: 'br', name: 'Brazil', label: '2B' },
    home_score: 1, away_score: 1, home_pens: 4, away_pens: 3, winnerCode: 'mx',
  })} />)
  expect(screen.getByText(/penalties 4.?3/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/KnockoutCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/KnockoutCard.tsx`**

Create `src/components/KnockoutCard.tsx`:

```tsx
import type { BracketMatch, BracketSlot } from '../lib/bracket'
import { Flag } from './Flag'
import { PensLine } from './matchFace'

// One side of the matchup: flag (or TBD placeholder) + name, with its score.
// A resolved slot shows its team; an unresolved slot shows the raw label (e.g. '2A').
function SlotRow({ slot, score, isWinner }:
  { slot: BracketSlot; score: number | null; isWinner: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 ${isWinner ? 'bg-green' : ''}`}>
      <Flag code={slot.code} label={slot.label} size="sm" />
      <span className="flex-1 min-w-0 truncate font-display text-[15px] uppercase">
        {slot.name ?? slot.label}
      </span>
      <span className="font-display text-[18px] tabular-nums w-[20px] text-right">
        {score == null ? '' : score}
      </span>
    </div>
  )
}

export function KnockoutCard({ match }: { match: BracketMatch }) {
  const live = match.status !== 'finished' && match.live_home != null
  const finished = match.status === 'finished'
  const homeScore = finished ? match.home_score : live ? match.live_home : null
  const awayScore = finished ? match.away_score : live ? match.live_away : null

  return (
    <div className="border-[3px] border-ink bg-paper mb-3">
      {/* Feeder tag: where each side comes from (e.g. 'W73 · W75'). */}
      <div className="flex items-center justify-between px-2 py-1 bg-ink text-paper">
        <span className="font-sans font-900 text-[9px] uppercase tracking-widest">
          {match.home.label} · {match.away.label}
        </span>
        {live && (
          <span className="font-sans font-900 text-[9px] uppercase tracking-widest">
            <span className="live-dot">●</span> Live{match.live_minute ? ` ${match.live_minute}'` : ''}
          </span>
        )}
        {finished && (
          <span className="font-sans font-900 text-[9px] uppercase tracking-widest opacity-70">Full time</span>
        )}
      </div>
      <SlotRow slot={match.home} score={homeScore} isWinner={match.winnerCode != null && match.winnerCode === match.home.code} />
      <div className="h-[2px] bg-ink/10" />
      <SlotRow slot={match.away} score={awayScore} isWinner={match.winnerCode != null && match.winnerCode === match.away.code} />
      {(match.home_pens != null || match.away_pens != null) && (
        <PensLine home={match.home_pens} away={match.away_pens} className="text-[9px] px-2 py-1 text-center text-ink/70" />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/KnockoutCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/KnockoutCard.tsx src/components/KnockoutCard.test.tsx
git commit -m "feat(knockout): KnockoutCard matchup component"
```

---

### Task 6: `KnockoutBracket` — round sub-tabs + card list

**Files:**
- Create: `src/components/KnockoutBracket.tsx`
- Test: `src/components/KnockoutBracket.test.tsx`

**Interfaces:**
- Consumes: `resolveBracket`, `KO_TABS`, `BracketMatch` from `../lib/bracket`; `KnockoutCard` from `./KnockoutCard`; `Match` from `../lib/types`.
- Produces: `function KnockoutBracket({ matches }: { matches: Match[] }): JSX.Element` — consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

Create `src/components/KnockoutBracket.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { KnockoutBracket } from './KnockoutBracket'
import type { Match } from '../lib/types'

let _id = 0
function mk(p: Partial<Match>): Match {
  return {
    id: String(++_id), match_no: null, stage: 'group', group_label: null,
    home_code: null, away_code: null, home_label: null, away_label: null,
    kickoff_at: '2026-06-28T00:00:00Z', home_score: null, away_score: null,
    home_pens: null, away_pens: null, multiplier: 1, status: 'scheduled',
    prob_home: null, prob_draw: null, prob_away: null, ...p,
  } as Match
}

const knockout: Match[] = [
  mk({ match_no: 73, stage: 'r32', home_label: '1A', away_label: '2B', multiplier: 1.5 }),
  mk({ match_no: 89, stage: 'r16', home_label: 'W73', away_label: 'W75', multiplier: 2 }),
  mk({ match_no: 104, stage: 'final', home_label: 'W101', away_label: 'W102', multiplier: 6 }),
]

test('renders a sub-tab for every knockout round', () => {
  render(<KnockoutBracket matches={knockout} />)
  for (const label of ['R32', 'R16', 'QF', 'SF', 'Final']) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  }
})

test('defaults to the earliest round that still has an undecided match', () => {
  render(<KnockoutBracket matches={knockout} />)
  // R32 #73 is unfinished → R32 tab is active
  expect(screen.getByRole('button', { name: 'R32' })).toHaveAttribute('aria-pressed', 'true')
})

test('defaults to the Final tab when every round is finished', () => {
  const allDone = knockout.map(m => ({ ...m, status: 'finished' as const, home_score: 1, away_score: 0 }))
  render(<KnockoutBracket matches={allDone} />)
  expect(screen.getByRole('button', { name: 'Final' })).toHaveAttribute('aria-pressed', 'true')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/KnockoutBracket.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/KnockoutBracket.tsx`**

Create `src/components/KnockoutBracket.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type { Match } from '../lib/types'
import { resolveBracket, KO_TABS, type BracketMatch } from '../lib/bracket'
import { KnockoutCard } from './KnockoutCard'

// The default tab = the earliest round (in KO_TABS order) that still has an
// undecided game, so opening Knockout lands on "what's live / next". If every
// game is finished, fall back to the last tab (Final).
function defaultTab(byTab: BracketMatch[][]): string {
  for (let i = 0; i < KO_TABS.length; i++) {
    if (byTab[i].some(m => m.status !== 'finished')) return KO_TABS[i].key
  }
  return KO_TABS[KO_TABS.length - 1].key
}

export function KnockoutBracket({ matches }: { matches: Match[] }) {
  const bracket = useMemo(() => resolveBracket(matches), [matches])
  const byTab = useMemo(
    () => KO_TABS.map(t => bracket
      .filter(m => t.stages.includes(m.stage))
      .sort((a, b) => (a.match_no ?? 0) - (b.match_no ?? 0))),
    [bracket],
  )
  const [tab, setTab] = useState(() => defaultTab(byTab))

  const activeIndex = KO_TABS.findIndex(t => t.key === tab)
  const cards = byTab[activeIndex] ?? []

  return (
    <div className="flex flex-col">
      {/* Round sub-tabs — lighter than the top toggle. */}
      <div className="flex gap-0 mb-3 border-[3px] border-ink shrink-0">
        {KO_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
            className={`flex-1 font-display text-[12px] uppercase tracking-wide py-1.5 border-r-[3px] border-ink last:border-r-0 ${tab === t.key ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {cards.length === 0
        ? <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">No games in this round yet.</p>
        : cards.map(m => <KnockoutCard key={m.id} match={m} />)}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/KnockoutBracket.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/KnockoutBracket.tsx src/components/KnockoutBracket.test.tsx
git commit -m "feat(knockout): KnockoutBracket round sub-tabs + list"
```

---

### Task 7: Standings page top toggle + auto-default

**Files:**
- Modify: `src/screens/Standings.tsx`
- Test: `src/screens/Standings.test.tsx` (create)

**Interfaces:**
- Consumes: `useMatches` from `../hooks/useMatches`; `computeStandings` from `../lib/standings`; `StandingsTable`; `KnockoutBracket` from `../components/KnockoutBracket`.
- Produces: the finished feature (no later task depends on it).

- [ ] **Step 1: Write the failing tests**

Create `src/screens/Standings.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi, beforeEach, test, expect } from 'vitest'
import type { Match } from '../lib/types'

let _id = 0
function mk(p: Partial<Match>): Match {
  return {
    id: String(++_id), match_no: null, stage: 'group', group_label: null,
    home_code: null, away_code: null, home_label: null, away_label: null,
    kickoff_at: '2026-06-12T00:00:00Z', home_score: null, away_score: null,
    home_pens: null, away_pens: null, multiplier: 1, status: 'scheduled',
    prob_home: null, prob_draw: null, prob_away: null, ...p,
  } as Match
}

// Controllable mock of the data hook.
let mockMatches: Match[] = []
vi.mock('../hooks/useMatches', () => ({ useMatches: () => ({ matches: mockMatches, loading: false }) }))

// Stub the bracket child so this test focuses on the toggle, not bracket internals.
vi.mock('../components/KnockoutBracket', () => ({ KnockoutBracket: () => <div data-testid="knockout" /> }))

import { Standings } from './Standings'

beforeEach(() => { _id = 0 })

test('shows both toggle tabs', async () => {
  mockMatches = [mk({ stage: 'group', group_label: 'Group A', home_code: 'mx', away_code: 'za', home_label: 'Mexico', away_label: 'South Africa', home_score: 2, away_score: 0, status: 'finished' })]
  render(<Standings />)
  expect(screen.getByRole('button', { name: /group stage/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /knockout/i })).toBeInTheDocument()
})

test('defaults to Group Stage while the group stage is incomplete', () => {
  mockMatches = [mk({ stage: 'group', group_label: 'Group A', home_code: 'mx', away_code: 'za', status: 'scheduled' })]
  render(<Standings />)
  expect(screen.getByRole('button', { name: /group stage/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByTestId('knockout')).toBeNull()
})

test('defaults to Knockout once every group game is finished', () => {
  mockMatches = [
    mk({ stage: 'group', group_label: 'Group A', home_code: 'mx', away_code: 'za', home_score: 1, away_score: 0, status: 'finished' }),
    mk({ stage: 'r32', home_label: '1A', away_label: '2B', match_no: 73, multiplier: 1.5 }),
  ]
  render(<Standings />)
  expect(screen.getByRole('button', { name: /knockout/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('knockout')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/screens/Standings.test.tsx`
Expected: FAIL — toggle buttons don't exist yet.

- [ ] **Step 3: Rewrite `src/screens/Standings.tsx`**

Replace the entire contents of `src/screens/Standings.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { useMatches } from '../hooks/useMatches'
import { computeStandings } from '../lib/standings'
import { StandingsTable } from '../components/StandingsTable'
import { KnockoutBracket } from '../components/KnockoutBracket'

type Tab = 'group' | 'knockout'

export function Standings() {
  const { matches, loading } = useMatches()
  const groups = useMemo(() => computeStandings(matches), [matches])

  // The group stage is "done" when every group game has finished.
  const groupStageComplete = useMemo(() => {
    const gs = matches.filter(m => m.stage === 'group')
    return gs.length > 0 && gs.every(m => m.status === 'finished')
  }, [matches])

  // Default to Knockout once the group stage is complete; otherwise Group Stage.
  const [tab, setTab] = useState<Tab | null>(null)
  const active: Tab = tab ?? (groupStageComplete ? 'knockout' : 'group')

  if (loading) return <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">Loading standings…</p>

  return (
    <>
      {/* Group Stage / Knockout toggle — same pattern as the Matches deck/grid control. */}
      <div className="flex gap-0 mb-4 border-[3px] border-ink shrink-0">
        {([['group', 'Group Stage'], ['knockout', 'Knockout']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} aria-pressed={active === v}
            className={`flex-1 font-display text-[13px] uppercase tracking-wide py-2 border-r-[3px] border-ink last:border-r-0 ${active === v ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {active === 'knockout' ? (
        <KnockoutBracket matches={matches} />
      ) : (
        <>
          {groups.length === 0
            ? <p className="font-sans font-700 text-ink/60 uppercase text-sm tracking-wide">No groups yet.</p>
            : groups.map(g => <StandingsTable key={g.label} group={g} />)}

          {/* Legend */}
          {groups.length > 0 && (
            <div className="flex items-center gap-4 mt-3 font-sans font-900 text-[10px] uppercase tracking-widest text-ink/60">
              <span className="flex items-center gap-1.5">
                <span className="w-[14px] h-[14px] bg-green border-[2px] border-ink inline-block" />Advance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-[14px] h-[14px] border-[2px] border-dashed border-green inline-block" />Wildcard
              </span>
            </div>
          )}
        </>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/screens/Standings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite + type-check**

Run: `npm test`
Expected: all tests pass (no regressions).

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Standings.tsx src/screens/Standings.test.tsx
git commit -m "feat(standings): Group Stage / Knockout toggle with auto-default"
```

---

## Operational follow-up (after merge, not part of TDD)

1. Apply migration `0024_penalties.sql` to the cloud Supabase project (`ekgaegdtozqeziyycoul`) — use the deploy token from the `Supabase Fifa26 deploy token` memory.
2. Redeploy the `tick` edge function with `verify_jwt=false` (see `tick verify_jwt gotcha` memory) so penalty capture goes live.
3. Manual verification: in the running app, open Standings → confirm the toggle, switch to Knockout, confirm round sub-tabs and that resolved slots show real teams for completed groups while undecided ones show their labels.

## Self-Review

- **Spec coverage:** top toggle (Task 7) ✓; auto-default to Knockout when group stage done (Task 7) ✓; `resolveBracket` pure + display-only with group/W/L/third resolution (Task 2) ✓; deterministic third-place constrained match with official-table note (Task 2) ✓; penalty columns + type (Task 1) ✓; penalty capture in `tick` (Task 3) ✓; Google-style penalty line on main card + knockout card (Tasks 4, 5) ✓; round sub-tabs + earliest-undecided default (Task 6) ✓; feeder tag (Task 5) ✓; Matches deck/grid untouched (scope honored) ✓.
- **Placeholder scan:** no TBD/TODO/"handle edge cases"; every code step shows full code.
- **Type consistency:** `BracketMatch`/`BracketSlot`/`KO_TABS`/`resolveBracket`/`assignThirdPlaces` names are used identically across Tasks 2, 5, 6; `PensLine` signature matches between Tasks 4 and 5; `Match.home_pens`/`away_pens` introduced in Task 1 and consumed consistently.
