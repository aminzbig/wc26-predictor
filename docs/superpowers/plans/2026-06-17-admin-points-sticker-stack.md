# Admin Points v2 (Sticker Stack) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-integer admin-points model with a list of individual ±10 "stickers" — admins add bonus/penalty stickers and clear them; the ranking row shows them as an overlapping pile that fans out on tap.

**Architecture:** A new `admin_points` table (one row per ±10 sticker) replaces the `players.admin_units` column. The `leaderboard` view sums the deltas into `total` and exposes an ordered `admin_deltas` array via scalar subqueries (no join, so the predictions aggregation is untouched). The frontend swaps the single `adminBadge` for a pure `adminStickers()` helper plus a `StickerStack` component (collapsed pile → tap → fanned row). The admin screen swaps the stepper for ＋bonus / −penalty / Clear actions writing to `admin_points`.

**Tech Stack:** React + TypeScript, Vite, react-router-dom, framer-motion, Tailwind, Supabase (Postgres + RLS + realtime), Vitest + @testing-library/react.

## Global Constraints

- Each sticker = ±10 points; `admin_points.delta` is exactly `+10` or `-10` (CHECK `delta in (-10,10)`).
- Cap: **10 bonus and 10 penalty** stickers per player. The matching Add button disables at its cap.
- **Clear** deletes ALL of a player's stickers (both colors) — single button.
- Sticker variants: `+10 → 'holo'` (holographic), `-10 → 'bad'` (red). Reuse the existing `.star-badge` / `.sticker` / `.sticker--holo` / `.sticker--bad` CSS in `src/index.css` — do not add new sticker CSS.
- Respect `prefers-reduced-motion` (already handled by the existing CSS — do not regress it).
- Migration filename: `supabase/migrations/0019_admin_points_stickers.sql` (next sequential number; supersedes the `admin_units` parts of `0018`).
- This migration is applied to the live cloud DB by the controller (needs the deploy token + user consent) — implementer subagents do NOT apply it.
- Follow existing patterns: admin screens in `src/screens/admin/`, import `supabase` from the relative `lib/supabase`, RLS admin gate via `is_admin()` mirroring `matches_admin_write` (migration `0002_rls.sql`).

---

### Task 1: Migration — `admin_points` table, view, RLS, realtime, drop `admin_units`

**Files:**
- Create: `supabase/migrations/0019_admin_points_stickers.sql`

**Interfaces:**
- Consumes: `players` table; existing `leaderboard` view (currently from `0018`); existing `players_update_self` policy (`0018` version freezes `admin_units`).
- Produces: table `admin_points(id uuid, player_id uuid, delta smallint, created_at timestamptz)`; `leaderboard` view returns `admin_deltas smallint[]` and a `total` that sums `admin_points.delta`; `players.admin_units` no longer exists; `players_update_self` no longer references `admin_units`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0019_admin_points_stickers.sql`:

```sql
-- Admin points v2: a list of individual +/-10 "stickers" per player,
-- replacing the single players.admin_units integer (migration 0018).

-- 1. New table: one row per sticker.
create table if not exists admin_points (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  delta smallint not null check (delta in (-10, 10)),
  created_at timestamptz not null default now()
);
create index if not exists admin_points_player_idx on admin_points (player_id);

-- 2. RLS: everyone reads, only admins write (mirrors matches_admin_write in 0002).
alter table admin_points enable row level security;
drop policy if exists admin_points_read on admin_points;
create policy admin_points_read on admin_points for select to authenticated using (true);
drop policy if exists admin_points_admin_write on admin_points;
create policy admin_points_admin_write on admin_points for all to authenticated
  using (is_admin()) with check (is_admin());

-- 3. Drop the v1 column and revert the self-update policy to the original
--    (freeze is_admin + legacy_points only; admin_units no longer exists).
alter table players drop column if exists admin_units;
drop policy if exists players_update_self on players;
create policy players_update_self on players for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from players where id = auth.uid())
    and legacy_points = (select legacy_points from players where id = auth.uid())
  );

