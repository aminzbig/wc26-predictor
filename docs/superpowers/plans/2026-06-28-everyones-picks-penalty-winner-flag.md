# Penalty-winner Flag in "Everyone's Picks" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the predicted advancer's team flag next to a level-scoreline knockout pick in the "Everyone's picks" board (e.g. `1–1 🇧🇷`).

**Architecture:** The data (`predictions.winner_side`) already exists in the DB. The only changes are in `src/components/MatchDetail.tsx`: select the column, thread it onto the `PeoplePick` row, and render a small `fi` flag after the predicted score in the board's three render states (scored / live / locked). `PicksBoard` and the `PeoplePick` type are exported so the rendering can be unit-tested directly.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react (jsdom), `flag-icons` (`fi fis fi-{code}`).

## Global Constraints

- Display format: predicted score + team flag, **no** "P" / "pens" text label.
- Flag is the rectangular `fi` flag icon (consistent with `WinnerPicker` / `AdvancerBadge`), **not** a Unicode emoji.
- The winning team's flag code comes from the match: `winner_side === 'home' ? match.home_code : match.away_code`.
- No DB, migration, scoring, or live-ranking changes.
- Flag shows only when `winner_side` is set (it is only ever set for level knockout scorelines).

---

### Task 1: Render the advancer flag on "Everyone's picks" rows

**Files:**
- Modify: `src/components/MatchDetail.tsx` (type at `:12`, query/select at `:39-41`, row mapping at `:44-48`, `PicksBoard` signature at `:80`, score render at `:142`, `:158`, `:164`; add `WinnerFlag` helper)
- Test: `src/components/MatchDetail.test.tsx` (add cases; file already exists)

**Interfaces:**
- Consumes: `Match` (`src/lib/types.ts`) — uses `home_code`, `away_code`, `status`, `kickoff_at`, `multiplier`, `live_*`, `home_score`, `away_score`. `Prediction.winner_side: 'home' | 'away' | null` already exists.
- Produces:
  - `export type PeoplePick = { id: string; name: string; flag_code: string | null; avatar_url: string | null; home_pred: number; away_pred: number; points: number | null; winner_side: 'home' | 'away' | null }`
  - `export function PicksBoard({ rows, match }: { rows: PeoplePick[]; match: Match }): JSX.Element`
  - `function WinnerFlag({ side, match, className }: { side?: 'home' | 'away' | null; match: Match; className?: string }): JSX.Element | null`

- [ ] **Step 1: Export `PicksBoard` and `PeoplePick`, add `winner_side` to the type**

In `src/components/MatchDetail.tsx`, change the type declaration at line 12 from:

```tsx
type PeoplePick = { id: string; name: string; flag_code: string | null; avatar_url: string | null; home_pred: number; away_pred: number; points: number | null }
```

to:

```tsx
export type PeoplePick = { id: string; name: string; flag_code: string | null; avatar_url: string | null; home_pred: number; away_pred: number; points: number | null; winner_side: 'home' | 'away' | null }
```

And change the `PicksBoard` declaration at line 80 from `function PicksBoard(` to `export function PicksBoard(`.

- [ ] **Step 2: Add the `WinnerFlag` helper**

In `src/components/MatchDetail.tsx`, immediately above `function PicksBoard` (line 80), add:

```tsx
// The team a player backed to advance on penalties for a level knockout scoreline.
// Renders nothing unless `side` is set (only level KO picks carry a winner_side).
function WinnerFlag({ side, match, className = '!w-[18px] !h-[12px]' }: { side?: 'home' | 'away' | null; match: Match; className?: string }) {
  if (!side) return null
  const code = side === 'home' ? match.home_code : match.away_code
  if (!code) return null
  return <span className={`fi fis fi-${code} ${className} bg-cover border border-ink/20 inline-block align-middle ml-1`} aria-label="advances on penalties" />
}
```

- [ ] **Step 3: Fetch and map `winner_side`**

In `PeoplePredictions`, change the select at line 40 from:

```tsx
      .select('id,home_pred,away_pred,points_awarded, players(name,flag_code,avatar_url)')
```

to:

```tsx
      .select('id,home_pred,away_pred,points_awarded,winner_side, players(name,flag_code,avatar_url)')
```

And in the row mapping (lines 44-48), add `winner_side` to the produced object:

