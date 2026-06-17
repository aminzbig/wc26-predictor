# Live Projected Picks ("Halo" mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During a live match, the "Everyone's picks" board shows each person's *projected* points from the current live score, sorted and animated as goals go in, with a glowing "not finalized" halo that settles into the existing final leaderboard at Full-Time.

**Architecture:** Pure projection helpers in `src/lib/` (reusing the existing `basePoints` scorer), consumed by a new `live` branch inside the presentational `PicksBoard` in `MatchDetail.tsx`. No new data flow — the `match` prop already re-renders on every realtime `live_home`/`live_away` update. CSS keyframes in `index.css` provide the halo; framer-motion `layout` (already a dependency) animates the re-sort.

**Tech Stack:** React 19, TypeScript, framer-motion 12, Tailwind, Vitest, Supabase realtime.

## Global Constraints

- Scoring is **additive** and must match `basePoints` in `src/lib/scoring.ts` exactly: outcome 10, goalsHome 5, goalsAway 5, goalDiff 5, scoreBonus 5, risky 10. The live projection passes **`risky = false`** (risky is server-only, computed from the field distribution at Full-Time).
- Final points = `basePoints × match.multiplier`; the live projection multiplies the same way for parity.
- Palette only: paper `#f2eee2`, ink `#141210`, yellow `#ffd200`. The halo glow uses yellow.
- Poster aesthetic: 3px ink borders, `font-display`, uppercase. Do not introduce new fonts/colors.
- Test command: `npm test` (Vitest). Build check: `npm run build`. Lint: `npm run lint`.
- Do not touch backend (`supabase/`), `MatchCard`, `MatchTile`, or `types.ts`.

---

### Task 1: `projectedPoints` helper

**Files:**
- Modify: `src/lib/scoring.ts` (append after `basePoints`)
- Test: `src/lib/scoring.test.ts` (append cases)

**Interfaces:**
- Consumes: `basePoints(p: {hp,ap}, r: {hs,as}, pts?, risky?)` (existing).
- Produces: `projectedPoints(p: { hp: number; ap: number }, r: { hs: number; as: number }, multiplier?: number): number` — `basePoints` with `risky=false`, multiplied and rounded.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/scoring.test.ts`:

```typescript
import { basePoints, projectedPoints } from './scoring'

describe('projectedPoints (live projection)', () => {
  test('exact live score = basePoints, multiplier 1', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 })).toBe(30)
  })
  test('applies the match multiplier', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 }, 2)).toBe(60)
  })
  test('never adds the risky bonus (server-only)', () => {
    // pred 1-0 on live 1-0: exact win = 30. With risky it would be 40 — must stay 30.
    expect(projectedPoints({ hp: 1, ap: 0 }, { hs: 1, as: 0 })).toBe(30)
  })
  test('missed pick projects 0', () => {
    expect(projectedPoints({ hp: 2, ap: 1 }, { hs: 0, as: 3 })).toBe(0)
  })
})
```

> Note: the existing file already imports `basePoints`; change its import line to `import { basePoints, projectedPoints } from './scoring'` and do not duplicate the import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/scoring.test.ts`
Expected: FAIL — `projectedPoints is not a function` / not exported.

- [ ] **Step 3: Implement the helper**

Append to `src/lib/scoring.ts`:

```typescript
// Live projection: what a pick would score if the match ended at result `r` right now.
// risky is intentionally omitted — it depends on the whole field and is computed
// server-side at Full-Time. Multiplied and rounded to match the final figure.
export function projectedPoints(
  p: { hp: number; ap: number },
  r: { hs: number; as: number },
  multiplier = 1,
): number {
  return Math.round(basePoints(p, r) * multiplier)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/scoring.test.ts`