-- 4. Leaderboard view: sum sticker deltas into total and expose the ordered
--    array. Scalar subqueries (not a join) keep the predictions aggregation intact.
create or replace view leaderboard as
select
  pl.id, pl.name, pl.flag_code,
  pl.legacy_points
    + coalesce((select sum(ap.delta) from admin_points ap where ap.player_id = pl.id), 0)
    + coalesce(sum(pr.points_awarded),0)::int as total,
  count(*) filter (where m.status='finished'
    and pr.home_pred = m.home_score and pr.away_pred = m.away_score) as exact_hits,
  count(*) filter (where m.status='finished'
    and not (pr.home_pred = m.home_score and pr.away_pred = m.away_score)
    and pr.home_pred - pr.away_pred = m.home_score - m.away_score) as diff_hits,
  pl.avatar_url,
  (select coalesce(array_agg(ap.delta order by ap.created_at, ap.id), '{}'::smallint[])
     from admin_points ap where ap.player_id = pl.id) as admin_deltas
from players pl
left join predictions pr on pr.player_id = pl.id
left join matches m on m.id = pr.match_id and m.status='finished'
group by pl.id, pl.name, pl.flag_code, pl.avatar_url, pl.legacy_points;

grant select on leaderboard to authenticated;

-- 5. Broadcast admin_points changes so the leaderboard refreshes live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_points'
     )
  then
    alter publication supabase_realtime add table admin_points;
  end if;
end $$;
```

- [ ] **Step 2: Verify the SQL is internally consistent (read-through)**

Re-read the file. Confirm: `group by` lists exactly the non-aggregated `pl.*` columns (id, name, flag_code, avatar_url, legacy_points) and NOT the scalar-subquery columns; `delta` CHECK is `in (-10,10)`; the view drops no existing column (`exact_hits`, `diff_hits`, `avatar_url` all present). No command to run — this is a migration file; the controller applies it to the cloud DB separately.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0019_admin_points_stickers.sql
git commit -m "feat(admin-points): admin_points sticker table, view, RLS; drop admin_units"
```

---

### Task 2: Types — `admin_deltas` on `LeaderRow`, drop `admin_units`

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LeaderRow.admin_deltas: number[] | null`; `Player` no longer has `admin_units`.

- [ ] **Step 1: Update `Player`**

In `src/lib/types.ts`, change the `Player` interface's last line from:
```ts
  is_admin: boolean; legacy_points: number; admin_units: number
```
to:
```ts
  is_admin: boolean; legacy_points: number
```

- [ ] **Step 2: Update `LeaderRow`**

Change the `LeaderRow` interface from:
```ts
export interface LeaderRow {
  id: string; name: string; flag_code: string | null; avatar_url: string | null
  total: number; exact_hits: number; diff_hits: number; admin_units: number
}
```
to:
```ts
export interface LeaderRow {
  id: string; name: string; flag_code: string | null; avatar_url: string | null
  total: number; exact_hits: number; diff_hits: number; admin_deltas: number[] | null
}
```

- [ ] **Step 3: Verify (expected to fail to build — that's OK here)**

Run: `npm run build`
Expected: FAIL — `src/lib/adminBadge.ts`, `src/components/LeaderRow.tsx`, and `src/screens/admin/AdminPoints.tsx` still reference `admin_units`/`adminBadge`. These are fixed in Tasks 3–6. Do NOT fix them in this task. (If the build instead passes, that's fine too.) Note the failing references in your report so the controller knows they're expected.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(admin-points): swap admin_units for admin_deltas on LeaderRow type"
```

---

### Task 3: `adminStickers()` helper (TDD), delete `adminBadge`

