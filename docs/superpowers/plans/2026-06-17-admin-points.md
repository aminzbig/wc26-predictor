# Admin Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin award/deduct bonus points to any player (±10 per step, −10…+10 steps) from a new admin **Points** tab, fold those points into the leaderboard total, and show them on the ranking row as a holographic (positive) or red (negative) reward-sticker star reading e.g. `+30 admin`.

**Architecture:** A single `admin_units smallint` column on `players` holds the adjustment (each unit = 10 pts). The `leaderboard` view adds `admin_units * 10` to `total` and also exposes `admin_units`. A new `AdminPoints` screen writes the column directly (existing `is_admin()` RLS covers it). `LeaderRow` renders a sticker via a pure `adminBadge()` helper. `useLeaderboard` gains a `players` realtime subscription so admin edits appear live.

**Tech Stack:** React + TypeScript, Vite, react-router-dom, framer-motion, Tailwind, Supabase (Postgres + RLS + realtime), Vitest + @testing-library/react.

## Global Constraints

- Each admin step = **10 points**. Displayed/awarded value = `admin_units * 10`.
- `admin_units` range is **−10 … +10** inclusive. Enforced in DB (`CHECK`) and UI (buttons disable at bounds).
- `admin_units = 0` → contributes 0 and renders **no** sticker (it is the cleared state).
- Badge text: `+30 admin` (positive) / `-20 admin` (negative). Positive → holographic rainbow; negative → solid red.
- Migration filename: `supabase/migrations/0018_admin_points.sql` (next sequential number).
- Reuse the existing `.star-badge` clip-path (`src/index.css:15`); add sticker variants, don't replace it.
- Respect `prefers-reduced-motion` (no hue-rotate animation when set).
- Follow existing patterns: admin screens live in `src/screens/admin/`, import `supabase` from `../../lib/supabase`, write with `supabase.from('players').update({...}).eq('id', id)`.

---

### Task 1: Database migration — column + leaderboard view

**Files:**
- Create: `supabase/migrations/0018_admin_points.sql`

**Interfaces:**
- Consumes: existing `players` table, existing `leaderboard` view (defined in `0017_avatars.sql`).
- Produces: `players.admin_units smallint` (−10…+10); `leaderboard` view now returns an `admin_units int` column and a `total` that includes `admin_units * 10`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0018_admin_points.sql` with exactly this content. The view body is copied verbatim from `0017_avatars.sql` with two changes: `admin_units` added to `total`, and `pl.admin_units` added to the select list and `GROUP BY`.

```sql
-- Admin points: a single per-player adjustment. Each unit = 10 points.
-- Range -10..+10 (i.e. -100..+100 points). 0 = no adjustment.

alter table players
  add column if not exists admin_units smallint not null default 0;

alter table players
  drop constraint if exists players_admin_units_range;
alter table players
  add constraint players_admin_units_range check (admin_units between -10 and 10);

-- Fold admin points into the leaderboard total and expose the raw units
-- so the ranking row can render the sticker.
create or replace view leaderboard as
select
  pl.id, pl.name, pl.flag_code,
  pl.legacy_points + (pl.admin_units * 10) + coalesce(sum(pr.points_awarded),0)::int as total,
  count(*) filter (where m.status='finished'
    and pr.home_pred = m.home_score and pr.away_pred = m.away_score) as exact_hits,
  count(*) filter (where m.status='finished'
    and not (pr.home_pred = m.home_score and pr.away_pred = m.away_score)
    and pr.home_pred - pr.away_pred = m.home_score - m.away_score) as diff_hits,
  pl.avatar_url,
  pl.admin_units
from players pl
left join predictions pr on pr.player_id = pl.id
left join matches m on m.id = pr.match_id and m.status='finished'
group by pl.id, pl.name, pl.flag_code, pl.avatar_url, pl.legacy_points, pl.admin_units;

grant select on leaderboard to authenticated;
```

- [ ] **Step 2: Apply the migration to the cloud DB**

This project uses the cloud Supabase (Fifa26, ref `ekgaegdtozqeziyycoul`). Apply with the owner PAT from memory (`supabase-fifa26-deploy-token`):

Run:
```bash
SUPABASE_ACCESS_TOKEN=<token-from-memory> npx supabase db push --linked
```
Expected: output lists `0018_admin_points.sql` as applied with no errors.

If `db push` is not wired up in this environment, apply the SQL directly via the Supabase SQL editor / `psql`. The deliverable is: the column and updated view exist in the cloud DB.

- [ ] **Step 3: Verify column + view in the DB**

Run (psql or SQL editor):
```sql
select column_name from information_schema.columns
  where table_name='players' and column_name='admin_units';