```tsx
        const list: PeoplePick[] = (data ?? []).map((r: any) => ({
          id: r.id, name: r.players?.name ?? '?', flag_code: r.players?.flag_code ?? null,
          avatar_url: r.players?.avatar_url ?? null,
          home_pred: r.home_pred, away_pred: r.away_pred, points: r.points_awarded,
          winner_side: r.winner_side ?? null,
        }))
```

- [ ] **Step 4: Render the flag in all three board states**

In `PicksBoard`, scored tier text (line 142), change:

```tsx
                    {scored && <span className="opacity-60">{r.home_pred}–{r.away_pred}</span>}
```

to:

```tsx
                    {scored && <span className="opacity-60">{r.home_pred}–{r.away_pred}<WinnerFlag side={r.winner_side} match={match} className="!w-[13px] !h-[9px]" /></span>}
```

Live score (line 158), change:

```tsx
                    <div className="font-display text-[18px] leading-none text-ink">{r.home_pred}–{r.away_pred}</div>
```

to:

```tsx
                    <div className="font-display text-[18px] leading-none text-ink">{r.home_pred}–{r.away_pred}<WinnerFlag side={r.winner_side} match={match} /></div>
```

Locked score (line 164), change:

```tsx
                <div className="font-display text-[16px] leading-none">{r.home_pred}–{r.away_pred}</div>
```

to:

```tsx
                <div className="font-display text-[16px] leading-none">{r.home_pred}–{r.away_pred}<WinnerFlag side={r.winner_side} match={match} /></div>
```

- [ ] **Step 5: Write the failing tests**

Append to `src/components/MatchDetail.test.tsx`:

```tsx
import { PicksBoard } from './MatchDetail'
import type { PeoplePick } from './MatchDetail'

// A locked knockout match (past kickoff, not finished, no live data) → PicksBoard
// renders its "locked" branch, which shows each predicted score.
const lockedKo: Match = {
  id: '1', match_no: 73, stage: 'r16', group_label: null,
  home_code: 'br', away_code: 'hr', home_label: 'Brazil', away_label: 'Croatia',
  kickoff_at: new Date(Date.now() - 3.6e6).toISOString(),
  home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
  prob_home: null, prob_draw: null, prob_away: null,
}

// flag_code is null so the only `fi-*` class on the row is the advancer flag.
function pick(p: Partial<PeoplePick>): PeoplePick {
  return { id: 'p1', name: 'Amir', flag_code: null, avatar_url: null, home_pred: 1, away_pred: 1, points: null, winner_side: null, ...p }
}

test("picks board shows the backed home team's flag for a tie pick", () => {
  const { container } = render(<PicksBoard rows={[pick({ winner_side: 'home' })]} match={lockedKo} />)
  expect(container.querySelector('.fi-br')).not.toBeNull()
})

test("picks board shows the away team's flag, not the home team's, when away is backed", () => {
  const { container } = render(<PicksBoard rows={[pick({ winner_side: 'away' })]} match={lockedKo} />)
  expect(container.querySelector('.fi-hr')).not.toBeNull()
  expect(container.querySelector('.fi-br')).toBeNull()
})

test('picks board shows no advancer flag for a decisive pick', () => {
  const { container } = render(<PicksBoard rows={[pick({ home_pred: 2, away_pred: 1, winner_side: null })]} match={lockedKo} />)
  expect(container.querySelector('.fi-br')).toBeNull()
  expect(container.querySelector('.fi-hr')).toBeNull()
})
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/components/MatchDetail.test.tsx`
Expected: PASS — all three new tests pass alongside the existing ones. (If you wrote Step 5 before Steps 1-4, run first and confirm the new tests FAIL on a missing `PicksBoard` export, then implement and re-run to green.)

- [ ] **Step 7: Typecheck, lint, and build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no errors (confirms the `PicksBoard` / `PeoplePick` exports and JSX changes typecheck).

Run: `npm run lint`
Expected: no new lint errors in `MatchDetail.tsx` or `MatchDetail.test.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/components/MatchDetail.tsx src/components/MatchDetail.test.tsx
git commit -m "feat(picks): show backed advancer flag on tie predictions in Everyone's picks"
```

---

## Manual Verification

On a finished or locked knockout match where at least one player predicted a level
scoreline (e.g. the Canada vs South Africa card mentioned in the request), open the
match detail and confirm:

- The tie pick shows the backed team's flag next to the score (e.g. `1–1 🇨🇦`).
- The flag matches the side the player chose (home vs away).
- Decisive picks and group-stage picks show no flag.
