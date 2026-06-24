# Knockout bracket on the Standings page

**Date:** 2026-06-24
**Status:** Approved — ready for implementation plan

## Problem

The Standings page only shows the group-stage tables. There is no way to see the
knockout bracket, and no way to watch it take shape as group games finish. The user
wants a top toggle on the Standings page — **Group Stage / Knockout** — mirroring the
deck/grid toggle on the Matches page. The Knockout view should live-update from match
results: as groups finalize and knockout games are played, the bracket slots fill in
with real teams. Once the group stage is complete, opening Standings should default to
the Knockout tab.

## Key finding: the bracket is already in our data

Every knockout fixture is seeded with **label slots** instead of team codes
(`home_code` / `away_code` are `null` for knockout rows). The labels fully encode the
bracket:

- Group placements: `1E` (winner of Group E), `2A` (runner-up of Group A)
- Third-place slots: `3A/B/C/D/F` (one of the qualifying third-placed teams from the
  listed groups)
- Progression: `W74` (winner of match 74), `L101` (loser of match 101)

So the bracket is a **pure function of our own standings + our own match results**. The
football API cannot supply it: the app runs on its own seeded/simulated scores, so the
bracket must reflect the app's results, not real-world FIFA outcomes. The live-score
`tick` function already flows scores into `matches`; the bracket just derives from them
and rides the existing realtime subscription for free.

## Approach

Display-only client-side resolution. We do **not** mutate `matches` rows — the label
slots stay as-is in the DB; we overlay resolved teams in the UI. No write path, no risk
to scoring, instant live updates.

### 1. Top-level toggle (Standings screen)

A segmented control at the top of `src/screens/Standings.tsx` — **Group Stage ·
Knockout** — built with the same pattern as the Matches deck/grid toggle
(`border-[3px] border-ink`, `font-display`, ink/paper inversion on the active tab).
State is local `useState`.

**Auto-default:** on mount, if every group-stage match is `finished`, open on
**Knockout**; otherwise **Group Stage**. The user can switch back manually.

```
groupStageComplete = matches.filter(m => m.stage === 'group').every(m => m.status === 'finished')
```

The existing group tables + Advance/Wildcard legend move under the **Group Stage** tab
unchanged.

### 2. Bracket resolution — `src/lib/bracket.ts` (new, pure)

A single pure function:

```ts
resolveBracket(matches: Match[]): BracketMatch[]
```

- `BracketMatch` carries: `match_no`, `stage`, `kickoff_at`, `multiplier`,
  `status`, regular + live + penalty scores, a resolved `home`/`away` slot, and the
  derived `winnerCode` (or `null` when undecided).
- Each slot is `{ code, name } | null` plus its raw `label` (e.g. `2A`,
  `3A/B/C/D/F`) for the TBD display.

Resolution rules, applied in `match_no` order so earlier rounds feed later ones:

- **`1X` / `2X`** → reuse `computeStandings()`; `1X` = group X `rows[0]`, `2X` =
  `rows[1]`. Resolves once that group's matches are all played.
- **`W{n}` / `L{n}`** → winner / loser of match `n` once it is decided.
- **`3...` third-place slots** → resolve only after the whole group stage is complete
  (need all 12 thirds to pick the best 8). Assign the 8 qualifying thirds (already
  flagged `qualification: 'wildcard'` by `computeStandings`) to their slots via a
  **deterministic constrained match**: each slot lists allowed groups; match qualifying
  thirds into slots honoring those constraints, processing slots in `match_no` order
  with a fixed tiebreak so output is stable and reproducible.
  - *Note for future:* the official FIFA 495-row third-place allocation table is the
    only bit-for-bit-official mapping. A valid constrained assignment is correct and
    consistent for a simulation; leave a code comment marking where the official table
    could be swapped in.

Any slot whose source is not yet decided stays **TBD**, rendered as its raw label.

**Winner derivation:** regular score first (`home_score` vs `away_score`); if level,
use the penalty score (`home_pens` vs `away_pens`); if still level or pens absent →
`null` (TBD downstream).

### 3. Penalties (Google-style)

Knockout games can finish level and go to penalties. We store the penalty score so we
can show it the way Google does.

- **Schema (`0024_penalties.sql`):** add `home_pens int null`, `away_pens int null` to
  `matches`.
- **Capture:** `tick/index.ts` reads `score.penalty.home/away` from the API-Football
  fixture and writes `home_pens`/`away_pens` when the status is `PEN` at full-time.
  Admin can also set them manually. No new API call — same response we already fetch.
- **Display:** the regular score stays (e.g. **1–1**); a smaller line beneath reads
  **"Penalties 4–1"**. Shown on **both** the main poster `MatchCard` and the new
  knockout bracket cards via the same treatment.
- **Types:** add `home_pens?`, `away_pens?` to `Match` in `src/lib/types.ts`.

### 4. Knockout UI — `src/components/KnockoutBracket.tsx` + `KnockoutCard.tsx` (new)

- A lighter second row of sub-tabs: **R32 · R16 · QF · SF · Final** (the `third`-place
  game folds in next to the Final).
- Default sub-tab = the earliest round that still has an undecided match, so Knockout
  opens on "what's live / next."
- Each round renders a vertical stack of **mini poster cards** reusing the existing
  flag + score + LIVE-banner styling. A card shows both teams (or their TBD labels),
  live/final score, the penalty line when present, and a small **feeder tag**
  (`W73 vs W75`, or once known "Winner of Korea–Ghana") to preserve the sense of
  who-feeds-whom without a cramped tree.

## Scope boundaries (YAGNI)

- Team resolution is **display-only on the Standings page**. This change does not wire
  resolved teams into the Matches deck/grid or scoring. Because `resolveBracket` is a
  shared lib function, that is a clean follow-up.
- No new API integration, no new edge function. Only `tick` gains penalty capture.

## Files touched

| File | Change |
| --- | --- |
| `supabase/migrations/0024_penalties.sql` | new — `home_pens` / `away_pens` columns |
| `src/lib/types.ts` | add `home_pens?` / `away_pens?` to `Match` |
| `src/lib/bracket.ts` | new — `resolveBracket()` + types |
| `src/components/KnockoutBracket.tsx` | new — round sub-tabs + card stack |
| `src/components/KnockoutCard.tsx` | new — mini poster card + penalty line + feeder tag |
| `src/screens/Standings.tsx` | top toggle, auto-default, Group/Knockout split |
| `src/components/MatchCard.tsx` | penalty line under the score |
| `supabase/functions/tick/index.ts` | capture `score.penalty` on `PEN` full-time |

## Edge cases

- **Level knockout with no pens entered** → winner `null`, downstream slot stays TBD.
- **Third-place slots before group stage completes** → all third slots TBD until the
  last group game finishes.
- **List shrink / realtime reloads** → resolution is recomputed from the fresh
  `matches` array each render (memoized), same pattern as `computeStandings`.

## Testing

- Unit-test `resolveBracket` against the seed: partial group completion (some `1X`/`2X`
  resolved, thirds still TBD), full group completion (third-place assignment valid and
  stable), and progression (`W{n}` / `L{n}` resolving from finished knockout games,
  including a penalty-decided game).
- Verify the constrained third-place assignment produces a complete, conflict-free
  mapping for a representative set of qualifying-third combinations.
