# Admin points

**Date:** 2026-06-17
**Status:** Approved, implementing

## Goal

Let an admin award or deduct bonus points to any player from a new **Points** tab in the admin area. The admin uses a `−／＋` stepper per player; each step is worth **±10 points**. The total flows into the player's leaderboard score, and the ranking row shows the bonus as a **reward sticker**: a holographic/iridescent star for positive points, a solid red star for negative points (e.g. `★ +30 admin`, `★ -20 admin`). Setting the stepper back to `0` removes the bonus entirely and the sticker disappears.

## Decisions (from brainstorming)

- **Data model:** a single integer per player (`admin_units`), not an audit log. One source of truth, matches the stepper exactly. No history of who gave what / why (not needed).
- **Step value:** each unit = 10 points. Awarded/displayed points = `admin_units * 10`.
- **Range:** `admin_units` is clamped to **−10 … +10** (i.e. −100 … +100 points). Enforced both in the UI (stepper buttons disable at the bounds) and in the DB (`CHECK` constraint).
- **Zero clears it:** `admin_units = 0` contributes nothing to the total and renders no sticker. `0` *is* the cleared state — no separate "remove" action.
- **Badge text:** `+30 admin` / `-20 admin` — the multiplied point value plus the word "admin".
- **Sticker look:** reward-sticker style (slight tilt, gloss, drop-shadow). Positive = animated **holographic rainbow** (slow hue-rotate). Negative = solid **red**. Respects `prefers-reduced-motion` (static rainbow fallback).
- **Tab name:** "Points", added alongside Results / Fixtures / Players / Settings.

## Backend

New migration `supabase/migrations/0018_admin_points.sql`:

- **Column on `players`:**
  - `admin_units smallint not null default 0`
  - `CHECK (admin_units between -10 and 10)`
- **Update the `leaderboard` view** to:
  - Include admin points in the total:
    `pl.legacy_points + (pl.admin_units * 10) + coalesce(sum(pr.points_awarded), 0)::int as total`
  - Also select `pl.admin_units` so the ranking row can render the sticker.
  - Keep the existing `GROUP BY` correct (add `pl.admin_units`).

RLS: writing `players.admin_units` is already covered by the existing admin update policy (`is_admin()`); no new policy needed. Confirm the admin update policy allows updating this column (it updates the whole row, so it does).

## Frontend

### Admin tab — `src/components/AdminTabs.tsx`
Add a **Points** tab → route `/admin/points`.

### Route — `src/App.tsx`
Add `<Route path="/admin/points" ...>` wrapped in `<Protected admin>` exactly like the other admin screens.

### New screen — `src/screens/AdminPoints.tsx`
- Loads all players (`supabase.from('players').select('id, name, flag_code, avatar_url, admin_units').order('name')`), same shape as `AdminPlayers.tsx`.
- One row per player: `Avatar` + name on the left; a `−  [N]  ＋` stepper on the right showing the current step count and the resulting `±N0 pts` label.
- `−` / `＋` clamp at `-10` / `+10` (buttons disabled at the bound).
- Each press writes immediately and clamps server-bound value too:
  `await supabase.from('players').update({ admin_units: v }).eq('id', id)` then refetch (mirrors `setLegacy` in `AdminPlayers.tsx`).
- Optimistic local state update so the stepper feels instant.

### Ranking sticker — `src/components/LeaderRow.tsx`
- `LeaderRow` type gains `admin_units: number`.
- When `row.admin_units !== 0`, render a star **sticker** between the name and the score:
  - value = `row.admin_units * 10`; text = `${value > 0 ? '+' : ''}${value} admin`.
  - positive → holographic variant; negative → red variant.

### Styles — `src/index.css`
Reuse the existing `.star-badge` star clip-path as the base shape; add:
- `.sticker` — tilt (`rotate(-8deg)`), gloss highlight, soft drop-shadow so it reads as a physical sticker.
- `.sticker--holo` — animated rainbow: a `conic`/`linear` rainbow gradient with `@keyframes adminHolo { to { filter: hue-rotate(360deg); } }` (slow, ~6s loop).
- `.sticker--bad` — solid red fill, no animation.
- `@media (prefers-reduced-motion: reduce)` — disable the hue-rotate animation (static rainbow gradient remains).

### Types / data
- `src/types.ts`: `LeaderRow` gains `admin_units: number`. `Player` gains `admin_units: number` (loaded via `AuthContext` `select('*')`, harmless if unused there).
- `src/hooks/useLeaderboard.ts`: already `select('*')`, so `admin_units` flows through. **Add a realtime subscription on the `players` table** (or extend the existing channel) so an admin changing `admin_units` re-fetches the leaderboard — current subscriptions only watch `predictions` and `matches`.

## Testing / verification

- `npm run build` (typecheck) passes.
- SQL: the `leaderboard` view `total` includes `admin_units * 10`; the `CHECK` constraint rejects values outside −10…+10.
- UI:
  - Stepper clamps at ±10 and persists across reload.
  - Setting a positive value shows a holographic star sticker reading `+N0 admin` (green/rainbow) on that player's ranking row; the player's total increases by `N*10`.
  - Setting a negative value shows a red star sticker reading `-N0 admin`; total decreases.
  - Setting back to `0` removes the sticker and the bonus from the total.
  - `prefers-reduced-motion` disables the shimmer animation.

## Out of scope

- Audit trail / history of adjustments, reasons, or which admin applied them.
- Per-match or time-bounded admin bonuses (this is a single standing adjustment per player).
- Notifications to the player when they receive admin points.