select admin_units from leaderboard limit 1;
```
Expected: `admin_units` row returned for both; the second query succeeds (view has the column).

- [ ] **Step 4: Verify the CHECK constraint rejects out-of-range values**

Run:
```sql
-- pick any real player id
update players set admin_units = 11 where id = (select id from players limit 1);
```
Expected: FAIL — `new row ... violates check constraint "players_admin_units_range"`. (Roll back / leave row unchanged.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0018_admin_points.sql
git commit -m "feat(admin-points): add admin_units column and fold into leaderboard view"
```

---

### Task 2: Types — add `admin_units` to `Player` and `LeaderRow`

**Files:**
- Modify: `src/lib/types.ts:4-8` (`Player`), `src/lib/types.ts:32-35` (`LeaderRow`)

**Interfaces:**
- Consumes: nothing.
- Produces: `Player.admin_units: number`, `LeaderRow.admin_units: number`. All later tasks rely on these fields existing.

- [ ] **Step 1: Add `admin_units` to `Player`**

In `src/lib/types.ts`, change the `Player` interface's last line from:
```ts
  is_admin: boolean; legacy_points: number
```
to:
```ts
  is_admin: boolean; legacy_points: number; admin_units: number
```

- [ ] **Step 2: Add `admin_units` to `LeaderRow`**

In `src/lib/types.ts`, change the `LeaderRow` interface from:
```ts
export interface LeaderRow {
  id: string; name: string; flag_code: string | null; avatar_url: string | null
  total: number; exact_hits: number; diff_hits: number
}
```
to:
```ts
export interface LeaderRow {
  id: string; name: string; flag_code: string | null; avatar_url: string | null
  total: number; exact_hits: number; diff_hits: number; admin_units: number
}
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `npm run build`
Expected: PASS (no type errors). The new fields are populated by `select('*')` reads already in the codebase, so no call site breaks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(admin-points): add admin_units to Player and LeaderRow types"
```

---

### Task 3: `adminBadge()` helper (pure, TDD)

**Files:**
- Create: `src/lib/adminBadge.ts`
- Test: `src/lib/adminBadge.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type AdminBadge = { label: string; variant: 'holo' | 'bad' }
  export function adminBadge(units: number): AdminBadge | null
  ```
  Returns `null` when `units === 0`. `label` is e.g. `"+30 admin"` / `"-20 admin"`. `variant` is `'holo'` for positive, `'bad'` for negative. `LeaderRow` (Task 5) consumes this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/adminBadge.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { adminBadge } from './adminBadge'

