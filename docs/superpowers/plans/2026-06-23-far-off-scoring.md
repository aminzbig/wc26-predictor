# "Way-off" Zero-Out Scoring Rule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zero out a prediction's match points when its scoreline is wildly off (total goal error ≥ 5), for matches kicking off on/after a cutoff timestamp.

**Architecture:** The rule is a guard applied at the very top of scoring. The PostgreSQL `recompute_match()` function is the source of truth; `src/lib/scoring.ts` mirrors it for live projection and display. Both gain the same guard, keyed off a shared cutoff timestamp compared to the match's `kickoff_at`. Past matches (kickoff before the cutoff) are untouched.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Supabase (PostgreSQL plpgsql), Tailwind.

## Global Constraints

- **Distance metric (verbatim from spec):** `dist = |predHome − actHome| + |predAway − actAway|`.
- **Threshold:** zero the entire prediction when `dist >= 5`.
- **Zero means zero:** outcome, home goals, away goals, goal difference, exact bonus, risky bonus, the per-match `multiplier`, and the booster factor are ALL wiped (the guard returns `0` before any of them are summed/multiplied).
- **Rollout — going-forward only:** the rule applies only to matches whose `kickoff_at >= FAR_OFF_RULE_FROM`. No retroactive re-scoring of already-played matches.
- **Cutoff constant value:** `2026-06-24T00:00:00Z` (UTC). This is the deploy cutoff; matches kicking off at/after it use the rule. The SQL literal and the TS constant MUST be the identical timestamp. If deploying later, bump both to a time that is not in the middle of any live match.
- **Two implementations must stay in sync:** the SQL `recompute_match()` (truth) and `src/lib/scoring.ts` (mirror). Never change one without the other.
- Run `npm test`, `npm run build`, and `npm run lint` clean before completing any code task.

---

### Task 1: Far-off rule in the scoring library (`src/lib/scoring.ts`)

Add the shared constants and the guard, wired into `basePoints` and `projectedPoints`. This is the testable core; every other task depends on these exports.

**Files:**
- Modify: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

**Interfaces:**
- Consumes: existing `basePoints(p, r, pts?, risky?)`, `projectedPoints(p, r, multiplier?, boost?)`.
- Produces (later tasks rely on these exact names/signatures):
  - `export const FAR_OFF_THRESHOLD = 5`
  - `export const FAR_OFF_RULE_FROM = '2026-06-24T00:00:00Z'`
  - `export function isFarOff(p: { hp: number; ap: number }, r: { hs: number; as: number }): boolean` — `true` when `|hp-hs| + |ap-as| >= FAR_OFF_THRESHOLD`.
  - `export function farOffApplies(kickoffAtISO: string): boolean` — `true` when `kickoffAtISO >= FAR_OFF_RULE_FROM` (lexical ISO-8601 UTC comparison; both are `Z` timestamps).
  - `basePoints(p, r, pts?, risky?, applyFarOff?: boolean)` — new optional 5th param, default `false`. When `true` and `isFarOff(p, r)`, returns `0` before summing.
  - `projectedPoints(p, r, multiplier?, boost?, applyFarOff?: boolean)` — new optional 5th param, default `false`, passed through to `basePoints`.

- [ ] **Step 1: Write failing tests** — append to `src/lib/scoring.test.ts`:

