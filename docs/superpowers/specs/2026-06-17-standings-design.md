# Standings page — design

**Date:** 2026-06-17
**Status:** approved (pending spec review)

## Goal

Add a **Standings** tab showing all 12 WC26 group tables (A–L), styled like the
rest of the app's poster UI. Each table lists the four teams ranked with
MP / W / D / L / GD / Pts, like a standard football standings widget. Top-2 and
provisional third-place wildcard positions are highlighted live.

## Tournament format (WC26)

- 48 teams, 12 groups of 4. **Top 2 of each group advance** (24 teams).
- The remaining 8 Round-of-32 slots go to the **8 best third-placed teams** of
  the 12 groups.
- **Within-group order:** Points → Goal Difference → Goals For → (head-to-head,
  fair-play, lots — not modelled).
- **Cross-group third-place order:** Points → GD → Goals For → (fair-play, lots —
  not modelled).
- Unmodelled final tiebreakers (fair-play points, drawing of lots) fall back to
  **alphabetical by team name** so ranking is always deterministic.

## Data — no backend changes

All derived client-side from the existing `useMatches()` hook (which already
subscribes to realtime, so live scores flow in automatically).

A match **counts as played** when:
- `status === 'finished'` → use `home_score` / `away_score`, **or**
- live in progress: `live_home != null && live_away != null && status !== 'finished'`
  → use `live_home` / `live_away`.

Otherwise the match is ignored (not yet played) but its two teams still appear in
the table with zeroed stats.

### `src/lib/standings.ts` (pure, unit-tested)

```ts
export interface TeamStanding {
  code: string; name: string
  mp: number; w: number; d: number; l: number
  gf: number; ga: number; gd: number; pts: number
  rank: number                         // 1-based within the group
  qualification: 'advance' | 'wildcard' | null
}
export interface GroupStanding { label: string; rows: TeamStanding[] }

export function computeStandings(matches: Match[], now?: Date): GroupStanding[]
```

Algorithm:
1. Filter to `stage === 'group'` matches that have both team codes.
2. Bucket by `group_label`. For each group, collect all four distinct teams
   (from every fixture's codes/labels) so unplayed teams still show.
3. Accumulate mp/w/d/l/gf/ga from played matches; compute gd, pts (3/1/0).
4. Sort each group by Pts → GD → GF → name; assign `rank`.
5. Mark `rank 1 & 2` → `qualification = 'advance'`.
6. Take each group's `rank 3` team, rank those 12 across groups by
   Pts → GD → GF → name; the top 8 → `qualification = 'wildcard'`.
7. Return groups sorted by `label` (A→L).

## UI

- `src/components/StandingsTable.tsx` — renders one `GroupStanding`:
  - Black `Group A` header bar (poster style), inside a `border-[3px] border-ink` card.
  - Dim uppercase column-label row: `MP W D L GD` + bold `Pts`.
  - One row per team: `#  flag  Team  …  MP W D L GD  Pts` (Pts in display font).
  - **advance** rows: solid yellow left bar (`border-l-[6px] border-yellow`), bold rank.
  - **wildcard** row: dashed yellow left bar (`border-l-[6px] border-dashed border-yellow`) — visually weaker, reads as provisional.
- `src/screens/Standings.tsx` — header note + small **legend**
  (`▌ Advance   ▏ Wildcard spot`) + the 12 `StandingsTable`s. Reuses `useMatches`.
- `src/App.tsx` — add `/standings` route inside `Protected`/`Shell`.
- `src/components/BottomNav.tsx` — new item **between Matches and Ranking**,
  `ListOrdered` icon, label "Standings". Verify the 5th/6th item doesn't wrap.

## Out of scope (YAGNI)

Knockout bracket, modelling fair-play/lots tiebreakers, clickable rows,
per-match drill-down.

## Testing

`src/lib/standings.test.ts` (vitest) covers: points/GD/GF math, within-group
ordering & tiebreaks, live-score inclusion, unplayed teams appear with zeros,
top-2 `advance` marking, and the cross-group best-8 `wildcard` selection.