describe('adminBadge', () => {
  test('zero units → null (no sticker)', () => {
    expect(adminBadge(0)).toBeNull()
  })
  test('positive units → holographic sticker with +N0 admin label', () => {
    expect(adminBadge(3)).toEqual({ label: '+30 admin', variant: 'holo' })
  })
  test('single positive unit', () => {
    expect(adminBadge(1)).toEqual({ label: '+10 admin', variant: 'holo' })
  })
  test('negative units → red sticker with -N0 admin label', () => {
    expect(adminBadge(-2)).toEqual({ label: '-20 admin', variant: 'bad' })
  })
  test('max bounds', () => {
    expect(adminBadge(10)).toEqual({ label: '+100 admin', variant: 'holo' })
    expect(adminBadge(-10)).toEqual({ label: '-100 admin', variant: 'bad' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- adminBadge`
Expected: FAIL — cannot find module `./adminBadge`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/adminBadge.ts`:
```ts
export type AdminBadge = { label: string; variant: 'holo' | 'bad' }

// Each admin unit is worth 10 points. 0 → no sticker.
export function adminBadge(units: number): AdminBadge | null {
  if (!units) return null
  const value = units * 10
  const label = `${value > 0 ? '+' : ''}${value} admin`
  return { label, variant: value > 0 ? 'holo' : 'bad' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- adminBadge`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminBadge.ts src/lib/adminBadge.test.ts
git commit -m "feat(admin-points): add adminBadge helper"
```

---

### Task 4: Sticker styles in CSS

**Files:**
- Modify: `src/index.css` (add after the `.star-badge` block at line ~15-17)

**Interfaces:**
- Consumes: existing `.star-badge` clip-path.
- Produces: CSS classes `.sticker`, `.sticker--holo`, `.sticker--bad` used by `LeaderRow` (Task 5). A `.sticker` element is expected to also carry `.star-badge` for the star shape.

- [ ] **Step 1: Add the sticker styles**

In `src/index.css`, immediately after the existing `.star-badge { ... }` rule, add:
```css
/* admin-points reward sticker (sits on a star-badge shape) */
.sticker {
  position: relative;
  display: grid;
  place-items: center;
  transform: rotate(-8deg);
  color: #fff;
  text-shadow: 0 1px 1px rgba(0,0,0,.35);
  filter: drop-shadow(0 2px 2px rgba(20,18,16,.35));
}
/* glossy highlight */
.sticker::before {
  content: '';
  position: absolute;
  inset: 0;
  clip-path: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,.55), rgba(255,255,255,0) 45%);
  pointer-events: none;
}
.sticker--holo {
  background: linear-gradient(135deg, #ff3d7f, #ffb800, #2ad17e, #2ab6ff, #9b5cff, #ff3d7f);
  background-size: 300% 300%;
  animation: adminHolo 6s linear infinite;
}
@keyframes adminHolo {
  0%   { background-position: 0% 50%; filter: hue-rotate(0deg); }
  100% { background-position: 100% 50%; filter: hue-rotate(360deg); }
}
.sticker--bad {
  background: radial-gradient(circle at 35% 30%, #ff6a6a, #d11a1a 70%);
}
@media (prefers-reduced-motion: reduce) {
  .sticker--holo { animation: none; }
}
```

- [ ] **Step 2: Verify the build still compiles the CSS**

Run: `npm run build`
Expected: PASS (Vite builds; no CSS syntax errors).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(admin-points): add reward-sticker styles (holo + red)"
```

---

### Task 5: Render the sticker in `LeaderRow` (TDD)

**Files:**
- Modify: `src/components/LeaderRow.tsx`
- Test: `src/components/LeaderRow.test.tsx` (create)

**Interfaces:**
- Consumes: `adminBadge()` from `src/lib/adminBadge.ts` (Task 3); CSS classes from Task 4; `LeaderRow.admin_units` (Task 2).
- Produces: ranking row renders a `<span>` sticker with text from `adminBadge().label` when `admin_units !== 0`, and nothing when `0`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LeaderRow.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { LeaderRow } from './LeaderRow'
import type { LeaderRow as Row } from '../lib/types'

const base: Row = {
  id: 'p1', name: 'Sofia', flag_code: 'pt', avatar_url: null,
  total: 120, exact_hits: 2, diff_hits: 3, admin_units: 0,
}

test('no sticker when admin_units is 0', () => {
  render(<LeaderRow row={base} rank={1} isMe={false} />)
  expect(screen.queryByText(/admin/)).toBeNull()
})

test('positive admin_units shows a holographic +N0 admin sticker', () => {
  render(<LeaderRow row={{ ...base, admin_units: 3 }} rank={1} isMe={false} />)
  const badge = screen.getByText('+30 admin')
  expect(badge).toBeInTheDocument()
  expect(badge.className).toContain('sticker--holo')
})

test('negative admin_units shows a red -N0 admin sticker', () => {
  render(<LeaderRow row={{ ...base, admin_units: -2 }} rank={1} isMe={false} />)
  const badge = screen.getByText('-20 admin')
  expect(badge).toBeInTheDocument()
  expect(badge.className).toContain('sticker--bad')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- LeaderRow`
Expected: FAIL — the sticker text is not rendered yet.

- [ ] **Step 3: Implement the sticker in `LeaderRow`**

In `src/components/LeaderRow.tsx`, add the import near the top (after the existing imports):
```tsx
import { adminBadge } from '../lib/adminBadge'
```
Inside the component body, before the `return`, compute the badge:
```tsx
const badge = adminBadge(row.admin_units)
```
Then insert the sticker between the name block and the total score. Change the name `<div>` + total `<div>` region so the sticker sits between them — replace:
```tsx
      <div className="flex-1 min-w-0">
        <div className="font-display text-[18px] uppercase leading-none truncate">
          {isMe ? `You · ${row.name}` : row.name}
        </div>
        <small className="block font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60 leading-none mt-0.5">
          {row.exact_hits} exact · {row.diff_hits} diff
        </small>
      </div>
      <div className="font-display text-[22px] text-ink text-right flex-none">{row.total}</div>
```
with:
```tsx
      <div className="flex-1 min-w-0">
        <div className="font-display text-[18px] uppercase leading-none truncate">
          {isMe ? `You · ${row.name}` : row.name}
        </div>
        <small className="block font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60 leading-none mt-0.5">
          {row.exact_hits} exact · {row.diff_hits} diff
        </small>
      </div>
      {badge && (
        <span
          className={`star-badge sticker sticker--${badge.variant} flex-none w-[58px] h-[58px] font-display text-[10px] leading-none text-center px-1`}>
          {badge.label}
        </span>
      )}
      <div className="font-display text-[22px] text-ink text-right flex-none">{row.total}</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- LeaderRow`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify full build/typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/LeaderRow.tsx src/components/LeaderRow.test.tsx
git commit -m "feat(admin-points): show reward-sticker on ranking rows"
```

---

### Task 6: Realtime — refresh leaderboard on `players` changes

**Files:**
- Modify: `src/hooks/useLeaderboard.ts:13-15`

**Interfaces:**
- Consumes: existing `load()` and channel `ch`.
- Produces: leaderboard re-fetches when any `players` row changes (so admin edits to `admin_units` appear live).

- [ ] **Step 1: Add the `players` subscription**

In `src/hooks/useLeaderboard.ts`, change the channel setup from:
```ts
    const ch = supabase.channel('lb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .subscribe()
```
to:
```ts
    const ch = supabase.channel('lb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, load)
      .subscribe()
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLeaderboard.ts
git commit -m "feat(admin-points): refresh leaderboard on players changes"
```

---

### Task 7: Admin **Points** tab + route

**Files:**
- Modify: `src/components/AdminTabs.tsx`
- Modify: `src/App.tsx:12-13` (import), `src/App.tsx:35-36` (route)

**Interfaces:**
- Consumes: `AdminPoints` screen (Task 8) — imported but the file is created in Task 8. **Do Task 8 before running the build in this task's verify step, OR create a stub first.** To keep this task independently testable, create the route pointing at a minimal stub, then Task 8 fills it in.
- Produces: a `Points` tab linking to `/admin/points`, and a protected route at that path.

- [ ] **Step 1: Add the tab**

In `src/components/AdminTabs.tsx`, change the `tabs` array from:
```ts
const tabs = [['/admin', 'Results'], ['/admin/fixtures', 'Fixtures'], ['/admin/players', 'Players'], ['/admin/settings', 'Settings']]
```
to:
```ts
const tabs = [['/admin', 'Results'], ['/admin/fixtures', 'Fixtures'], ['/admin/players', 'Players'], ['/admin/points', 'Points'], ['/admin/settings', 'Settings']]
```

- [ ] **Step 2: Create a minimal `AdminPoints` stub so the route resolves**

Create `src/screens/admin/AdminPoints.tsx`:
```tsx
export function AdminPoints() {
  return null
}
```
(Task 8 replaces this body.)

- [ ] **Step 3: Wire the route in `App.tsx`**

In `src/App.tsx`, add the import next to the other admin imports (after the `AdminPlayers` import on line 12):
```tsx
import { AdminPoints } from './screens/admin/AdminPoints'
```
Add the route after the `/admin/players` route (line 35):
```tsx
        <Route path="/admin/points" element={<Protected admin><Shell><AdminPoints /></Shell></Protected>} />
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminTabs.tsx src/App.tsx src/screens/admin/AdminPoints.tsx
git commit -m "feat(admin-points): add Points admin tab and route"
```

---

### Task 8: `AdminPoints` screen — per-player stepper

**Files:**
- Modify: `src/screens/admin/AdminPoints.tsx` (replace the stub from Task 7)

**Interfaces:**
- Consumes: `supabase`, `AdminTabs`, `Avatar`, `Player` type (now has `admin_units`).
- Produces: the admin UI. Writes `players.admin_units` (clamped −10…+10) on each `−`/`+` press.

- [ ] **Step 1: Implement the screen**

Replace the entire contents of `src/screens/admin/AdminPoints.tsx` with:
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'
import { Avatar } from '../../components/Avatar'
import type { Player } from '../../lib/types'

const MIN = -10
const MAX = 10

export function AdminPoints() {
  const [players, setPlayers] = useState<Player[]>([])

  async function load() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers((data ?? []) as Player[])
  }
  useEffect(() => { load() }, [])

  async function setUnits(id: string, units: number) {
    const v = Math.max(MIN, Math.min(MAX, units))
    // optimistic
    setPlayers(ps => ps.map(p => (p.id === id ? { ...p, admin_units: v } : p)))
    await supabase.from('players').update({ admin_units: v }).eq('id', id)
  }

  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-1">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Admin</h1>
      </div>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Award or deduct bonus points. Each step = 10 points. 0 removes the bonus.
      </p>
      {players.map(p => {
        const pts = p.admin_units * 10
        return (
          <div key={p.id} className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 mb-2">
            <Avatar url={p.avatar_url} code={p.flag_code} label={p.name} size="sm" />
            <div className="flex-1 min-w-0 font-display text-[16px] uppercase truncate">{p.name}</div>
            <div
              className={`font-display text-[14px] w-16 text-right ${pts > 0 ? 'text-green' : pts < 0 ? 'text-red' : 'text-ink/40'}`}>
              {pts > 0 ? '+' : ''}{pts} pts
            </div>
            <button
              aria-label={`decrease ${p.name}`}
              disabled={p.admin_units <= MIN}
              onClick={() => setUnits(p.id, p.admin_units - 1)}
              className="w-9 h-9 grid place-items-center border-[3px] border-ink bg-paper font-display text-[20px] disabled:opacity-30">
              −
            </button>
            <div className="w-8 text-center font-display text-[18px]">{p.admin_units}</div>
            <button
              aria-label={`increase ${p.name}`}
              disabled={p.admin_units >= MAX}
              onClick={() => setUnits(p.id, p.admin_units + 1)}
              className="w-9 h-9 grid place-items-center border-[3px] border-ink bg-paper font-display text-[20px] disabled:opacity-30">
              +
            </button>
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Verify build/typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Manual verification in the running app**

Run: `npm run dev` and open the app on `:5175` (requires `.env.local` with cloud Supabase creds — see memory `local-dev-env-setup`). Log in as an admin, go to **Admin → Points**.
Expected:
- Each player has a `− N +` stepper and a `±N0 pts` label.
- `+` increments to +10 max (button disables at +10); `−` to −10 min (disables at −10).
- Changing a value persists across reload.

- [ ] **Step 4: Commit**

```bash
git add src/screens/admin/AdminPoints.tsx
git commit -m "feat(admin-points): implement AdminPoints stepper screen"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — including `adminBadge` (5) and `LeaderRow` (3) tests, and all pre-existing tests still green.

- [ ] **Step 2: Full typecheck/build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Manual end-to-end in the running app**

With `npm run dev` running and logged in as admin:
1. Admin → Points: set a player to **+3** (shows `+30 pts`).
2. Go to **Ranking**: that player's row shows a holographic star sticker reading `+30 admin`, and their total increased by 30 (no manual reload — realtime).
3. Back to Points: set the same player to **−2**.
4. Ranking: sticker is now solid red reading `-20 admin`; total dropped accordingly.
5. Back to Points: set to **0**.
6. Ranking: the sticker is gone and the total no longer includes any admin points.
7. With OS "reduce motion" enabled, confirm the positive sticker is a static rainbow (no shimmer animation).

- [ ] **Step 4: Final commit (if any cleanup needed)**

If any fixes were required during verification, commit them:
```bash
git add -A
git commit -m "fix(admin-points): verification fixes"
```
Otherwise this task produces no commit.

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1, 2), leaderboard total includes admin points + exposes units (Task 1), ±10 range enforced DB+UI (Task 1 CHECK, Task 8 clamp/disable), 0 clears it (Task 3 returns null, Task 5 conditional render), badge text `+N0 admin` (Task 3), holographic/red sticker (Task 4 CSS, Task 5 render), reduced-motion fallback (Task 4), new Points tab + route (Task 7), stepper screen writing immediately (Task 8), realtime refresh on players changes (Task 6). All covered.
- **Type consistency:** `admin_units` (number) used identically across types, helper, component, and screen. `adminBadge()` returns `{ label, variant } | null`; `variant` values `'holo' | 'bad'` match CSS classes `.sticker--holo` / `.sticker--bad`.
- **Note:** Task 7 creates a stub so its build passes independently; Task 8 fills it in. This keeps each task independently testable.