**Files:**
- Create: `src/lib/adminStickers.ts`
- Test: `src/lib/adminStickers.test.ts`
- Delete: `src/lib/adminBadge.ts`, `src/lib/adminBadge.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type Sticker = { delta: 10 | -10; variant: 'holo' | 'bad' }
  export function adminStickers(deltas: number[] | null | undefined): Sticker[]
  ```
  Maps each delta in order: `10 → { delta: 10, variant: 'holo' }`, `-10 → { delta: -10, variant: 'bad' }`. Null/empty → `[]`. `StickerStack` (Task 4) consumes this.

- [ ] **Step 1: Delete the v1 helper and its test**

```bash
git rm src/lib/adminBadge.ts src/lib/adminBadge.test.ts
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/adminStickers.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { adminStickers } from './adminStickers'

describe('adminStickers', () => {
  test('null/undefined → empty', () => {
    expect(adminStickers(null)).toEqual([])
    expect(adminStickers(undefined)).toEqual([])
  })
  test('empty array → empty', () => {
    expect(adminStickers([])).toEqual([])
  })
  test('maps deltas to variants, preserving order', () => {
    expect(adminStickers([10, 10, -10])).toEqual([
      { delta: 10, variant: 'holo' },
      { delta: 10, variant: 'holo' },
      { delta: -10, variant: 'bad' },
    ])
  })
  test('single penalty', () => {
    expect(adminStickers([-10])).toEqual([{ delta: -10, variant: 'bad' }])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- adminStickers`
Expected: FAIL — cannot find module `./adminStickers`.

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/adminStickers.ts`:
```ts
export type Sticker = { delta: 10 | -10; variant: 'holo' | 'bad' }