```typescript
import {
  basePoints,
  projectedPoints,
  isFarOff,
  farOffApplies,
  FAR_OFF_RULE_FROM,
} from './scoring'

describe('far-off rule', () => {
  test('isFarOff: total goal error >= 5 is far off', () => {
    expect(isFarOff({ hp: 5, ap: 1 }, { hs: 1, as: 0 })).toBe(true)   // dist 5
    expect(isFarOff({ hp: 3, ap: 3 }, { hs: 0, as: 0 })).toBe(true)   // dist 6
  })
  test('isFarOff: dist 4 is NOT far off (1-0 vs 5-0 keeps points)', () => {
    expect(isFarOff({ hp: 1, ap: 0 }, { hs: 5, as: 0 })).toBe(false)  // dist 4
  })
  test('farOffApplies: kickoff on/after cutoff applies, before does not', () => {
    expect(farOffApplies('2026-06-25T18:00:00Z')).toBe(true)
    expect(farOffApplies(FAR_OFF_RULE_FROM)).toBe(true)               // boundary inclusive
    expect(farOffApplies('2026-06-15T18:00:00Z')).toBe(false)
  })
  test('basePoints zeroes a far-off prediction when the rule is active', () => {
    // 5-1 vs 1-0: correct home-win outcome (+10) normally, dist 5 -> 0
    expect(basePoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 })).toBe(10)            // rule off
    expect(basePoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 }, undefined, false, true)).toBe(0)
  })
  test('basePoints zeroes a far-off correct draw (3-3 vs 0-0) when active', () => {
    expect(basePoints({ hp: 3, ap: 3 }, { hs: 0, as: 0 })).toBe(15)            // rule off
    expect(basePoints({ hp: 3, ap: 3 }, { hs: 0, as: 0 }, undefined, false, true)).toBe(0)
  })
  test('basePoints leaves dist-4 prediction untouched even when active', () => {
    expect(basePoints({ hp: 1, ap: 0 }, { hs: 5, as: 0 }, undefined, false, true)).toBe(10)
  })
  test('basePoints leaves an exact score untouched when active (dist 0)', () => {
    expect(basePoints({ hp: 4, ap: 3 }, { hs: 4, as: 3 }, undefined, false, true)).toBe(30)
  })
  test('projectedPoints zeroes a far-off pick when the rule is active', () => {
    // 5-1 vs live 1-0, multiplier 2, boost 2 -> normally 10*2*2=40, far-off -> 0
    expect(projectedPoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 }, 2, 2)).toBe(40)        // rule off
    expect(projectedPoints({ hp: 5, ap: 1 }, { hs: 1, as: 0 }, 2, 2, true)).toBe(0)   // rule on
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test -- scoring`
Expected: FAIL — `isFarOff`/`farOffApplies` not exported; `applyFarOff`-active cases return old values.

- [ ] **Step 3: Implement** — edit `src/lib/scoring.ts` to its full new contents:

