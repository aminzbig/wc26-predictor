# Social Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Social tab — a global wall where players post short text and react with 5 spammable emojis, shown as a Locket-style hero card over a feed of compact colored cards.

**Architecture:** A new `social_posts` table with counter-column reactions, an atomic `react_to_post` RPC, RLS mirroring existing policies, and realtime via the existing `supabase_realtime` publication. All display/reduce logic lives in a pure `src/lib/social.ts` (unit-tested); React components and a `useSocialPosts` hook stay thin and follow the existing `useMatches` pattern.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind (`paper`/`ink` + `PANEL_COLORS`), framer-motion, Supabase (Postgres + RLS + Realtime), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-15-social-wall-design.md`

**Branch:** `social-wall` (already created; spec already committed there).

---

## File Structure

**Create:**
- `supabase/migrations/0014_social.sql` — table, constraints, index, `react_to_post` RPC, RLS, realtime publication.
- `src/lib/social.ts` — types + pure helpers (reaction map, `hottest`, `relativeTime`, color classes, validation, `toView`, `upsertPost`/`removePost`/`bump`).
- `src/lib/social.test.ts` — unit tests for `social.ts`.
- `src/hooks/useSocialPosts.ts` — load + realtime + actions (`post`, `react`, `remove`).
- `src/components/ReactionBar.tsx` — 5 rectangle reaction buttons (hero + card via `size`).
- `src/components/SocialCard.tsx` — compact colored feed card.
- `src/components/SocialCard.test.tsx` — render test.
- `src/components/SocialHero.tsx` — big Locket-style latest card + reaction burst.
- `src/components/SocialComposer.tsx` — textarea + counter + color swatches + match picker + Post.
- `src/components/SocialComposer.test.tsx` — render/validation test.
- `src/screens/Social.tsx` — composes hook + composer + hero + feed.

**Modify:**
- `src/App.tsx` — add `/social` route.
- `src/components/BottomNav.tsx` — add Social tab.
- `src/components/BottomNav.test.tsx` — create if absent; assert Social link renders.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0014_social.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0014_social.sql — Social Wall: posts + counter reactions + RLS + realtime.

create table if not exists social_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references players(id) on delete cascade,
  body         text not null,
  color        text not null default 'paper',
  match_id     uuid references matches(id) on delete set null,
  heart_count  int  not null default 0,
  up_count     int  not null default 0,
  down_count   int  not null default 0,
  sandal_count int  not null default 0,
  dead_count   int  not null default 0,
  created_at   timestamptz not null default now(),
  constraint social_body_len   check (char_length(body) between 1 and 280),
  constraint social_color_valid check (color in ('orange','green','blue','yellow','red','paper'))
);

create index if not exists social_posts_created_idx on social_posts (created_at desc);

-- Atomic, validated reaction increment. SECURITY DEFINER so clients never write
-- counts directly (they could otherwise forge totals).
create or replace function react_to_post(p_id uuid, kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if kind not in ('heart','up','down','sandal','dead') then
    raise exception 'invalid reaction kind: %', kind;
  end if;
  update social_posts set
    heart_count  = heart_count  + (kind = 'heart')::int,
    up_count     = up_count     + (kind = 'up')::int,
    down_count   = down_count   + (kind = 'down')::int,
    sandal_count = sandal_count + (kind = 'sandal')::int,
    dead_count   = dead_count   + (kind = 'dead')::int
  where id = p_id;
end $$;

-- RLS (mirrors 0002_rls.sql conventions; is_admin() already exists)
alter table social_posts enable row level security;

drop policy if exists social_read on social_posts;
create policy social_read on social_posts for select to authenticated using (true);

drop policy if exists social_insert_self on social_posts;
create policy social_insert_self on social_posts for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists social_delete on social_posts;
create policy social_delete on social_posts for delete to authenticated
  using (author_id = auth.uid() or is_admin());

-- No UPDATE policy: reactions go through react_to_post(); posts are not editable.
grant execute on function react_to_post(uuid, text) to authenticated;

-- Realtime: broadcast changes so the wall updates live (same idempotent guard
-- used for `matches` in 0011_realtime_and_recompute.sql).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'social_posts'
     )
  then
    alter publication supabase_realtime add table social_posts;
  end if;
end $$;
```