// Each row in admin_points is a +/-10 sticker. Map deltas to display stickers,
// preserving order. Null/empty → no stickers.
export function adminStickers(deltas: number[] | null | undefined): Sticker[] {
  if (!deltas) return []
  return deltas.map(d =>
    d > 0 ? { delta: 10 as const, variant: 'holo' as const }
          : { delta: -10 as const, variant: 'bad' as const })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- adminStickers`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/adminStickers.ts src/lib/adminStickers.test.ts
git commit -m "feat(admin-points): add adminStickers helper, remove adminBadge"
```

---

### Task 4: `StickerStack` component (TDD)

**Files:**
- Create: `src/components/StickerStack.tsx`
- Test: `src/components/StickerStack.test.tsx`

**Interfaces:**
- Consumes: `adminStickers()` from `src/lib/adminStickers.ts` (Task 3); CSS classes `star-badge sticker sticker--holo|bad` from `src/index.css`.
- Produces: `export function StickerStack({ deltas }: { deltas: number[] | null }): JSX.Element | null`. Renders nothing when there are no stickers. Collapsed = an overlapping pile button; clicking toggles to an expanded row showing each sticker's value. `LeaderRow` (Task 5) consumes it.

- [ ] **Step 1: Write the failing test**

Create `src/components/StickerStack.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { StickerStack } from './StickerStack'

test('renders nothing when there are no stickers', () => {
  const { container } = render(<StickerStack deltas={[]} />)
  expect(container).toBeEmptyDOMElement()
})

test('renders one star per delta, collapsed by default', () => {
  render(<StickerStack deltas={[10, 10, -10]} />)
  // collapsed pile is a toggle button, not expanded
  const toggle = screen.getByRole('button', { name: /admin stickers/i })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(toggle.querySelectorAll('.sticker')).toHaveLength(3)
})

test('tapping fans out and shows each value; tapping again collapses', () => {
  render(<StickerStack deltas={[10, -10]} />)
  const toggle = screen.getByRole('button', { name: /admin stickers/i })
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('+10')).toBeInTheDocument()
  expect(screen.getByText('-10')).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

test('colors stickers by sign', () => {
  render(<StickerStack deltas={[10, -10]} />)
  const toggle = screen.getByRole('button', { name: /admin stickers/i })
  expect(toggle.querySelectorAll('.sticker--holo')).toHaveLength(1)
  expect(toggle.querySelectorAll('.sticker--bad')).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- StickerStack`
Expected: FAIL — cannot find module `./StickerStack`.

- [ ] **Step 3: Write the implementation**

Create `src/components/StickerStack.tsx`:
```tsx
import { useState } from 'react'
import { adminStickers } from '../lib/adminStickers'

// A pile of admin reward/penalty stickers on a ranking row. Collapsed it is an
// overlapping pile; tapping fans it out so each sticker's value is readable.
export function StickerStack({ deltas }: { deltas: number[] | null }) {
  const [expanded, setExpanded] = useState(false)
  const stickers = adminStickers(deltas)
  if (stickers.length === 0) return null

  return (
    <button
      type="button"
      aria-label="admin stickers"
      aria-expanded={expanded}
      onClick={() => setExpanded(e => !e)}
      className={`flex-none flex items-center bg-transparent border-0 p-0 ${expanded ? 'gap-1' : ''}`}>
      {stickers.map((s, i) => (
        <span
          key={i}
          className={`star-badge sticker sticker--${s.variant} grid place-items-center
            w-[34px] h-[34px] font-display text-[9px] leading-none text-center
            ${expanded ? '' : i > 0 ? '-ml-3' : ''}`}>
          {expanded ? (s.delta > 0 ? `+${s.delta}` : `${s.delta}`) : ''}
        </span>
      ))}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- StickerStack`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/StickerStack.tsx src/components/StickerStack.test.tsx
git commit -m "feat(admin-points): add StickerStack pile/fan-out component"
```

---

### Task 5: Wire `StickerStack` into `LeaderRow`

**Files:**
- Modify: `src/components/LeaderRow.tsx`
- Modify: `src/components/LeaderRow.test.tsx`

**Interfaces:**
- Consumes: `StickerStack` (Task 4); `LeaderRow.admin_deltas` (Task 2).
- Produces: ranking row renders `<StickerStack deltas={row.admin_deltas} />` between the name block and the total.

- [ ] **Step 1: Update `LeaderRow.tsx`**

Replace the `adminBadge` import line:
```tsx
import { adminBadge } from '../lib/adminBadge'
```
with:
```tsx
import { StickerStack } from './StickerStack'
```
Remove the `const badge = adminBadge(row.admin_units)` line entirely.
Replace the badge block:
```tsx
      {badge && (
        <span
          className={`star-badge sticker sticker--${badge.variant} flex-none w-[58px] h-[58px] font-display text-[10px] leading-none text-center px-1`}>
          {badge.label}
        </span>
      )}
```
with:
```tsx
      <StickerStack deltas={row.admin_deltas} />
```

- [ ] **Step 2: Update `LeaderRow.test.tsx`**

Replace the entire contents of `src/components/LeaderRow.test.tsx` with:
```tsx
import { render, screen } from '@testing-library/react'
import { LeaderRow } from './LeaderRow'
import type { LeaderRow as Row } from '../lib/types'

const base: Row = {
  id: 'p1', name: 'Sofia', flag_code: 'pt', avatar_url: null,
  total: 120, exact_hits: 2, diff_hits: 3, admin_deltas: null,
}

test('renders name and total', () => {
  render(<LeaderRow row={base} rank={1} isMe={false} />)
  expect(screen.getByText('Sofia')).toBeInTheDocument()
  expect(screen.getByText('120')).toBeInTheDocument()
})

test('no sticker stack when admin_deltas is empty/null', () => {
  render(<LeaderRow row={base} rank={1} isMe={false} />)
  expect(screen.queryByRole('button', { name: /admin stickers/i })).toBeNull()
})

test('shows a sticker stack when admin_deltas present', () => {
  render(<LeaderRow row={{ ...base, admin_deltas: [10, 10, -10] }} rank={1} isMe={false} />)
  const stack = screen.getByRole('button', { name: /admin stickers/i })
  expect(stack.querySelectorAll('.sticker')).toHaveLength(3)
})
```

- [ ] **Step 3: Run the tests**

Run: `npm test -- LeaderRow StickerStack adminStickers`
Expected: PASS (all three files green).

- [ ] **Step 4: Verify the full build now typechecks**

Run: `npm run build`
Expected: PASS — the only remaining `admin_units` reference is in `AdminPoints.tsx`, fixed in Task 6. If the build still fails solely on `AdminPoints.tsx`, that is expected; note it in your report. (LeaderRow/types/adminStickers must not be the cause.)

- [ ] **Step 5: Commit**

```bash
git add src/components/LeaderRow.tsx src/components/LeaderRow.test.tsx
git commit -m "feat(admin-points): render StickerStack in ranking rows"
```

---

### Task 6: Rework `AdminPoints` screen — ＋bonus / −penalty / Clear

**Files:**
- Modify: `src/screens/admin/AdminPoints.tsx` (full rewrite)

**Interfaces:**
- Consumes: `supabase`, `AdminTabs`, `Avatar`; the `admin_points` table (Task 1).
- Produces: admin UI that inserts/deletes `admin_points` rows. No exported interface for later tasks.

- [ ] **Step 1: Rewrite the screen**

Replace the entire contents of `src/screens/admin/AdminPoints.tsx` with:
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'
import { Avatar } from '../../components/Avatar'

const CAP = 10 // max bonus stickers and max penalty stickers per player

type Row = {
  id: string
  name: string
  flag_code: string | null
  avatar_url: string | null
  bonus: number   // count of +10 stickers
  penalty: number // count of -10 stickers
}

export function AdminPoints() {
  const [rows, setRows] = useState<Row[]>([])

  async function load() {
    const { data: players } = await supabase
      .from('players').select('id, name, flag_code, avatar_url').order('name')
    const { data: points } = await supabase
      .from('admin_points').select('player_id, delta')
    const counts = new Map<string, { bonus: number; penalty: number }>()
    for (const p of points ?? []) {
      const c = counts.get(p.player_id) ?? { bonus: 0, penalty: 0 }
      if (p.delta > 0) c.bonus++; else c.penalty++
      counts.set(p.player_id, c)
    }
    setRows((players ?? []).map(p => ({
      ...p,
      bonus: counts.get(p.id)?.bonus ?? 0,
      penalty: counts.get(p.id)?.penalty ?? 0,
    })))
  }
  useEffect(() => { load() }, [])

  async function add(id: string, delta: 10 | -10) {
    await supabase.from('admin_points').insert({ player_id: id, delta })
    load()
  }
  async function clear(id: string) {
    await supabase.from('admin_points').delete().eq('player_id', id)
    load()
  }

  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-1">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Admin</h1>
      </div>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Give bonus or penalty stickers. Each sticker = ±10 points. Up to {CAP} of each.
      </p>
      {rows.map(r => {
        const net = (r.bonus - r.penalty) * 10
        return (
          <div key={r.id} className="flex items-center gap-3 border-[3px] border-ink bg-paper p-3 mb-2">
            <Avatar url={r.avatar_url} code={r.flag_code} label={r.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-display text-[16px] uppercase truncate">{r.name}</div>
              <small className="block font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60 leading-none mt-0.5">
                {r.bonus}★ · {r.penalty}☆ ·{' '}
                <span className={net > 0 ? 'text-green' : net < 0 ? 'text-red' : ''}>
                  {net > 0 ? '+' : ''}{net} pts
                </span>
              </small>
            </div>
            <button
              aria-label={`add bonus to ${r.name}`}
              disabled={r.bonus >= CAP}
              onClick={() => add(r.id, 10)}
              className="h-9 px-2 grid place-items-center border-[3px] border-ink bg-paper font-display text-[12px] uppercase disabled:opacity-30">
              + bonus
            </button>
            <button
              aria-label={`add penalty to ${r.name}`}
              disabled={r.penalty >= CAP}
              onClick={() => add(r.id, -10)}
              className="h-9 px-2 grid place-items-center border-[3px] border-ink bg-paper font-display text-[12px] uppercase disabled:opacity-30">
              − penalty
            </button>
            <button
              aria-label={`clear ${r.name}`}
              disabled={r.bonus === 0 && r.penalty === 0}
              onClick={() => clear(r.id)}
              className="h-9 px-2 grid place-items-center border-[3px] border-ink bg-paper font-display text-[12px] uppercase disabled:opacity-30">
              clear
            </button>
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Verify the full build typechecks**

Run: `npm run build`
Expected: PASS — no remaining `admin_units` / `adminBadge` references anywhere.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all files green, including `adminStickers`, `StickerStack`, `LeaderRow`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/admin/AdminPoints.tsx
git commit -m "feat(admin-points): rework AdminPoints to bonus/penalty/clear stickers"
```

---

### Task 7: Realtime — subscribe to `admin_points` instead of `players`

**Files:**
- Modify: `src/hooks/useLeaderboard.ts`

**Interfaces:**
- Consumes: existing `load()` and channel `ch`.
- Produces: leaderboard re-fetches when `admin_points` changes (sticker adds/clears appear live). The `players` subscription is removed (points no longer live on `players`).

- [ ] **Step 1: Swap the subscription**

In `src/hooks/useLeaderboard.ts`, change:
```ts
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, load)
```
to:
```ts
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_points' }, load)
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLeaderboard.ts
git commit -m "feat(admin-points): refresh leaderboard on admin_points changes"
```

---

### Task 8: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite + build**

Run: `npm test && npm run build`
Expected: both PASS.

- [ ] **Step 2: Manual end-to-end (controller applies migration `0019` to the cloud DB first)**

With migration `0019` applied and `npm run dev` running, logged in as admin:
1. Admin → Points: each player shows `+ bonus`, `− penalty`, `clear`, and a `0★ · 0☆ · 0 pts` readout.
2. Tap `+ bonus` twice and `− penalty` once on one player → readout shows `2★ · 1☆ · +10 pts`.
3. Ranking: that player's row shows an overlapping pile of 3 stickers (2 holographic, 1 red), total up by 10 (live, no reload).
4. Tap the pile → it fans out showing `+10 +10 -10`; tap again → collapses.
5. Admin → `clear` on that player → pile disappears from ranking, total back to baseline.
6. With reduced motion enabled, the holographic stickers are static (no shimmer).
7. Confirm `+ bonus` disables after 10 bonus stickers (and `− penalty` after 10 penalties).

- [ ] **Step 3: Final commit (only if verification required fixes)**

```bash
git add -A
git commit -m "fix(admin-points): verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** list model / mixed signs (Task 1 table), each sticker ±10 + CHECK (Task 1), cap 10+10 (Task 6 disable), Clear wipes all (Task 6), drop admin_units + revert RLS (Task 1), view sums deltas + exposes admin_deltas via subqueries (Task 1), adminStickers helper (Task 3), StickerStack pile/fan-out (Task 4), LeaderRow wiring (Task 5), admin screen bonus/penalty/clear (Task 6), realtime on admin_points (Task 7), reuse existing sticker CSS (Tasks 4/5 use `.star-badge`/`.sticker`). All covered.
- **Type consistency:** `admin_deltas: number[] | null` used in types (Task 2), LeaderRow (Task 5), StickerStack prop (Task 4). `adminStickers(deltas)` returns `Sticker[]` consumed by StickerStack. `delta: 10 | -10` consistent across helper and admin insert. No lingering `admin_units`/`adminBadge` after Task 6.
- **Build-ordering note:** Tasks 2–6 transit through intermediate states where `npm run build` fails on not-yet-updated files (`adminBadge`/`admin_units`). Each such task's verify step states the expected failure explicitly; the build is green again after Task 5 (except AdminPoints) and fully green after Task 6.
