# Admin points v2 — sticker stack

**Date:** 2026-06-17
**Status:** Approved, implementing
**Supersedes the data model of:** `2026-06-17-admin-points-design.md` (v1 single-integer `admin_units`)

## Goal

Replace the single per-player admin-points number with a **list of individual ±10 reward stickers**, like a school sticker book: an admin gives a player bonus stickers (green, holographic) or penalty stickers (red), each worth +10 / −10 points. A player can hold both colors at once. On the ranking row the stickers render as a small **overlapping pile** that **fans out when tapped** to reveal each one's value. Net points still fold into the leaderboard total.

## Decisions (from brainstorming)

- **Mixed signs:** a player can hold bonus AND penalty stickers simultaneously → the model is a list of adjustments, not one signed integer.
- **Each sticker = ±10 points.** `delta` is exactly `+10` or `−10`.
- **Cap:** up to **10 bonus and 10 penalty** stickers per player (net range still −100…+100). The matching Add button disables at its cap rather than erroring.
- **Admin controls per player:** **＋ Add bonus** (insert +10), **− Add penalty** (insert −10), **Clear** (delete all of that player's stickers, both colors).
- **Ranking display:** overlapping pile (green = holographic shimmer, red = solid); tap to fan out into individual `★ +10` / `★ −10` stickers, tap again to collapse. Fan-out state is local per row.
- **Aesthetic:** "luckiest school sticker" — holographic stickers keep the animated rainbow + tilt + gloss from v1; `prefers-reduced-motion` respected.
- **v1 cleanup:** drop the `admin_units` column and revert its `players_update_self` RLS freeze (the column disappears).

## Backend

New migration `supabase/migrations/0019_admin_points_stickers.sql`:

- **New table `admin_points`:**
  - `id uuid primary key default gen_random_uuid()`
  - `player_id uuid not null references players(id) on delete cascade`
  - `delta smallint not null check (delta in (-10, 10))`
  - `created_at timestamptz not null default now()`
  - Index on `(player_id)`.
- **RLS:** read for all authenticated (`using (true)`); insert/delete for admins only (`is_admin()`), mirroring `matches_admin_write`. No self-write.
- **Realtime:** add `admin_points` to the `supabase_realtime` publication (idempotent block, like `0011`/`0014`).
- **Drop v1 column:** `alter table players drop column if exists admin_units;` and recreate `players_update_self` WITHOUT the `admin_units` clause (back to the v1-original `is_admin` + `legacy_points` freeze).
- **Leaderboard view** — use scalar subqueries (NOT a join) to avoid multiplying the predictions aggregation:
  - `total = pl.legacy_points + coalesce((select sum(delta) from admin_points ap where ap.player_id = pl.id), 0) + coalesce(sum(pr.points_awarded), 0)::int`
  - new column `admin_deltas`: `(select coalesce(array_agg(ap.delta order by ap.created_at, ap.id), '{}') from admin_points ap where ap.player_id = pl.id)` → e.g. `{10,10,-10}`.
  - Keep the existing `exact_hits` / `diff_hits` / `avatar_url` columns and the existing `group by` unchanged (subqueries don't affect grouping).

The `admin_points` realtime subscription replaces the v1 `players` subscription in `useLeaderboard` (the points now live on `admin_points`, not `players`).

## Frontend

### `src/lib/adminStickers.ts` (new, pure, replaces `adminBadge.ts`)
```ts
export type Sticker = { delta: 10 | -10; variant: 'holo' | 'bad' }
export function adminStickers(deltas: number[] | null | undefined): Sticker[]
```
Maps each delta to a sticker (`+10 → holo`, `−10 → bad`), preserving order. Empty/null → `[]`. `adminBadge.ts` and its test are deleted.

### `src/components/StickerStack.tsx` (new)
Renders the pile + fan-out for a ranking row.
- Props: `{ deltas: number[] | null }`.
- Collapsed: overlapping pile (negative margins) of up to a visual max (e.g. 6) stars; if more, a trailing `+N`. Renders nothing when empty.
- `onClick` toggles local `expanded` state (`useState`). Expanded: stickers laid out in a row, each showing its value (`+10` / `−10`).
- Each star is a `<span className="star-badge sticker sticker--{variant}">` reusing v1 CSS.
- Accessible: the pile is a `button` with `aria-expanded`; each sticker has a label like `+10 admin` / `-10 admin`.

### `src/components/LeaderRow.tsx`
Replace the single `adminBadge` span with `<StickerStack deltas={row.admin_deltas} />` in the same position (between the name block and the total score).

### `src/screens/admin/AdminPoints.tsx`
Rework the row from a stepper to three actions + a readout:
- Load each player's current deltas (count of +10 and −10). Query `admin_points` grouped by player, or read the `leaderboard` view's `admin_deltas`.
- Per row: avatar + name, a small readout (e.g. `★×2  ☆×1  ·  +10 pts`), then buttons **＋ bonus**, **− penalty**, **Clear**.
- **＋ bonus:** `insert into admin_points (player_id, delta) values (id, 10)` — disabled when that player already has 10 bonus.
- **− penalty:** insert `delta = -10` — disabled at 10 penalties.
- **Clear:** `delete from admin_points where player_id = id`.
- Optimistic local update, then the write; refetch on completion (mirrors `AdminPlayers` reload pattern). Writes via `supabase.from('admin_points')...`.

### Types / data
- `src/lib/types.ts`: `LeaderRow` — replace `admin_units: number` with `admin_deltas: number[] | null`. Remove `admin_units` from `Player` (column dropped).
- `src/hooks/useLeaderboard.ts`: swap the `players` realtime subscription for `admin_points`.

## Testing / verification

- `adminStickers`: empty/null → `[]`; `[10,10,-10]` → two holo + one bad in order; ignores nothing.
- `StickerStack`: renders N stars for N deltas; colors by sign; click toggles `aria-expanded` and reveals values; renders nothing for `[]`.
- `LeaderRow`: still renders name/score; shows a `StickerStack` when deltas present, none when empty.
- DB: view `total` includes `sum(delta)`; `admin_deltas` array ordered; `delta` check rejects values other than ±10; admin-only insert/delete enforced.
- Manual: add 2 bonus + 1 penalty in admin → ranking row shows a 3-sticker pile, total +10; tap to fan out and read `+10 +10 -10`; Clear empties it; reduced-motion disables shimmer.

## Out of scope

- Reasons / notes / which admin gave a sticker / timestamps shown in UI (created_at is stored only for ordering).
- Separate "clear bonuses" vs "clear penalties" (single Clear wipes both).
- Animations for the fan-out beyond a simple expand (no spring/physics required).