```typescript
// FIFA World Cup 2026 Match Predictor scoring — ADDITIVE (sum every component
// that applies). Mirrors recompute_match() in migration 0023 (the source of truth).
// `risky` depends on the whole field's prediction distribution, so it's computed
// server-side and passed in (default false for a standalone preview).
export type FifaPoints = {
  outcome: number; goalsHome: number; goalsAway: number; goalDiff: number; scoreBonus: number; risky: number
}
type Pred = { hp: number; ap: number }
type Result = { hs: number; as: number }

export const FIFA_POINTS: FifaPoints = { outcome: 10, goalsHome: 5, goalsAway: 5, goalDiff: 5, scoreBonus: 5, risky: 10 }

// "Way-off" rule: a prediction whose total goal error is >= FAR_OFF_THRESHOLD scores
// 0 for the whole match. Applies only to matches kicking off on/after FAR_OFF_RULE_FROM
// (going-forward only; earlier matches keep their original scores). The SQL guard in
// migration 0023 uses the identical threshold and timestamp — keep them in sync.
export const FAR_OFF_THRESHOLD = 5
export const FAR_OFF_RULE_FROM = '2026-06-24T00:00:00Z'

export function isFarOff(p: Pred, r: Result): boolean {
  return Math.abs(p.hp - r.hs) + Math.abs(p.ap - r.as) >= FAR_OFF_THRESHOLD
}

// ISO-8601 UTC ('...Z') timestamps compare correctly as strings.
export function farOffApplies(kickoffAtISO: string): boolean {
  return kickoffAtISO >= FAR_OFF_RULE_FROM
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

export function basePoints(
  p: Pred,
  r: Result,
  pts: FifaPoints = FIFA_POINTS,
  risky = false,
  applyFarOff = false,
): number {
  if (applyFarOff && isFarOff(p, r)) return 0
  const outcomeHit = sign(p.hp - p.ap) === sign(r.hs - r.as)
  return (outcomeHit ? pts.outcome : 0)
    + (p.hp === r.hs ? pts.goalsHome : 0)
    + (p.ap === r.as ? pts.goalsAway : 0)
    + (p.hp - p.ap === r.hs - r.as ? pts.goalDiff : 0)
    + (p.hp === r.hs && p.ap === r.as ? pts.scoreBonus : 0)
    + (risky && outcomeHit && sign(r.hs - r.as) !== 0 ? pts.risky : 0)
}

// Live projection: what a pick would score if the match ended at result `r` right now.
// risky is intentionally omitted — it depends on the whole field's prediction distribution, so it's computed
// server-side at Full-Time. Multiplied and rounded to match the final figure.
export function projectedPoints(
  p: { hp: number; ap: number },
  r: { hs: number; as: number },
  multiplier = 1,
  boost = 1,
  applyFarOff = false,
): number {
  return Math.round(basePoints(p, r, FIFA_POINTS, false, applyFarOff) * multiplier * boost)
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- scoring`
Expected: PASS — all existing tests plus the new `far-off rule` block.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat(scoring): zero out way-off predictions (total goal error >= 5)"
```

---

### Task 2: Live projection honors the rule (`src/lib/livePicks.ts`)

Thread `applyFarOff` through `rankLivePicks` so the live leaderboard projects 0 for a far-off pick the moment the live score makes it far off.

**Files:**
- Modify: `src/lib/livePicks.ts`
- Test: `src/lib/livePicks.test.ts` (create)

**Interfaces:**
- Consumes: `projectedPoints(p, r, multiplier?, boost?, applyFarOff?)` from Task 1.
- Produces: `rankLivePicks(rows, live, multiplier?, applyFarOff?: boolean)` — new optional 4th param, default `false`, passed to `projectedPoints`.

- [ ] **Step 1: Write failing test** — create `src/lib/livePicks.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { rankLivePicks } from './livePicks'

const rows = [
  { home_pred: 5, away_pred: 1, name: 'Bold' },   // vs live 1-0: dist 5 -> far off
  { home_pred: 2, away_pred: 1, name: 'Safe' },   // vs live 1-0: dist 1 -> outcome +10
]