- [ ] **Step 2: Apply the migration to the linked Supabase project**

The project is linked (`supabase/.temp/linked-project.json`, ref `ekgaegdtozqeziyycoul`). Apply with the owner token (see memory `supabase-fifa26-deploy-token`):

Run: `SUPABASE_ACCESS_TOKEN=<token> npx supabase db push`
Expected: output lists `0014_social.sql` as applied with no errors.

If `db push` is unavailable in this environment, paste the SQL into the Supabase SQL editor and run it.

- [ ] **Step 3: Verify the schema landed**

Run (Supabase SQL editor or psql):
```sql
select column_name from information_schema.columns
where table_name = 'social_posts' order by ordinal_position;
select proname from pg_proc where proname = 'react_to_post';
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'social_posts';
```
Expected: 11 columns listed; `react_to_post` present; `social_posts` in the publication.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_social.sql
git commit -m "feat(social): social_posts table, reaction RPC, RLS, realtime"
```

---

## Task 2: Pure helpers + types (`social.ts`)

**Files:**
- Create: `src/lib/social.ts`
- Test: `src/lib/social.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/social.test.ts
import { describe, expect, test } from 'vitest'
import {
  REACTIONS, hottest, bump, relativeTime, colorClass, isLight,
  validBody, validColor, matchLabel, toView, upsertPost, removePost,
  type SocialPostRow,
} from './social'

const row = (over: Partial<SocialPostRow> = {}): SocialPostRow => ({
  id: 'a', author_id: 'u1', body: 'hi', color: 'orange', match_id: null,
  heart_count: 0, up_count: 0, down_count: 0, sandal_count: 0, dead_count: 0,
  created_at: '2026-06-15T00:00:00.000Z', ...over,
})