Expected: PASS (all `basePoints` and `projectedPoints` cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat(scoring): projectedPoints helper for live picks"
```

---

### Task 2: `rankLivePicks` — sort + dense rank by projection

**Files:**
- Create: `src/lib/livePicks.ts`
- Test: `src/lib/livePicks.test.ts`

**Interfaces:**
- Consumes: `projectedPoints` (Task 1).
- Produces: `rankLivePicks<T extends { home_pred: number; away_pred: number; name: string }>(rows: T[], live: { home: number; away: number }, multiplier?: number): Array<T & { proj: number; rank: number }>` — rows sorted by `proj` desc then `name` asc, each annotated with `proj` and a dense competition `rank` (1,2,3,3,5…).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/livePicks.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { rankLivePicks } from './livePicks'

const pick = (name: string, home_pred: number, away_pred: number) => ({ name, home_pred, away_pred })

describe('rankLivePicks', () => {
  test('sorts by projected points desc and assigns rank', () => {
    const rows = [pick('Bob', 0, 0), pick('Ann', 1, 0)] // live 1-0: Ann exact=30, Bob=5
    const out = rankLivePicks(rows, { home: 1, away: 0 })
    expect(out.map(r => r.name)).toEqual(['Ann', 'Bob'])
    expect(out.map(r => r.proj)).toEqual([30, 5])
    expect(out.map(r => r.rank)).toEqual([1, 2])
  })

  test('dense ranking: ties share a place, next distinct score skips ahead', () => {
    // live 1-0. Ann 1-0 -> 30, Cy 2-0 -> outcome10+away5=15, Dan 3-0 -> 15, Bob 0-0 -> 5
    const rows = [pick('Bob', 0, 0), pick('Cy', 2, 0), pick('Ann', 1, 0), pick('Dan', 3, 0)]
    const out = rankLivePicks(rows, { home: 1, away: 0 })
    expect(out.map(r => [r.name, r.proj, r.rank])).toEqual([
      ['Ann', 30, 1],
      ['Cy', 15, 2],
      ['Dan', 15, 2],
      ['Bob', 5, 4],
    ])
  })

  test('tie in proj breaks alphabetically by name', () => {
    const rows = [pick('Zoe', 2, 0), pick('Amy', 3, 0)] // live 1-0: both 15
    const out = rankLivePicks(rows, { home: 1, away: 0 })
    expect(out.map(r => r.name)).toEqual(['Amy', 'Zoe'])
  })

  test('applies multiplier to projections', () => {
    const out = rankLivePicks([pick('Ann', 1, 0)], { home: 1, away: 0 }, 3)
    expect(out[0].proj).toBe(90)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/livePicks.test.ts`
Expected: FAIL — cannot find module `./livePicks`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/livePicks.ts`:

```typescript
import { projectedPoints } from './scoring'

// Annotate each pick with its live projection, then sort (proj desc, name asc) and
// apply dense competition ranking (equal proj share a place; rank = 1 + how many
// picks project strictly higher). Pure — recomputed on each live-score render.
export function rankLivePicks<T extends { home_pred: number; away_pred: number; name: string }>(
  rows: T[],
  live: { home: number; away: number },
  multiplier = 1,
): Array<T & { proj: number; rank: number }> {
  const withProj = rows.map(r => ({
    ...r,
    proj: projectedPoints({ hp: r.home_pred, ap: r.away_pred }, { hs: live.home, as: live.away }, multiplier),
  }))
  const sorted = [...withProj].sort((a, b) => b.proj - a.proj || a.name.localeCompare(b.name))
  return sorted.map(r => ({ ...r, rank: withProj.filter(x => x.proj > r.proj).length + 1 }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/livePicks.test.ts`
Expected: PASS (all four cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/livePicks.ts src/lib/livePicks.test.ts
git commit -m "feat(picks): rankLivePicks — sort and dense-rank by live projection"
```

---

### Task 3: Wire live projection into `PicksBoard`

**Files:**
- Modify: `src/components/MatchDetail.tsx` — `PeoplePredictions` (lines 30-50) and `PicksBoard` (lines 54-125)

**Interfaces:**
- Consumes: `rankLivePicks` (Task 2), existing `resultTier` (same file), `Match` fields `live_status`, `live_home`, `live_away`, `live_minute`, `multiplier`.
- Produces: rendered live board; rows keyed by prediction `id`.

This task adds the **logic + provisional rendering** (static glow + animation come in Tasks 4-5). The finished and pre-kickoff paths must render exactly as before.

- [ ] **Step 1: Add the import**

At the top of `src/components/MatchDetail.tsx`, after the existing `import { supabase } ...` line, add:

```typescript
import { rankLivePicks } from '../lib/livePicks'
```

- [ ] **Step 2: Add `id` to the fetch and the `PeoplePick` type**

Change the `PeoplePick` type (line 9) to include `id`:

```typescript
type PeoplePick = { id: string; name: string; flag_code: string | null; home_pred: number; away_pred: number; points: number | null }
```

In `PeoplePredictions`, change the select (line 35) and the mapping (lines 39-42):

```typescript
    supabase.from('predictions')
      .select('id,home_pred,away_pred,points_awarded, players(name,flag_code)')
      .eq('match_id', match.id)
      .then(({ data }) => {
        if (!active) return
        const list: PeoplePick[] = (data ?? []).map((r: any) => ({
          id: r.id, name: r.players?.name ?? '?', flag_code: r.players?.flag_code ?? null,
          home_pred: r.home_pred, away_pred: r.away_pred, points: r.points_awarded,
        }))
        list.sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name))
        setRows(list)
      })
```

- [ ] **Step 3: Add live detection + unified ranked list in `PicksBoard`**

Replace the head of `PicksBoard` (lines 55-65, from `const scored =` through the `ranked` block) with:

```typescript
  const scored = match.status === 'finished' && match.home_score != null && match.away_score != null
  const live = !scored && match.live_status != null && match.live_home != null && match.live_away != null
  const hs = match.home_score ?? 0, as = match.away_score ?? 0
  const lh = match.live_home ?? 0, la = match.live_away ?? 0
  const topPoints = scored ? Math.max(0, ...rows.map(r => r.points ?? 0)) : 0

  // LIVE: rank by projected points from the current live score.
  // FINISHED / pre-kickoff: existing behavior (rank by awarded points, or none).
  const ranked = live
    ? rankLivePicks(rows, { home: lh, away: la }, match.multiplier ?? 1).map(r => ({
        ...r, points: r.proj, tier: resultTier(r.home_pred, r.away_pred, lh, la),
      }))
    : rows.map((r) => {
        const pts = r.points ?? 0
        const rank = rows.filter(x => (x.points ?? 0) > pts).length + 1
        return { ...r, rank, tier: scored ? resultTier(r.home_pred, r.away_pred, hs, as) : null }
      })
```

- [ ] **Step 4: Update the header label for live**

Replace the header status line (lines 72-74) with:

```typescript
        <div className="self-center px-2.5 font-sans font-900 text-[10px] uppercase tracking-widest text-yellow">
          {scored ? `Final · ${rows.length}` : live ? `Live · ${match.live_minute ?? 0}′ · projected` : `Locked · ${rows.length}`}
        </div>
```

- [ ] **Step 5: Key rows by id and show rank/tier/points for live**

In the `ranked.map(...)` body (lines 78-121), make these changes:

(a) Change the row key from index to id (line 83): `key={r.id}` instead of `key={i}`.

(b) Show the rank numeral for live too. Replace the `{scored && (` rank block opener (line 90) with `{(scored || live) && (` and change the starburst condition so only finished+top gets the burst — replace `isTop ? (` (line 91) with `(scored && isTop) ? (`.

(c) Show the tier line for live too. Replace `{scored && r.tier && (` (line 102) with `{(scored || live) && r.tier && (`.

(d) Render a provisional (outlined, translucent) points badge for live. Replace the final `{scored ? ( ... ) : ( ... )}` block (lines 110-118) with:

```tsx
              {scored ? (
                /* The hero figure — big inverted points block */
                <div className={`flex-none grid place-items-center w-[50px] h-[40px] border-2 border-ink ${pts > 0 ? 'bg-ink' : 'bg-transparent'}`}>
                  <div className={`font-display text-[22px] leading-none ${pts > 0 ? (isTop ? 'text-yellow' : 'text-paper') : 'text-ink/40'}`}>{pts}</div>
                  <div className={`mt-0.5 font-sans font-900 text-[6px] uppercase tracking-[0.2em] leading-none ${pts > 0 ? (isTop ? 'text-yellow/70' : 'text-paper/60') : 'text-ink/30'}`}>pts</div>
                </div>
              ) : live ? (
                /* Provisional — outlined, not solid: "still moving, not final" */
                <div className="flex-none grid place-items-center w-[50px] h-[40px] border-2 border-ink/50 bg-paper">
                  <div className="font-display text-[22px] leading-none text-ink">{pts}</div>
                  <div className="mt-0.5 font-sans font-900 text-[6px] uppercase tracking-[0.2em] leading-none text-ink/50">proj</div>
                </div>
              ) : (
                <div className="font-display text-[16px] leading-none">{r.home_pred}–{r.away_pred}</div>
              )}
```

> Context: in this map, `pts` is `r.points ?? 0` (line 79) and for live `r.points` is the projection (set in Step 3). `isTop` (line 80) is `scored && pts > 0 && pts === topPoints`, so it is already false during live — the `isTop` highlight row background never triggers live. Leave line 80 unchanged.

- [ ] **Step 6: Verify build, lint, and tests**

Run: `npm run build && npm run lint && npm test`
Expected: build succeeds, no new lint errors, all tests pass.

- [ ] **Step 7: Manual check**

Temporarily simulate a live match (in the DB or local seed: set a row's `live_status='2H'`, `live_home=1`, `live_away=0`, `live_minute=63`, leave `status='scheduled'`), open that match's detail. Expect: header reads `Live · 63′ · projected`, rows sorted by projected points with rank numerals and tier labels, outlined "proj" badges. Revert the seed after checking.

- [ ] **Step 8: Commit**

```bash
git add src/components/MatchDetail.tsx
git commit -m "feat(picks): live projected points board (sort, rank, provisional badge)"
```

---

### Task 4: Animated re-sort (framer-motion `layout`)

**Files:**
- Modify: `src/components/MatchDetail.tsx` — the row `motion.div` in `PicksBoard` (lines 82-88)

**Interfaces:**
- Consumes: stable `r.id` keys from Task 3. No new exports.

- [ ] **Step 1: Add the `layout` prop so rows slide when the sort order changes**

In the `ranked.map` row `motion.div` (lines 82-88), add `layout` and a layout transition. Replace the opening tag through its `transition` prop with:

```tsx
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                layout: { type: 'spring', stiffness: 380, damping: 30 },
                delay: Math.min(i * 0.04, 0.4), type: 'spring', stiffness: 320, damping: 26,
              }}
              className={`flex items-center gap-2 px-1.5 py-1.5 border-t-2 border-ink/10 first:border-t-0 ${isTop ? 'bg-yellow border-t-yellow' : ''}`}
            >
```

> Because rows are keyed by stable `id` (Task 3), framer-motion tracks each row across reorders and animates it to its new position when the live score changes the sort. No `AnimatePresence` needed — rows persist; only their order changes.

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: succeeds, no new errors.

- [ ] **Step 3: Manual check**

With the seeded live match from Task 3, change `live_home`/`live_away` (e.g. 1-0 → 1-1) and confirm rows physically slide to their new sorted positions rather than jumping. Revert the seed after.

- [ ] **Step 4: Commit**

```bash
git add src/components/MatchDetail.tsx
git commit -m "feat(picks): animate live board re-sort with framer layout"
```

---

### Task 5: "Not finalized" halo — steady glow + pulse on change

**Files:**
- Modify: `src/index.css` (append keyframes + classes)
- Modify: `src/components/MatchDetail.tsx` — add `HaloPoints` component, apply `halo-live` to live rows

**Interfaces:**
- Consumes: `live` flag and `pts` from Task 3.
- Produces: `HaloPoints({ value }: { value: number })` — the live points badge that pulses when `value` changes.

- [ ] **Step 1: Add the halo keyframes**

Append to `src/index.css`:

```css
/* live projected picks — provisional "not finalized" halo */
@keyframes halo-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 210, 0, 0); }
  50%      { box-shadow: 0 0 10px 1px rgba(255, 210, 0, .40); }
}
.halo-live { animation: halo-breathe 2.6s ease-in-out infinite; }

@keyframes halo-flash {
  0%   { box-shadow: 0 0 0 0 rgba(255, 210, 0, 0); }
  18%  { box-shadow: 0 0 16px 3px rgba(255, 210, 0, .85); }
  100% { box-shadow: 0 0 0 0 rgba(255, 210, 0, 0); }
}
.halo-pulse { animation: halo-flash .9s ease-out; }
```

- [ ] **Step 2: Apply the steady breathing glow to live rows**

In the row `motion.div` `className` (the line ending `...${isTop ? 'bg-yellow border-t-yellow' : ''}`), add the live glow. Change that template string to:

```tsx
              className={`flex items-center gap-2 px-1.5 py-1.5 border-t-2 border-ink/10 first:border-t-0 ${isTop ? 'bg-yellow border-t-yellow' : ''} ${live ? 'halo-live' : ''}`}
```

- [ ] **Step 3: Add the `HaloPoints` component**

Add this component just above `PicksBoard` (before line 52's comment) in `src/components/MatchDetail.tsx`:

```tsx
// Live projected-points badge: outlined (provisional), and emits a one-shot halo
// pulse whenever the projection changes — so a goal visibly ripples through the row.
function HaloPoints({ value }: { value: number }) {
  const prev = useRef(value)
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 900)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div className={`flex-none grid place-items-center w-[50px] h-[40px] border-2 border-ink/50 bg-paper ${pulse ? 'halo-pulse' : ''}`}>
      <div className="font-display text-[22px] leading-none text-ink/50">{value}</div>
      <div className="mt-0.5 font-sans font-900 text-[6px] uppercase tracking-[0.2em] leading-none text-ink/50">proj</div>
    </div>
  )
}
```

> `useRef`, `useState`, `useEffect` are already imported at the top of the file (line 1).

- [ ] **Step 4: Use `HaloPoints` for the live badge**

In the `{scored ? (...) : live ? (...) : (...)}` block from Task 3, replace the inline live badge (the `) : live ? (` branch's `<div className="flex-none ... bg-paper">...</div>`) with:

```tsx
              ) : live ? (
                <HaloPoints value={pts} />
              ) : (
```

- [ ] **Step 5: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: succeeds, no new errors, all tests pass.

- [ ] **Step 6: Manual check**

With the seeded live match: the board's live rows breathe with a soft yellow glow; changing the live score makes the moved row's badge flash brighter for ~1s; flipping the match to `status='finished'` with `home_score`/`away_score` set removes the glow and shows the solid final leaderboard. Revert the seed after.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/components/MatchDetail.tsx
git commit -m "feat(picks): not-finalized halo — steady glow + pulse on projection change"
```

---

## Self-Review Notes

- **Spec coverage:** live projection (T1), sort + dense rank (T2), live detection + provisional badge + header label + id re-key (T3), animated re-sort (T4), halo glow + pulse-on-change + Full-Time settle (T5). `risky=false`, multiplier parity, no-backend-change, identity key all honored.
- **Settle on Full-Time:** no dedicated code — when `status` flips to `finished`, `live` becomes false and the existing finished render path takes over (halo class drops, solid badges return). Covered by T5 Step 6 manual check.
- **Type consistency:** `projectedPoints` / `rankLivePicks` signatures used identically across tasks; both finished and live `ranked` rows expose `{ id, name, flag_code, home_pred, away_pred, points, rank, tier }` so the shared render body type-checks.