describe('rankLivePicks far-off', () => {
  test('rule off: far-off bold pick still scores its outcome points', () => {
    const out = rankLivePicks(rows, { home: 1, away: 0 }, 1, false)
    expect(out.find(r => r.name === 'Bold')!.proj).toBe(10)
  })
  test('rule on: far-off bold pick projects 0 and ranks below the safe pick', () => {
    const out = rankLivePicks(rows, { home: 1, away: 0 }, 1, true)
    const bold = out.find(r => r.name === 'Bold')!
    const safe = out.find(r => r.name === 'Safe')!
    expect(bold.proj).toBe(0)
    expect(safe.proj).toBe(10)
    expect(safe.rank).toBe(1)
    expect(bold.rank).toBe(2)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- livePicks`
Expected: FAIL — `rankLivePicks` ignores the 4th arg, Bold projects 10 in both cases.

- [ ] **Step 3: Implement** — edit `src/lib/livePicks.ts`:

Change the signature and the `projectedPoints` call:

```typescript
export function rankLivePicks<T extends { home_pred: number; away_pred: number; name: string }>(
  rows: T[],
  live: { home: number; away: number },
  multiplier = 1,
  applyFarOff = false,
): Array<T & { proj: number; rank: number }> {
  const withProj = rows.map(r => ({
    ...r,
    proj: projectedPoints({ hp: r.home_pred, ap: r.away_pred }, { hs: live.home, as: live.away }, multiplier, 1, applyFarOff),
  }))
  const sorted = [...withProj].sort((a, b) => b.proj - a.proj || a.name.localeCompare(b.name))
  return sorted.map(r => ({ ...r, rank: withProj.filter(x => x.proj > r.proj).length + 1 }))
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- livePicks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/livePicks.ts src/lib/livePicks.test.ts
git commit -m "feat(scoring): live projection honors the way-off zero rule"
```

---

### Task 3: SQL `recompute_match()` guard (source of truth)

Redefine `recompute_match()` (current version lives in `0022_boosters.sql`) so the points expression is wrapped in the far-off guard. Going-forward only: do NOT re-score past matches.

**Files:**
- Create: `supabase/migrations/0023_far_off_zero.sql`

**Interfaces:**
- Consumes: existing `matches` (has `kickoff_at timestamptz`, `home_score`, `away_score`, `multiplier`), `predictions` (`home_pred`, `away_pred`, `points_awarded`, `player_id`, `match_id`), `boosters`.
- Produces: redefined `recompute_match(p_match uuid)` with identical behavior EXCEPT a far-off prediction on a post-cutoff match is set to `points_awarded = 0`.

- [ ] **Step 1: Write the migration** — create `supabase/migrations/0023_far_off_zero.sql`:

```sql
-- "Way-off" rule: a prediction whose total goal error (|home_pred - home_score|
-- + |away_pred - away_score|) is >= 5 scores 0 for the whole match. Applies ONLY
-- to matches kicking off on/after the cutoff below (going-forward only); earlier
-- matches keep their original scores, so this migration deliberately does NOT
-- re-score already-finished matches. Threshold (5) and cutoff timestamp are
-- mirrored in src/lib/scoring.ts (FAR_OFF_THRESHOLD / FAR_OFF_RULE_FROM) — keep
-- the two in sync. Otherwise identical to 0022_boosters.sql.
create or replace function recompute_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  mult numeric;
  actual_out int;
  total int;
  same_out int;
  risky boolean := false;
  far_off boolean;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;
  mult := coalesce(m.multiplier, 1);
  actual_out := sign(m.home_score - m.away_score);
  far_off := m.kickoff_at >= '2026-06-24T00:00:00Z'::timestamptz;

  if actual_out <> 0 then
    select count(*), count(*) filter (where sign(home_pred - away_pred) = actual_out)
      into total, same_out
      from predictions where match_id = p_match;
    if total > 0 and same_out::numeric / total < 0.20 then
      risky := true;
    end if;
  end if;

  update predictions p set
    points_awarded = case
      when far_off
           and abs(p.home_pred - m.home_score) + abs(p.away_pred - m.away_score) >= 5
        then 0                                                                       -- Way-off: 0 for the whole match
      else mult
        * (case when exists (select 1 from boosters b
                             where b.player_id = p.player_id and b.match_id = p_match)
                then 2 else 1 end)                                                   -- Booster: double
        * (
            (case when sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)  -- Correct Outcome
          + (case when p.home_pred = m.home_score then 5 else 0 end)                     -- Correct Goals (Home)
          + (case when p.away_pred = m.away_score then 5 else 0 end)                     -- Correct Goals (Away)
          + (case when p.home_pred - p.away_pred = m.home_score - m.away_score then 5 else 0 end) -- Goal Difference
          + (case when p.home_pred = m.home_score and p.away_pred = m.away_score then 5 else 0 end) -- Score Bonus
          + (case when risky and sign(p.home_pred - p.away_pred) = actual_out then 10 else 0 end)   -- Risky Bonus
        )
      end,
    updated_at = now()
  where p.match_id = p_match;

  update matches set status = 'finished' where id = p_match;
end; $$;
```

- [ ] **Step 2: Verify the guard expression with literal cases** — run this SELECT in the Supabase SQL editor (or psql against the linked project). It exercises the exact guard against sample tuples without touching real rows:

```sql
select ph, pa, hs, asc_, ko::date as kickoff,
       (ko >= '2026-06-24T00:00:00Z'::timestamptz
        and abs(ph - hs) + abs(pa - asc_) >= 5) as zeroed
from (values
  (1,0,5,0,'2026-06-25'::timestamptz),  -- dist 4, post-cutoff  -> expect false (keeps)
  (5,1,1,0,'2026-06-25'::timestamptz),  -- dist 5, post-cutoff  -> expect true  (zeroed)
  (3,3,0,0,'2026-06-25'::timestamptz),  -- dist 6, post-cutoff  -> expect true  (zeroed)
  (5,1,1,0,'2026-06-15'::timestamptz)   -- dist 5, PRE-cutoff   -> expect false (keeps, going-forward only)
) as t(ph,pa,hs,asc_,ko);
```

Expected output (`zeroed` column): `false, true, true, false`.

- [ ] **Step 3: Deploy the migration**

Run (from memory `supabase-fifa26-deploy-token`, project ref `ekgaegdtozqeziyycoul`):

```bash
SUPABASE_ACCESS_TOKEN=<owner-PAT-from-memory> npx supabase db push --project-ref ekgaegdtozqeziyycoul
```

Expected: migration `0023_far_off_zero` applied; no error. (Confirm the function exists: the next match scored after cutoff applies the rule.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0023_far_off_zero.sql
git commit -m "feat(scoring): SQL recompute_match zeroes way-off predictions post-cutoff"
```

---

### Task 4: "Too far off" UI in `MatchDetail.tsx`

Surface the zero with a reason instead of a bare `0`, in the leaderboard rows and the player's own points display. Wire the live leaderboard to pass `applyFarOff`.

**Files:**
- Modify: `src/components/MatchDetail.tsx`

**Interfaces:**
- Consumes: `farOffApplies`, `isFarOff` from Task 1; `rankLivePicks(..., applyFarOff)` from Task 2.
- Produces: a `'faroff'` tier rendered as **"Too far off"**; the player's own points block shows **"Too far off — 0 pts"** when the rule zeroed their pick.

- [ ] **Step 1: Add the `faroff` tier** — in `src/components/MatchDetail.tsx`, update the imports, the `Tier` type, the `TIER` map, and `resultTier`:

```tsx
// add to the existing import from ../lib/livePicks line:
import { rankLivePicks } from '../lib/livePicks'
import { farOffApplies, isFarOff } from '../lib/scoring'
```

```tsx
type Tier = 'exact' | 'diff' | 'outcome' | 'miss' | 'faroff'
const sgn = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)
function resultTier(hp: number, ap: number, hs: number, as: number, applyFarOff = false): Tier {
  if (applyFarOff && isFarOff({ hp, ap }, { hs, as })) return 'faroff'
  if (hp === hs && ap === as) return 'exact'
  if (hp - ap === hs - as) return 'diff'
  if (sgn(hp - ap) === sgn(hs - as)) return 'outcome'
  return 'miss'
}
const TIER: Record<Tier, { label: string; cls: string }> = {
  exact:   { label: 'Exact score', cls: 'text-green' },
  diff:    { label: 'Goal diff',   cls: 'text-blue' },
  outcome: { label: 'Outcome',     cls: 'text-orange' },
  miss:    { label: 'Missed',      cls: 'text-ink/40' },
  faroff:  { label: 'Too far off', cls: 'text-red' },
}
```

- [ ] **Step 2: Pass `applyFarOff` into the leaderboard rows** — in `PicksBoard`, compute the flag once and thread it into both the live and scored tier calls:

```tsx
  const applyFarOff = farOffApplies(match.kickoff_at)
  // LIVE: rank by projected points from the current live score.
  // FINISHED / pre-kickoff: existing behavior (rank by awarded points, or none).
  const ranked = live
    ? rankLivePicks(rows, { home: lh, away: la }, match.multiplier ?? 1, applyFarOff).map(r => ({
        ...r, points: r.proj, tier: resultTier(r.home_pred, r.away_pred, lh, la, applyFarOff),
      }))
    : rows.map((r) => {
        const pts = r.points ?? 0
        const rank = rows.filter(x => (x.points ?? 0) > pts).length + 1
        return { ...r, rank, tier: scored ? resultTier(r.home_pred, r.away_pred, hs, as, applyFarOff) : null }
      })
```

(The existing tier-label JSX at the row level already renders `TIER[r.tier].label`, so the "Too far off" text and red class flow through automatically.)

- [ ] **Step 3: Surface it in the player's own points block** — replace the existing "Points earned" block (the `state === 'finished' && prediction?.points_awarded != null` block) so a far-off zero reads as a reason rather than "+0 points":

```tsx
            {/* Points earned */}
            {state === 'finished' && prediction?.points_awarded != null && (
              farOffApplies(match.kickoff_at)
                && isFarOff(
                  { hp: prediction.home_pred, ap: prediction.away_pred },
                  { hs: match.home_score ?? 0, as: match.away_score ?? 0 },
                ) ? (
                <div className="mt-2 inline-block bg-ink text-red font-display text-[16px] uppercase tracking-wide px-3 py-1.5">
                  Too far off — 0 pts
                </div>
              ) : (
                <div className="mt-2 inline-block bg-ink text-yellow font-display text-[16px] uppercase tracking-wide px-3 py-1.5">
                  +{prediction.points_awarded} points
                </div>
              )
            )}
```

- [ ] **Step 4: Type-check, lint, and build**

Run: `npm run build && npm run lint`
Expected: PASS — no TS errors (note the new `'faroff'` key makes `TIER` exhaustive for the widened `Tier` union), no lint errors.

- [ ] **Step 5: Manual visual verification**

Run: `npm run dev` (Vite on :5175; requires `.env.local` cloud Supabase creds — see memory `local-dev-env-setup`).
Open a finished, post-cutoff match where a player predicted a far-off score (total goal error ≥ 5), e.g. predicted 5–1 on a 1–0 result. Confirm:
- Their leaderboard row shows the red **"Too far off"** tag and a **0** in the points block.
- If it's your own prediction, the points block reads **"Too far off — 0 pts"**.
- A dist-4 pick (e.g. 1–0 on 5–0) still shows its normal tag and points.

- [ ] **Step 6: Commit**

```bash
git add src/components/MatchDetail.tsx
git commit -m "feat(scoring): show 'Too far off' on zeroed predictions"
```

---

## Self-Review

**Spec coverage:**
- Rule (`dist >= 5` → 0): Task 1 (`isFarOff`, `basePoints` guard), Task 3 (SQL guard). ✓
- Zero wipes everything incl. multiplier/booster/risky: Task 3 guard returns `0` before the `mult * booster * (...)` product; Task 1 returns `0` before summing. ✓
- Going-forward only via `kickoff_at >= cutoff`: Task 1 `farOffApplies`, Task 3 `far_off` flag, no mass re-score block. ✓
- Sync between SQL and TS: identical threshold `5` and timestamp `2026-06-24T00:00:00Z`, cross-referenced in both files' comments. ✓
- Live projection agrees: Task 2. ✓
- UI "Too far off — 0 pts": Task 4 (leaderboard tier + own-points block). ✓
- Tests for the listed cases (dist 4 keeps, dist 5 zeroes, far-off draw, blowout-vs-tight, exact unaffected, rule-inactive): Task 1 + Task 2. ✓

**Placeholder scan:** No TBD/TODO; the cutoff is a concrete value with explicit deploy instructions; every code step shows full code. ✓

**Type consistency:** `isFarOff`/`farOffApplies` signatures, the `applyFarOff` 5th/4th params, and the `'faroff'` tier key are used identically across Tasks 1–4. `basePoints` 5-arg order `(p, r, pts, risky, applyFarOff)` matches every call site (`projectedPoints` passes `FIFA_POINTS, false, applyFarOff`). ✓