describe('social helpers', () => {
  test('REACTIONS has the 5 fixed kinds in order', () => {
    expect(REACTIONS.map(r => r.key)).toEqual(['heart', 'up', 'down', 'sandal', 'dead'])
  })
  test('hottest returns null when all counts are 0', () => {
    expect(hottest(row())).toBeNull()
  })
  test('hottest returns the highest-count reaction', () => {
    expect(hottest(row({ heart_count: 2, dead_count: 9 }))).toBe('dead')
  })
  test('bump increments the matching column immutably', () => {
    const r = row()
    expect(bump(r, 'sandal').sandal_count).toBe(1)
    expect(r.sandal_count).toBe(0)
  })
  test('relativeTime formats seconds/minutes/hours/days', () => {
    const base = Date.parse('2026-06-15T12:00:00.000Z')
    expect(relativeTime('2026-06-15T11:59:30.000Z', base)).toBe('now')
    expect(relativeTime('2026-06-15T11:46:00.000Z', base)).toBe('14m')
    expect(relativeTime('2026-06-15T09:00:00.000Z', base)).toBe('3h')
    expect(relativeTime('2026-06-13T12:00:00.000Z', base)).toBe('2d')
  })
  test('colorClass / isLight map blue & red to light text', () => {
    expect(colorClass('blue')).toBe('bg-blue text-paper')
    expect(colorClass('yellow')).toBe('bg-yellow')
    expect(isLight('red')).toBe(true)
    expect(isLight('orange')).toBe(false)
  })
  test('validBody enforces 1..280 non-blank; validColor checks palette', () => {
    expect(validBody('hey')).toBe(true)
    expect(validBody('   ')).toBe(false)
    expect(validBody('x'.repeat(281))).toBe(false)
    expect(validColor('green')).toBe(true)
    expect(validColor('magenta')).toBe(false)
  })
  test('matchLabel uppercases codes', () => {
    expect(matchLabel({ id: 'm', home_code: 'br', away_code: 'ar', home_label: null, away_label: null }))
      .toBe('BR–AR')
  })
  test('toView resolves author + match label', () => {
    const v = toView(row({ author_id: 'u1', match_id: 'm' }),
      { u1: { name: 'Rafa', flag_code: 'br' } },
      { m: { id: 'm', home_code: 'br', away_code: 'ar', home_label: null, away_label: null } })
    expect(v.author_name).toBe('Rafa')
    expect(v.author_flag).toBe('br')
    expect(v.match_label).toBe('BR–AR')
  })
  test('upsertPost adds/replaces and keeps newest-first; removePost deletes', () => {
    const older = row({ id: 'a', created_at: '2026-06-15T00:00:00.000Z' })
    const newer = row({ id: 'b', created_at: '2026-06-15T01:00:00.000Z' })
    const list = upsertPost(upsertPost([], older), newer)
    expect(list.map(p => p.id)).toEqual(['b', 'a'])
    const edited = upsertPost(list, row({ id: 'a', body: 'edited', created_at: older.created_at }))
    expect(edited.find(p => p.id === 'a')!.body).toBe('edited')
    expect(removePost(edited, 'a').map(p => p.id)).toEqual(['b'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/social.test.ts`
Expected: FAIL — cannot find module `./social`.

- [ ] **Step 3: Implement `social.ts`**

```typescript
// src/lib/social.ts
export type Reaction = 'heart' | 'up' | 'down' | 'sandal' | 'dead'
export type SocialColor = 'orange' | 'green' | 'blue' | 'yellow' | 'red' | 'paper'

export interface SocialPostRow {
  id: string
  author_id: string
  body: string
  color: SocialColor
  match_id: string | null
  heart_count: number
  up_count: number
  down_count: number
  sandal_count: number
  dead_count: number
  created_at: string
}

export interface PlayerLite { name: string; flag_code: string | null }
export interface MatchLite {
  id: string
  home_code: string | null; away_code: string | null
  home_label: string | null; away_label: string | null
}
export interface PostView extends SocialPostRow {
  author_name: string
  author_flag: string | null
  match_label: string | null
}

type CountCol = 'heart_count' | 'up_count' | 'down_count' | 'sandal_count' | 'dead_count'

export const REACTIONS: { key: Reaction; emoji: string; column: CountCol }[] = [
  { key: 'heart',  emoji: '❤️', column: 'heart_count' },
  { key: 'up',     emoji: '👍', column: 'up_count' },
  { key: 'down',   emoji: '👎', column: 'down_count' },
  { key: 'sandal', emoji: '🩴', column: 'sandal_count' },
  { key: 'dead',   emoji: '💀', column: 'dead_count' },
]

export function hottest(row: SocialPostRow): Reaction | null {
  let best: Reaction | null = null
  let max = 0
  for (const r of REACTIONS) {
    const c = row[r.column]
    if (c > max) { max = c; best = r.key }
  }
  return max > 0 ? best : null
}

export function bump(row: SocialPostRow, key: Reaction): SocialPostRow {
  const col = REACTIONS.find(r => r.key === key)!.column
  return { ...row, [col]: row[col] + 1 }
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const COLOR_CLASS: Record<SocialColor, string> = {
  orange: 'bg-orange',
  green:  'bg-green',
  blue:   'bg-blue text-paper',
  yellow: 'bg-yellow',
  red:    'bg-red text-paper',
  paper:  'bg-paper',
}
export const PALETTE: SocialColor[] = ['orange', 'green', 'blue', 'yellow', 'red', 'paper']
export const colorClass = (c: SocialColor): string => COLOR_CLASS[c]
export const isLight = (c: SocialColor): boolean => c === 'blue' || c === 'red'

export const validBody = (s: string): boolean => s.trim().length >= 1 && s.length <= 280
export const validColor = (c: string): c is SocialColor => (PALETTE as string[]).includes(c)

export function matchLabel(m: MatchLite): string {
  const h = (m.home_code ?? m.home_label ?? '?').toUpperCase()
  const a = (m.away_code ?? m.away_label ?? '?').toUpperCase()
  return `${h}–${a}`
}

export function toView(
  row: SocialPostRow,
  players: Record<string, PlayerLite>,
  matches: Record<string, MatchLite>,
): PostView {
  const a = players[row.author_id]
  const m = row.match_id ? matches[row.match_id] : null
  return {
    ...row,
    author_name: a?.name ?? 'Someone',
    author_flag: a?.flag_code ?? null,
    match_label: m ? matchLabel(m) : null,
  }
}

export function upsertPost(list: SocialPostRow[], row: SocialPostRow): SocialPostRow[] {
  const next = list.filter(p => p.id !== row.id)
  next.push(row)
  next.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return next
}
export const removePost = (list: SocialPostRow[], id: string): SocialPostRow[] =>
  list.filter(p => p.id !== id)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/social.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/social.ts src/lib/social.test.ts
git commit -m "feat(social): pure helpers and types for the wall"
```

---

## Task 3: Data hook (`useSocialPosts`)

**Files:**
- Create: `src/hooks/useSocialPosts.ts`

This follows the `useMatches` pattern but maintains rows incrementally (the spec wants prepend/patch/remove, not a full reload on every reaction tap). Author names/flags and match labels are resolved from small lookup maps loaded once, because realtime INSERT payloads contain only the raw row (no joins).

- [ ] **Step 1: Implement the hook**

```typescript
// src/hooks/useSocialPosts.ts
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  upsertPost, removePost, bump, toView,
  type SocialPostRow, type PlayerLite, type MatchLite, type PostView,
  type Reaction, type SocialColor,
} from '../lib/social'

export function useSocialPosts() {
  const { player } = useAuth()
  const [rows, setRows] = useState<SocialPostRow[]>([])
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({})
  const [matches, setMatches] = useState<Record<string, MatchLite>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [p, m, posts] = await Promise.all([
        supabase.from('players').select('id, name, flag_code'),
        supabase.from('matches').select('id, home_code, away_code, home_label, away_label'),
        supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      if (!active) return
      const pmap: Record<string, PlayerLite> = {}
      for (const r of p.data ?? []) pmap[r.id] = { name: r.name, flag_code: r.flag_code }
      const mmap: Record<string, MatchLite> = {}
      for (const r of m.data ?? []) mmap[r.id] = r as MatchLite
      setPlayers(pmap)
      setMatches(mmap)
      setRows((posts.data ?? []) as SocialPostRow[])
      setLoading(false)
    }
    load()

    const ch = supabase.channel('social_posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_posts' },
        (payload) => setRows(prev => upsertPost(prev, payload.new as SocialPostRow)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'social_posts' },
        (payload) => setRows(prev => upsertPost(prev, payload.new as SocialPostRow)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'social_posts' },
        (payload) => setRows(prev => removePost(prev, (payload.old as { id: string }).id)))
      .subscribe()

    return () => { active = false; supabase.removeChannel(ch) }
  }, [])

  const views: PostView[] = useMemo(
    () => rows.map(r => toView(r, players, matches)),
    [rows, players, matches],
  )

  async function post(body: string, color: SocialColor, matchId: string | null) {
    if (!player) return
    await supabase.from('social_posts').insert({
      author_id: player.id, body, color, match_id: matchId,
    })
    // INSERT echo via realtime adds the card.
  }

  async function react(postId: string, key: Reaction) {
    setRows(prev => prev.map(r => (r.id === postId ? bump(r, key) : r))) // optimistic
    await supabase.rpc('react_to_post', { p_id: postId, kind: key })
    // UPDATE echo reconciles the true count.
  }

  async function remove(postId: string) {
    setRows(prev => removePost(prev, postId)) // optimistic
    await supabase.from('social_posts').delete().eq('id', postId)
  }

  const matchList: MatchLite[] = useMemo(() => Object.values(matches), [matches])

  return {
    hero: views[0] ?? null,
    feed: views.slice(1),
    loading,
    me: player?.id ?? null,
    isAdmin: player?.is_admin ?? false,
    matchList,
    post, react, remove,
  }
}
```

- [ ] **Step 2: Type-check the hook**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `useSocialPosts.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSocialPosts.ts
git commit -m "feat(social): useSocialPosts hook with realtime + actions"
```

---

## Task 4: `ReactionBar` component

**Files:**
- Create: `src/components/ReactionBar.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/ReactionBar.tsx
import { motion } from 'framer-motion'
import { REACTIONS, hottest, colorClass, type Reaction, type SocialPostRow, type SocialColor } from '../lib/social'

// Rectangle reaction buttons, tinted the card's own color. The most-tapped
// ("hot") reaction fills solid ink. `size` switches hero vs compact feed card.
export function ReactionBar({ row, color, size, onReact }: {
  row: SocialPostRow
  color: SocialColor
  size: 'hero' | 'card'
  onReact: (key: Reaction) => void
}) {
  const hot = hottest(row)
  const tint = colorClass(color).split(' ')[0] // e.g. 'bg-orange' (drop any text-paper)
  const hero = size === 'hero'
  return (
    <div className={`flex ${hero ? 'gap-1.5' : 'gap-1'} ${hero ? 'mt-3' : 'mt-2'}`}>
      {REACTIONS.map(r => {
        const isHot = hot === r.key
        return (
          <motion.button
            key={r.key}
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={() => onReact(r.key)}
            aria-label={r.key}
            className={`flex-1 flex items-center justify-center gap-1 border-[3px] border-ink
              ${hero ? 'py-2 text-[18px]' : 'py-1 text-[15px]'} font-display
              ${isHot ? 'bg-ink text-paper' : `${tint} text-ink`}`}
          >
            <span>{r.emoji}</span>
            <span className={hero ? 'text-[13px]' : 'text-[11px]'}>{row[r.column]}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `ReactionBar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ReactionBar.tsx
git commit -m "feat(social): ReactionBar with tinted buttons + hot highlight"
```

---

## Task 5: `SocialCard` (compact feed card)

**Files:**
- Create: `src/components/SocialCard.tsx`
- Test: `src/components/SocialCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SocialCard.test.tsx
import { render, screen } from '@testing-library/react'
import { SocialCard } from './SocialCard'
import type { PostView } from '../lib/social'

const view: PostView = {
  id: 'a', author_id: 'u1', body: 'my bracket is dead', color: 'yellow', match_id: null,
  heart_count: 18, up_count: 6, down_count: 0, sandal_count: 3, dead_count: 0,
  created_at: new Date(Date.now() - 31 * 60_000).toISOString(),
  author_name: 'Sofia', author_flag: 'pt', match_label: null,
}

test('renders author, body, and a reaction count', () => {
  render(<SocialCard view={view} canDelete={false} onReact={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('Sofia')).toBeInTheDocument()
  expect(screen.getByText('my bracket is dead')).toBeInTheDocument()
  expect(screen.getByText('18')).toBeInTheDocument()
})

test('shows delete control only when canDelete', () => {
  const { rerender } = render(<SocialCard view={view} canDelete={false} onReact={() => {}} onDelete={() => {}} />)
  expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  rerender(<SocialCard view={view} canDelete onReact={() => {}} onDelete={() => {}} />)
  expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/SocialCard.test.tsx`
Expected: FAIL — cannot find module `./SocialCard`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/SocialCard.tsx
import { X } from 'lucide-react'
import { Flag } from './Flag'
import { ReactionBar } from './ReactionBar'
import { colorClass, isLight, relativeTime, type PostView, type Reaction } from '../lib/social'

export function SocialCard({ view, canDelete, onReact, onDelete }: {
  view: PostView
  canDelete: boolean
  onReact: (key: Reaction) => void
  onDelete: () => void
}) {
  const light = isLight(view.color)
  return (
    <div className={`${colorClass(view.color)} border-[3px] border-ink rounded-[14px] p-3 shadow-[3px_3px_0_#141210]`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Flag code={view.author_flag} label={view.author_name} size="sm" />
        <span className="font-display uppercase text-[14px] tracking-wide">{view.author_name}</span>
        {view.match_label && (
          <span className="border-2 border-ink rounded-full px-2 py-0.5 text-[10px] font-900 uppercase bg-paper text-ink">
            ⚽ {view.match_label}
          </span>
        )}
        <span className={`ml-auto text-[11px] font-900 ${light ? 'opacity-80' : 'opacity-60'}`}>
          {relativeTime(view.created_at)}
        </span>
        {canDelete && (
          <button type="button" aria-label="delete" onClick={onDelete} className="ml-1">
            <X size={14} />
          </button>
        )}
      </div>
      <p className="text-[13.5px] font-800 leading-snug">{view.body}</p>
      <ReactionBar row={view} color={view.color} size="card" onReact={onReact} />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/SocialCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SocialCard.tsx src/components/SocialCard.test.tsx
git commit -m "feat(social): compact SocialCard"
```

---

## Task 6: `SocialHero` (big card + reaction burst)

**Files:**
- Create: `src/components/SocialHero.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/SocialHero.tsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Flag } from './Flag'
import { ReactionBar } from './ReactionBar'
import { REACTIONS, colorClass, isLight, relativeTime, type PostView, type Reaction } from '../lib/social'

interface Burst { id: number; emoji: string; x: number }

export function SocialHero({ view, canDelete, onReact, onDelete }: {
  view: PostView | null
  canDelete: boolean
  onReact: (key: Reaction) => void
  onDelete: () => void
}) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const [seq, setSeq] = useState(0)

  if (!view) {
    return (
      <div className="border-[3px] border-dashed border-ink rounded-[24px] p-8 text-center">
        <p className="font-display uppercase text-[18px]">Be the first to post</p>
        <p className="text-[13px] opacity-60 mt-1">Start the trash talk below ⚽</p>
      </div>
    )
  }

  const light = isLight(view.color)

  function handleReact(key: Reaction) {
    const emoji = REACTIONS.find(r => r.key === key)!.emoji
    const id = seq
    setSeq(s => s + 1)
    // x in [-50, 50]px around center; index-derived so it varies without Math.random.
    setBursts(b => [...b, { id, emoji, x: ((id % 7) - 3) * 18 }])
    setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 900)
    onReact(key)
  }

  return (
    <div className="relative">
      {/* floating reaction burst */}
      <AnimatePresence>
        {bursts.map(b => (
          <motion.span
            key={b.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -120, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute left-1/2 bottom-16 text-[30px] z-10 pointer-events-none"
            style={{ marginLeft: b.x }}
          >
            {b.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      <div className={`${colorClass(view.color)} border-[4px] border-ink rounded-[26px] p-5 shadow-[6px_6px_0_#141210]`}>
        <div className="flex items-center gap-2.5">
          <Flag code={view.author_flag} label={view.author_name} size="md" />
          <span className="font-display uppercase text-[18px] tracking-wide">{view.author_name}</span>
          {view.match_label && (
            <span className="border-2 border-ink rounded-full px-2.5 py-0.5 text-[10px] font-900 uppercase bg-paper text-ink">
              ⚽ {view.match_label}
            </span>
          )}
          <span className={`ml-auto text-[12px] font-900 ${light ? 'opacity-80' : 'opacity-70'}`}>
            {relativeTime(view.created_at)}
          </span>
          {canDelete && (
            <button type="button" aria-label="delete" onClick={onDelete}><X size={16} /></button>
          )}
        </div>
        <p className="text-[23px] font-900 leading-[1.2] tracking-[-0.4px] my-4">{view.body}</p>
        <ReactionBar row={view} color={view.color} size="hero" onReact={handleReact} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `SocialHero.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SocialHero.tsx
git commit -m "feat(social): Locket-style SocialHero with reaction burst"
```

---

## Task 7: `SocialComposer`

**Files:**
- Create: `src/components/SocialComposer.tsx`
- Test: `src/components/SocialComposer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SocialComposer.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SocialComposer } from './SocialComposer'

test('Post is disabled until valid text is entered, then fires onPost', async () => {
  const onPost = vi.fn()
  render(<SocialComposer matchList={[]} onPost={onPost} />)
  const post = screen.getByRole('button', { name: /post/i })
  expect(post).toBeDisabled()
  await userEvent.type(screen.getByRole('textbox'), 'Brazil are cooking 🔥')
  expect(post).toBeEnabled()
  await userEvent.click(post)
  expect(onPost).toHaveBeenCalledTimes(1)
  expect(onPost.mock.calls[0][0]).toBe('Brazil are cooking 🔥')
})

test('shows remaining character count', async () => {
  render(<SocialComposer matchList={[]} onPost={() => {}} />)
  await userEvent.type(screen.getByRole('textbox'), 'hello')
  expect(screen.getByText('275')).toBeInTheDocument() // 280 - 5
})
```

Note: `vi` is global (see `src/test/setup.ts` / vitest config). If not, add `import { vi } from 'vitest'`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/SocialComposer.test.tsx`
Expected: FAIL — cannot find module `./SocialComposer`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/SocialComposer.tsx
import { useState } from 'react'
import { PALETTE, colorClass, validBody, type SocialColor, type MatchLite } from '../lib/social'

const MAX = 280

export function SocialComposer({ matchList, onPost }: {
  matchList: MatchLite[]
  onPost: (body: string, color: SocialColor, matchId: string | null) => void
}) {
  const [body, setBody] = useState('')
  // Default color derived from text length so it varies without Math.random.
  const [color, setColor] = useState<SocialColor>('orange')
  const [matchId, setMatchId] = useState<string>('')
  const [pickMatch, setPickMatch] = useState(false)

  const can = validBody(body)
  function submit() {
    if (!can) return
    onPost(body.trim(), color, matchId || null)
    setBody(''); setMatchId(''); setPickMatch(false)
  }

  return (
    <div className="border-[3px] border-ink bg-white rounded-[20px] p-3 shadow-[3px_3px_0_#141210] mb-4">
      <textarea
        value={body}
        maxLength={MAX}
        onChange={e => setBody(e.target.value)}
        rows={2}
        placeholder="Share something with the group…"
        className="w-full resize-none bg-transparent outline-none font-800 text-[14px]"
      />

      {/* color swatches */}
      <div className="flex gap-1.5 mt-1">
        {PALETTE.map(c => (
          <button
            key={c}
            type="button"
            aria-label={`color ${c}`}
            onClick={() => setColor(c)}
            className={`w-6 h-6 border-2 border-ink ${colorClass(c).split(' ')[0]} ${color === c ? 'ring-2 ring-ink ring-offset-1' : ''}`}
          />
        ))}
      </div>

      {pickMatch && matchList.length > 0 && (
        <select
          value={matchId}
          onChange={e => setMatchId(e.target.value)}
          className="mt-2 w-full border-2 border-ink bg-paper text-[12px] font-800 p-1"
        >
          <option value="">No match</option>
          {matchList.map(m => (
            <option key={m.id} value={m.id}>
              {(m.home_code ?? m.home_label ?? '?').toUpperCase()}–{(m.away_code ?? m.away_label ?? '?').toUpperCase()}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={() => setPickMatch(v => !v)}
          className="text-[11px] font-900 uppercase border-2 border-ink px-2 py-0.5 bg-paper"
        >
          ＋ Tag match
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] opacity-60">{MAX - body.length}</span>
          <button
            type="button"
            disabled={!can}
            onClick={submit}
            className="font-display uppercase bg-yellow border-[3px] border-ink rounded-[18px] px-4 py-1.5 text-[14px] disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/SocialComposer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SocialComposer.tsx src/components/SocialComposer.test.tsx
git commit -m "feat(social): SocialComposer with counter, swatches, match tag"
```

---

## Task 8: `Social` screen

**Files:**
- Create: `src/screens/Social.tsx`

- [ ] **Step 1: Implement the screen**

```tsx
// src/screens/Social.tsx
import { SocialComposer } from '../components/SocialComposer'
import { SocialHero } from '../components/SocialHero'
import { SocialCard } from '../components/SocialCard'
import { useSocialPosts } from '../hooks/useSocialPosts'

export function Social() {
  const { hero, feed, loading, me, isAdmin, matchList, post, react, remove } = useSocialPosts()
  const canDelete = (authorId: string) => authorId === me || isAdmin

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display uppercase text-[26px] tracking-wide text-center">The Wall</h1>

      <SocialComposer matchList={matchList} onPost={post} />

      {loading ? (
        <p className="text-center opacity-60 text-[13px] py-8">Loading the wall…</p>
      ) : (
        <>
          <SocialHero
            view={hero}
            canDelete={!!hero && canDelete(hero.author_id)}
            onReact={k => hero && react(hero.id, k)}
            onDelete={() => hero && remove(hero.id)}
          />

          {feed.length > 0 && (
            <div className="text-center text-[11px] font-900 uppercase tracking-widest opacity-45 my-2">
              — earlier —
            </div>
          )}

          <div className="flex flex-col gap-2">
            {feed.map(v => (
              <SocialCard
                key={v.id}
                view={v}
                canDelete={canDelete(v.author_id)}
                onReact={k => react(v.id, k)}
                onDelete={() => remove(v.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `Social.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Social.tsx
git commit -m "feat(social): Social screen composing composer + hero + feed"
```

---

## Task 9: Routing + bottom nav tab

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/BottomNav.tsx`
- Test: `src/components/BottomNav.test.tsx` (create)

- [ ] **Step 1: Add the route in `App.tsx`**

Add the import alongside the other screen imports (after the `Matches` import line):
```tsx
import { Social } from './screens/Social'
```

Add the route after the `/matches` route line:
```tsx
        <Route path="/social" element={<Protected><Shell><Social /></Shell></Protected>} />
```

- [ ] **Step 2: Add the Social tab in `BottomNav.tsx`**

Update the icon import line to include `MessageCircle`:
```tsx
import { Trophy, User, Circle, Shield, MessageCircle } from 'lucide-react'
```

Insert this `NavLink` immediately after the closing `</NavLink>` of the Matches tab (before the Ranking tab):
```tsx
      <NavLink to="/social" className={itemClass('border-r-[3px] border-ink')}>
        {({ isActive }) => <>
          {isActive && <Active />}
          <motion.span animate={{ scale: isActive ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <MessageCircle size={18} className={isActive ? 'text-paper' : 'text-ink'} />
          </motion.span>
          Social
        </>}
      </NavLink>
```

- [ ] **Step 3: Write the failing nav test**

```tsx
// src/components/BottomNav.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

// useAuth is consumed by BottomNav; stub a non-admin player.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ player: { id: 'u1', is_admin: false }, session: null, loading: false }),
}))

test('renders a Social tab linking to /social', () => {
  render(<MemoryRouter><BottomNav /></MemoryRouter>)
  const link = screen.getByRole('link', { name: /social/i })
  expect(link).toHaveAttribute('href', '/social')
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/BottomNav.test.tsx`
Expected: PASS (route + tab now exist).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/BottomNav.tsx src/components/BottomNav.test.tsx
git commit -m "feat(social): add Social route and bottom-nav tab"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the new `social.test.ts`, `SocialCard`, `SocialComposer`, `BottomNav`.

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors in `src/lib/social.ts`, `src/hooks/useSocialPosts.ts`, `src/components/Social*.tsx`, `src/components/ReactionBar.tsx`.

- [ ] **Step 4: Manual smoke test (needs `.env.local` with cloud Supabase creds; Vite on :5175 — see memory `local-dev-env-setup`)**

Run: `npm run dev`
Then in the browser:
1. Sign in, tap the **Social** tab.
2. Post text with a color + optional match tag → it appears as the hero instantly.
3. Tap reactions → counts increment and emoji burst over the hero.
4. Open a second browser/session, post → first session's wall updates live (realtime).
5. Delete your own post → it disappears; confirm a non-author cannot see a delete control on others' posts.

Expected: all behaviors work; no console errors.

- [ ] **Step 5: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "chore(social): verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** table/RPC/RLS/realtime → Task 1; helpers/validation → Task 2; live data + actions → Task 3; reaction buttons (tinted, hot=ink) → Task 4; compact card → Task 5; Locket hero + burst → Task 6; composer (280 counter, swatches, optional match tag) → Task 7; hybrid layout + empty state → Task 8; tab + route → Task 9; tests/build/manual → Task 10. All spec sections mapped.
- **Reaction model:** counter columns + `react_to_post` RPC + optimistic `bump` — matches the "unlimited tap" decision; no per-user state.
- **Type consistency:** `SocialPostRow`, `PostView`, `Reaction`, `SocialColor`, `MatchLite`, `PlayerLite` defined once in `social.ts` and imported everywhere; `react(postId, key)` / `post(body, color, matchId)` / `remove(id)` signatures consistent across hook, screen, and components.
- **Non-goals honored:** no replies, edits, notifications, or "who reacted".
