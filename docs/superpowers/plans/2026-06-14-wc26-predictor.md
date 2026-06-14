# WC26 Predictor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a friends-pool web app to predict every FIFA World Cup 2026 match scoreline, lock predictions at kickoff, auto-score against admin-entered results, and rank players on a live leaderboard — with existing point totals migrated in.

**Architecture:** React + Vite + TypeScript single-page app (mobile-first, dark neumorphism) talking directly to Supabase (Postgres + Auth + Row Level Security + Realtime). All game rules — prediction locking, score visibility, point calculation — are enforced in the database, not just the UI. Hosted as a static build on GitHub Pages via GitHub Actions.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, Geist font, flag-icons, lucide-react, @supabase/supabase-js, Vitest + @testing-library/react, Supabase CLI (local Postgres for SQL tests).

---

## Conventions

- **Package manager:** `npm`.
- **Node:** v24 (installed at `~/.local/node`).
- **Test runner:** `vitest` (`npm test`). SQL/logic tests run against a local Supabase Postgres via `supabase start`.
- **Commits:** conventional commits (`feat:`, `test:`, `chore:`, `fix:`), end with the Co-Authored-By trailer used in this repo.
- **TDD:** write the failing test first for every logic unit. UI tasks render-and-assert with Testing Library.
- **Env vars (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (in `.env.local`, never committed).

## File Structure

```
.github/workflows/deploy.yml         # CI: build + deploy to Pages
supabase/
  migrations/
    0001_schema.sql                  # tables
    0002_rls.sql                     # row level security policies
    0003_score_function.sql          # score_match() + leaderboard view
  seed.sql                           # teams + group fixtures + default settings
  tests/
    score_match.test.sql             # pgTAP-style assertions for scoring
src/
  main.tsx                           # app entry
  App.tsx                            # router + providers
  index.css                          # Tailwind + Geist + neumorphism tokens
  lib/
    supabase.ts                      # supabase client singleton
    types.ts                         # DB row types
    scoring.ts                       # pure base-points calc (client mirror, for tests/UI)
    auth.ts                          # slug + synthetic-email helpers, signUp/login
    matchState.ts                    # pure: open|locked|finished from a match row
  context/
    AuthContext.tsx                  # session + current player
  hooks/
    useMatches.ts                    # fetch matches
    usePredictions.ts               # fetch + upsert own predictions
    useLeaderboard.ts                # fetch leaderboard view (+ realtime)
  components/
    Neu.tsx                          # neumorphic primitives (Surface, Inset, Button)
    Flag.tsx                         # rectangular flag
    BottomNav.tsx
    MatchCard.tsx                    # open/locked/finished
    LeaderRow.tsx
    Protected.tsx                    # route guard
  screens/
    Login.tsx
    Matches.tsx
    Ranking.tsx
    Me.tsx
    admin/
      AdminResults.tsx
      AdminFixtures.tsx
      AdminPlayers.tsx
      AdminSettings.tsx
  test/
    setup.ts                         # vitest + testing-library setup
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `postcss.config.js`, `tailwind.config.ts`

- [ ] **Step 1: Scaffold Vite React-TS project**

Run (in repo root, which already contains `.git`, `.gitignore`, `docs/`):
```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm create vite@latest . -- --template react-ts
npm install
```
If prompted about a non-empty directory, choose "Ignore files and continue".

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install @supabase/supabase-js react-router-dom lucide-react flag-icons
npm install -D tailwindcss@3 postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Replace `tailwind.config.ts` (rename from `.js` if needed):
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#23272f',
        shadowDark: '#15181d',
        shadowLight: '#2f343d',
        accent: '#2F9BFF',
        accent2: '#57b0ff',
        txt: '#d7dce4',
        muted: '#838a96',
        bright: '#f0f2f6',
        bg: '#121317',
      },
      fontFamily: { sans: ['Geist', 'system-ui', 'sans-serif'] },
      boxShadow: {
        neu: '7px 7px 15px #15181d, -7px -7px 15px #2f343d',
        'neu-sm': '5px 5px 10px #15181d, -5px -5px 10px #2f343d',
        'neu-inset': 'inset 4px 4px 8px #15181d, inset -4px -4px 8px #2f343d',
        'neu-lg': '14px 14px 30px #090a0d, -10px -10px 26px #232830',
      },
      borderRadius: { neu: '20px', 'neu-lg': '36px' },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: Write global CSS with Geist + tokens**

Replace `src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap');
@import 'flag-icons/css/flag-icons.min.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-bg text-txt font-sans antialiased; }
```

- [ ] **Step 5: Configure Vitest**

Edit `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

Add scripts to `package.json` (`"scripts"`):
```json
"dev": "vite",
"build": "tsc -b && vite build",
"preview": "vite preview",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Minimal App that renders**

Replace `src/App.tsx`:
```tsx
export default function App() {
  return <div className="p-6 text-bright">WC26 Predictor</div>
}
```
Ensure `src/main.tsx` imports `./index.css` and renders `<App />`.

- [ ] **Step 7: Smoke test**

Create `src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders app title', () => {
  render(<App />)
  expect(screen.getByText('WC26 Predictor')).toBeInTheDocument()
})
```

- [ ] **Step 8: Run tests + build**

Run: `npm test` → Expected: 1 passed.
Run: `npm run build` → Expected: build succeeds, `dist/` produced.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite React TS app with Tailwind + neumorphism tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: GitHub repo + Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the deploy workflow**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - run: cp dist/index.html dist/404.html   # SPA fallback for client routing
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create the GitHub repo and push** (manual, by the user)

Document in commit message; the user runs:
```bash
gh repo create wc26-predictor --private --source=. --remote=origin --push
```
Then in GitHub: Settings → Pages → Source = "GitHub Actions"; Settings → Secrets and variables → Actions → add variable `VITE_SUPABASE_URL` and secret `VITE_SUPABASE_ANON_KEY` (filled in after Task 3).

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Pages deploy workflow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Supabase project + schema migration

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

- [ ] **Step 1: Init Supabase locally**

```bash
npx supabase init
npx supabase start   # boots local Postgres + Studio (Docker required)
```
Note the local `API URL` and `anon key` printed; put them in `.env.local`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key>
```

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/0001_schema.sql`:
```sql
create table teams (
  code text primary key,
  name text not null
);

create table players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null unique,
  slug text not null unique,
  flag_code text references teams(code),
  is_admin boolean not null default false,
  legacy_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  match_no integer,
  stage text not null check (stage in ('group','r32','r16','qf','sf','third','final')),
  group_label text,
  home_code text references teams(code),
  away_code text references teams(code),
  home_label text,
  away_label text,
  kickoff_at timestamptz not null,
  home_score integer,
  away_score integer,
  multiplier numeric not null default 1,
  status text not null default 'scheduled' check (status in ('scheduled','finished')),
  created_at timestamptz not null default now()
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  home_pred integer not null check (home_pred >= 0),
  away_pred integer not null check (away_pred >= 0),
  points_awarded integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, match_id)
);

create table settings (
  key text primary key,
  value numeric not null
);

create index predictions_match_idx on predictions(match_id);
create index matches_kickoff_idx on matches(kickoff_at);
```

- [ ] **Step 3: Create the auto-profile trigger**

Append to `0001_schema.sql`:
```sql
-- create a players row automatically when an auth user is created,
-- reading name/slug from the signup metadata
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, name, slug)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', new.email),
          coalesce(new.raw_user_meta_data->>'slug', new.id::text));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 4: Apply migration**

Run: `npx supabase migration up`
Expected: tables created (verify in Studio at the printed URL, or `npx supabase db reset` to apply all + seed).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Row Level Security policies

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Write RLS policies**

Create `supabase/migrations/0002_rls.sql`:
```sql
alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table settings enable row level security;

-- helper: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from players where id = auth.uid()), false);
$$;

-- teams: read by anyone authenticated; write admin only
create policy teams_read on teams for select to authenticated using (true);
create policy teams_admin_write on teams for all to authenticated
  using (is_admin()) with check (is_admin());

-- players: everyone reads (leaderboard); update own row only, but not is_admin/legacy_points
create policy players_read on players for select to authenticated using (true);
create policy players_update_self on players for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from players where id = auth.uid())
    and legacy_points = (select legacy_points from players where id = auth.uid())
  );
create policy players_admin_write on players for all to authenticated
  using (is_admin()) with check (is_admin());

-- matches: everyone reads; admin writes
create policy matches_read on matches for select to authenticated using (true);
create policy matches_admin_write on matches for all to authenticated
  using (is_admin()) with check (is_admin());

-- predictions:
-- read own always; read others only when that match is locked or finished
create policy predictions_read on predictions for select to authenticated using (
  player_id = auth.uid()
  or exists (
    select 1 from matches m where m.id = match_id
    and (m.status = 'finished' or m.kickoff_at <= now())
  )
);
-- insert/update own prediction only while match is open
create policy predictions_insert_self on predictions for insert to authenticated
  with check (
    player_id = auth.uid()
    and points_awarded is null
    and exists (select 1 from matches m where m.id = match_id
                and m.status = 'scheduled' and m.kickoff_at > now())
  );
create policy predictions_update_self on predictions for update to authenticated
  using (player_id = auth.uid())
  with check (
    player_id = auth.uid()
    and points_awarded is null
    and exists (select 1 from matches m where m.id = match_id
                and m.status = 'scheduled' and m.kickoff_at > now())
  );

-- settings: read all; admin writes
create policy settings_read on settings for select to authenticated using (true);
create policy settings_admin_write on settings for all to authenticated
  using (is_admin()) with check (is_admin());
```

- [ ] **Step 2: Apply + sanity check**

Run: `npx supabase db reset`
Expected: all migrations apply with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat: add row level security policies (locking + pick privacy)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Seed data (teams, fixtures, settings)

**Files:**
- Create: `supabase/seed.sql`, `scripts/build-seed.mjs`

- [ ] **Step 1: Fetch open fixture data and generate seed**

Create `scripts/build-seed.mjs` (run once to produce `supabase/seed.sql`):
```js
// Downloads openfootball worldcup 2026 data and emits SQL inserts.
import { writeFileSync } from 'node:fs'
const BASE = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026'
const res = await fetch(`${BASE}/worldcup.json`)
const data = await res.json()
const teams = new Map()   // code -> name
const matches = []
for (const round of data.rounds ?? []) {
  for (const m of round.matches ?? []) {
    const hc = (m.team1?.code || m.team1?.name || '').toLowerCase().slice(0,2)
    const ac = (m.team2?.code || m.team2?.name || '').toLowerCase().slice(0,2)
    if (m.team1?.name) teams.set(hc, m.team1.name)
    if (m.team2?.name) teams.set(ac, m.team2.name)
    matches.push({
      num: m.num, group: m.group ?? null, hc, ac,
      home: m.team1?.name ?? null, away: m.team2?.name ?? null,
      date: `${m.date}T${m.time ?? '18:00'}:00Z`,
    })
  }
}
const esc = s => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`
let sql = '-- generated by scripts/build-seed.mjs\n'
sql += '-- default scoring settings\n'
sql += `insert into settings(key,value) values
 ('points_exact',30),('points_diff',15),('points_outcome',10),
 ('mult_group',1),('mult_r32',1.5),('mult_r16',2),('mult_qf',3),('mult_sf',4),('mult_third',6),('mult_final',6)
 on conflict (key) do nothing;\n\n`
for (const [code, name] of teams)
  sql += `insert into teams(code,name) values (${esc(code)},${esc(name)}) on conflict do nothing;\n`
sql += '\n'
for (const m of matches)
  sql += `insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,multiplier) values (${m.num ?? 'null'},'group',${esc(m.group)},${esc(m.hc)},${esc(m.ac)},${esc(m.home)},${esc(m.away)},${esc(m.date)},1);\n`
writeFileSync('supabase/seed.sql', sql)
console.log(`Wrote ${teams.size} teams, ${matches.length} matches`)
```

Run: `export PATH="$HOME/.local/node/bin:$PATH" && node scripts/build-seed.mjs`
Expected: prints team + match counts; `supabase/seed.sql` created.

> NOTE: if openfootball's 2026 structure differs or lags, hand-edit `supabase/seed.sql`. The admin Fixtures screen (Task 17) can also correct any fixture later. Knockout fixtures are added later via the admin UI; only group matches are seeded here.

- [ ] **Step 2: Load seed locally**

Run: `npx supabase db reset` (applies migrations + `seed.sql`).
Expected: no errors; `select count(*) from matches;` in Studio shows ~72 group matches.

- [ ] **Step 3: Commit**

```bash
git add scripts/build-seed.mjs supabase/seed.sql
git commit -m "feat: seed teams, group fixtures, and default scoring settings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Scoring logic (pure function, TDD) + DB function

**Files:**
- Create: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`, `supabase/migrations/0003_score_function.sql`, `supabase/tests/score_match.test.sql`

- [ ] **Step 1: Write failing tests for base points**

Create `src/lib/scoring.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { basePoints } from './scoring'

const P = { exact: 30, diff: 15, outcome: 10 }

describe('basePoints', () => {
  test('exact score', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 2, as: 1 }, P)).toBe(30)
  })
  test('correct goal difference, not exact', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 3, as: 2 }, P)).toBe(15)
  })
  test('correct non-exact draw counts as goal difference', () => {
    expect(basePoints({ hp: 1, ap: 1 }, { hs: 2, as: 2 }, P)).toBe(15)
  })
  test('correct outcome only', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 1, as: 0 }, P)).toBe(10)
  })
  test('wrong', () => {
    expect(basePoints({ hp: 2, ap: 1 }, { hs: 0, as: 3 }, P)).toBe(0)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- scoring`
Expected: FAIL ("basePoints is not a function").

- [ ] **Step 3: Implement the pure function**

Create `src/lib/scoring.ts`:
```ts
export type Points = { exact: number; diff: number; outcome: number }
type Pred = { hp: number; ap: number }
type Result = { hs: number; as: number }

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

export function basePoints(p: Pred, r: Result, pts: Points): number {
  if (p.hp === r.hs && p.ap === r.as) return pts.exact
  if (p.hp - p.ap === r.hs - r.as) return pts.diff
  if (sign(p.hp - p.ap) === sign(r.hs - r.as)) return pts.outcome
  return 0
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- scoring`
Expected: 5 passed.

- [ ] **Step 5: Write the DB scoring function (server source of truth)**

Create `supabase/migrations/0003_score_function.sql`:
```sql
-- recompute points for every prediction on a finished match, idempotently.
create or replace function score_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  px numeric; pd numeric; po numeric; mult numeric;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;
  select value into px from settings where key='points_exact';
  select value into pd from settings where key='points_diff';
  select value into po from settings where key='points_outcome';
  mult := m.multiplier;

  update predictions p set
    points_awarded = mult * (
      case
        when p.home_pred = m.home_score and p.away_pred = m.away_score then px
        when p.home_pred - p.away_pred = m.home_score - m.away_score then pd
        when sign(p.home_pred - p.away_pred) = sign(m.home_score - m.away_score) then po
        else 0
      end),
    updated_at = now()
  where p.match_id = p_match;

  update matches set status='finished' where id = p_match;
end; $$;

-- leaderboard view: legacy + earned, with hit counts
create or replace view leaderboard as
select
  pl.id, pl.name, pl.flag_code,
  pl.legacy_points + coalesce(sum(pr.points_awarded),0)::int as total,
  count(*) filter (where pr.points_awarded = pr.points_awarded
    and pr.home_pred = m.home_score and pr.away_pred = m.away_score) as exact_hits,
  count(*) filter (where m.status='finished'
    and not (pr.home_pred = m.home_score and pr.away_pred = m.away_score)
    and pr.home_pred - pr.away_pred = m.home_score - m.away_score) as diff_hits
from players pl
left join predictions pr on pr.player_id = pl.id
left join matches m on m.id = pr.match_id and m.status='finished'
group by pl.id, pl.name, pl.flag_code, pl.legacy_points;

grant select on leaderboard to authenticated;
```

- [ ] **Step 6: Write a SQL test for score_match**

Create `supabase/tests/score_match.test.sql` (run via `psql` against the local DB):
```sql
-- seed a minimal scenario
begin;
insert into teams(code,name) values ('aa','Alpha'),('bb','Beta') on conflict do nothing;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','t@t.local') on conflict do nothing;
-- player row may be auto-created by trigger; upsert defensively
insert into players(id,name,slug,legacy_points) values ('00000000-0000-0000-0000-000000000001','Tester','tester',100)
  on conflict (id) do update set legacy_points=100;
insert into matches(id,stage,home_code,away_code,kickoff_at,home_score,away_score,multiplier)
  values ('00000000-0000-0000-0000-0000000000aa','group','aa','bb', now() - interval '1 hour', 2, 1, 1);
insert into predictions(player_id,match_id,home_pred,away_pred)
  values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa',2,1);

select score_match('00000000-0000-0000-0000-0000000000aa');

do $$
declare pts int; tot int;
begin
  select points_awarded into pts from predictions where match_id='00000000-0000-0000-0000-0000000000aa';
  if pts <> 30 then raise exception 'expected 30 got %', pts; end if;
  select total into tot from leaderboard where id='00000000-0000-0000-0000-000000000001';
  if tot <> 130 then raise exception 'expected total 130 got %', tot; end if;
  raise notice 'score_match OK: pts=% total=%', pts, tot;
end $$;
rollback;
```

- [ ] **Step 7: Apply migration + run SQL test**

```bash
npx supabase db reset
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -f supabase/tests/score_match.test.sql
```
Expected: `NOTICE: score_match OK: pts=30 total=130`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts supabase/migrations/0003_score_function.sql supabase/tests/score_match.test.sql
git commit -m "feat: scoring logic (client pure fn + DB score_match + leaderboard view)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Supabase client + DB types

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/types.ts`

- [ ] **Step 1: Create the client singleton**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wc26-auth' },
})
```

- [ ] **Step 2: Create row types**

Create `src/lib/types.ts`:
```ts
export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export interface Team { code: string; name: string }
export interface Player {
  id: string; name: string; slug: string; flag_code: string | null
  is_admin: boolean; legacy_points: number
}
export interface Match {
  id: string; match_no: number | null; stage: Stage; group_label: string | null
  home_code: string | null; away_code: string | null
  home_label: string | null; away_label: string | null
  kickoff_at: string; home_score: number | null; away_score: number | null
  multiplier: number; status: 'scheduled' | 'finished'
}
export interface Prediction {
  id: string; player_id: string; match_id: string
  home_pred: number; away_pred: number; points_awarded: number | null
}
export interface LeaderRow {
  id: string; name: string; flag_code: string | null
  total: number; exact_hits: number; diff_hits: number
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts src/lib/types.ts
git commit -m "feat: supabase client and DB types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Auth helpers (TDD)

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth.test.ts`

- [ ] **Step 1: Write failing tests for slug + email derivation**

Create `src/lib/auth.test.ts`:
```ts
import { expect, test } from 'vitest'
import { nameToSlug, slugToEmail } from './auth'

test('nameToSlug lowercases and hyphenates', () => {
  expect(nameToSlug('Amir Vala')).toBe('amir-vala')
  expect(nameToSlug('  Sara  ')).toBe('sara')
  expect(nameToSlug('José+!!')).toBe('jos')
})
test('slugToEmail builds synthetic email', () => {
  expect(slugToEmail('amir-vala')).toBe('amir-vala@players.wc26.local')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- auth`
Expected: FAIL (functions undefined).

- [ ] **Step 3: Implement helpers**

Create `src/lib/auth.ts`:
```ts
import { supabase } from './supabase'

export function nameToSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
export function slugToEmail(slug: string): string {
  return `${slug}@players.wc26.local`
}

export async function signUp(name: string, pin: string) {
  const slug = nameToSlug(name)
  if (!slug) throw new Error('Please enter your name')
  if (pin.length < 6) throw new Error('PIN must be at least 6 characters')
  const { error } = await supabase.auth.signUp({
    email: slugToEmail(slug), password: pin,
    options: { data: { name: name.trim(), slug } },
  })
  if (error) throw new Error(error.message)
}

export async function login(name: string, pin: string) {
  const slug = nameToSlug(name)
  const { error } = await supabase.auth.signInWithPassword({
    email: slugToEmail(slug), password: pin,
  })
  if (error) throw new Error('Wrong name or PIN')
}

export async function logout() {
  await supabase.auth.signOut()
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- auth`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: name+PIN auth helpers over synthetic email

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Auth context + session

**Files:**
- Create: `src/context/AuthContext.tsx`

- [ ] **Step 1: Implement the provider**

Create `src/context/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Player } from '../lib/types'

interface AuthState { session: Session | null; player: Player | null; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, player: null, loading: true })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setPlayer(null); setLoading(false); return }
    supabase.from('players').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setPlayer(data as Player | null); setLoading(false) })
  }, [session])

  return <Ctx.Provider value={{ session, player, loading }}>{children}</Ctx.Provider>
}
```

- [ ] **Step 2: Wrap the app**

Edit `src/main.tsx` to wrap `<App />` in `<AuthProvider>`.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/context/AuthContext.tsx src/main.tsx
git commit -m "feat: auth context with session + player profile

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Neumorphic primitives + Flag component

**Files:**
- Create: `src/components/Neu.tsx`, `src/components/Flag.tsx`, `src/components/Flag.test.tsx`

- [ ] **Step 1: Write failing test for Flag**

Create `src/components/Flag.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { Flag } from './Flag'

test('renders flag span with country class', () => {
  const { container } = render(<Flag code="br" />)
  expect(container.querySelector('.fi-br')).toBeTruthy()
})
test('falls back to neutral box when code missing', () => {
  const { container } = render(<Flag code={null} label="Winner C" />)
  expect(container.textContent).toContain('Winner C')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- Flag`
Expected: FAIL (no Flag).

- [ ] **Step 3: Implement Flag**

Create `src/components/Flag.tsx`:
```tsx
export function Flag({ code, label, size = 'md' }:
  { code: string | null; label?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-[38px] h-[28px]' : 'w-[50px] h-[36px]'
  if (!code) {
    return <span className={`${dim} rounded-lg shadow-neu-sm bg-surface grid place-items-center text-[9px] text-muted px-1 text-center`}>
      {label?.slice(0, 8) ?? '?'}
    </span>
  }
  return (
    <span className={`${dim} rounded-lg overflow-hidden shadow-neu-sm relative inline-block`}>
      <span className={`fi fi-${code} absolute inset-0 !w-full !h-full bg-cover`} />
    </span>
  )
}
```

- [ ] **Step 4: Implement Neu primitives**

Create `src/components/Neu.tsx`:
```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const Surface = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`bg-surface rounded-neu shadow-neu ${className}`}>{children}</div>

export const Inset = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`bg-surface rounded-xl shadow-neu-inset ${className}`}>{children}</div>

export function Button({ children, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button {...p}
    className={`bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold rounded-xl px-4 py-3 shadow-neu-sm active:shadow-neu-inset disabled:opacity-50 ${className}`}>
    {children}</button>
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- Flag`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/components/Neu.tsx src/components/Flag.tsx src/components/Flag.test.tsx
git commit -m "feat: neumorphic primitives and rectangular Flag component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Match state helper (TDD)

**Files:**
- Create: `src/lib/matchState.ts`, `src/lib/matchState.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/matchState.test.ts`:
```ts
import { expect, test } from 'vitest'
import { matchState } from './matchState'
import type { Match } from './types'

const base: Match = {
  id: '1', match_no: 1, stage: 'group', group_label: 'A',
  home_code: 'br', away_code: 'hr', home_label: null, away_label: null,
  kickoff_at: '', home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
}
const future = new Date(Date.now() + 3.6e6).toISOString()
const past = new Date(Date.now() - 3.6e6).toISOString()

test('open before kickoff', () => {
  expect(matchState({ ...base, kickoff_at: future })).toBe('open')
})
test('locked after kickoff, not finished', () => {
  expect(matchState({ ...base, kickoff_at: past })).toBe('locked')
})
test('finished when status finished', () => {
  expect(matchState({ ...base, kickoff_at: past, status: 'finished', home_score: 1, away_score: 0 })).toBe('finished')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- matchState`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/matchState.ts`:
```ts
import type { Match } from './types'
export type MatchUiState = 'open' | 'locked' | 'finished'

export function matchState(m: Match, now: Date = new Date()): MatchUiState {
  if (m.status === 'finished') return 'finished'
  return new Date(m.kickoff_at) > now ? 'open' : 'locked'
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- matchState`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchState.ts src/lib/matchState.test.ts
git commit -m "feat: match UI state helper (open/locked/finished)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Data hooks (matches, predictions, leaderboard)

**Files:**
- Create: `src/hooks/useMatches.ts`, `src/hooks/usePredictions.ts`, `src/hooks/useLeaderboard.ts`

- [ ] **Step 1: useMatches**

Create `src/hooks/useMatches.ts`:
```ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Match } from '../lib/types'

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  async function load() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_at')
    setMatches((data ?? []) as Match[]); setLoading(false)
  }
  useEffect(() => { load() }, [])
  return { matches, loading, reload: load }
}
```

- [ ] **Step 2: usePredictions (own predictions + upsert)**

Create `src/hooks/usePredictions.ts`:
```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Prediction } from '../lib/types'
import { useAuth } from '../context/AuthContext'

export function usePredictions() {
  const { player } = useAuth()
  const [byMatch, setByMatch] = useState<Record<string, Prediction>>({})

  const load = useCallback(async () => {
    if (!player) return
    const { data } = await supabase.from('predictions').select('*').eq('player_id', player.id)
    const map: Record<string, Prediction> = {}
    ;(data ?? []).forEach(p => { map[(p as Prediction).match_id] = p as Prediction })
    setByMatch(map)
  }, [player])

  useEffect(() => { load() }, [load])

  async function save(matchId: string, hp: number, ap: number) {
    if (!player) return
    const { error } = await supabase.from('predictions')
      .upsert({ player_id: player.id, match_id: matchId, home_pred: hp, away_pred: ap },
              { onConflict: 'player_id,match_id' })
    if (error) throw new Error(error.message)
    await load()
  }
  return { byMatch, save, reload: load }
}
```
> Note: fix the import to `useCallback` (single import line `import { useCallback, useEffect, useState } from 'react'`).

- [ ] **Step 3: useLeaderboard (with realtime)**

Create `src/hooks/useLeaderboard.ts`:
```ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LeaderRow } from '../lib/types'

export function useLeaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([])
  async function load() {
    const { data } = await supabase.from('leaderboard').select('*').order('total', { ascending: false })
    setRows((data ?? []) as LeaderRow[])
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('lb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])
  return { rows, reload: load }
}
```

- [ ] **Step 4: Build check + commit**

Run: `npm run build` → Expected: succeeds.
```bash
git add src/hooks/
git commit -m "feat: data hooks for matches, predictions, leaderboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: MatchCard component (TDD)

**Files:**
- Create: `src/components/MatchCard.tsx`, `src/components/MatchCard.test.tsx`

- [ ] **Step 1: Write failing tests for the three states**

Create `src/components/MatchCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MatchCard } from './MatchCard'
import type { Match } from '../lib/types'

const m: Match = {
  id: '1', match_no: 1, stage: 'group', group_label: 'C',
  home_code: 'br', away_code: 'hr', home_label: 'Brazil', away_label: 'Croatia',
  kickoff_at: new Date(Date.now() + 3.6e6).toISOString(),
  home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
}

test('open match shows lock button', () => {
  render(<MatchCard match={m} prediction={undefined} onSave={async () => {}} />)
  expect(screen.getByRole('button', { name: /lock/i })).toBeInTheDocument()
})
test('finished match shows points', () => {
  const fin: Match = { ...m, status: 'finished', home_score: 1, away_score: 1,
    kickoff_at: new Date(Date.now() - 3.6e6).toISOString() }
  render(<MatchCard match={fin}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: 30 }}
    onSave={async () => {}} />)
  expect(screen.getByText(/\+30/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- MatchCard`
Expected: FAIL.

- [ ] **Step 3: Implement MatchCard**

Create `src/components/MatchCard.tsx`:
```tsx
import { useState } from 'react'
import { Check, Clock, Lock } from 'lucide-react'
import type { Match, Prediction } from '../lib/types'
import { matchState } from '../lib/matchState'
import { Flag } from './Flag'

export function MatchCard({ match, prediction, onSave }:
  { match: Match; prediction?: Prediction; onSave: (h: number, a: number) => Promise<void> }) {
  const state = matchState(match)
  const [hp, setHp] = useState(prediction?.home_pred ?? 0)
  const [ap, setAp] = useState(prediction?.away_pred ?? 0)
  const [saving, setSaving] = useState(false)
  const editable = state === 'open'

  const Sbox = ({ v, set, real }: { v: number; set?: (n: number) => void; real?: boolean }) =>
    <input type="number" min={0} value={v} disabled={!set}
      onChange={e => set?.(Math.max(0, +e.target.value))}
      className={`w-[38px] h-[42px] text-center font-bold text-lg rounded-xl bg-surface shadow-neu-inset ${real ? 'text-bright' : 'text-accent'} ${!set ? 'opacity-90' : ''}`} />

  const Team = ({ code, label, sub }: { code: string | null; label: string | null; sub?: string }) =>
    <div className="flex items-center gap-3 flex-1">
      <Flag code={code} label={label} />
      <div className="font-semibold text-[15px] text-txt">{label}
        {sub && <small className="block text-[10.5px] text-muted">{sub}</small>}</div>
    </div>

  return (
    <div className="bg-surface rounded-neu shadow-neu p-4 mb-3.5">
      <div className="flex justify-between items-center text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-3">
        <span>{match.group_label ?? match.stage.toUpperCase()} · {new Date(match.kickoff_at).toLocaleString()}</span>
        {state === 'open' && <span className="text-accent">OPEN</span>}
        {state === 'locked' && <span className="flex items-center gap-1"><Lock size={11} />LOCKED</span>}
        {state === 'finished' && prediction?.points_awarded != null &&
          <span className="bg-accent text-[#06101f] rounded-full px-2 py-1">+{prediction.points_awarded}</span>}
      </div>

      <div className="flex items-center gap-3 mb-2.5">
        <Team code={match.home_code} label={match.home_label}
          sub={state !== 'open' && prediction ? `you: ${prediction.home_pred}` : undefined} />
        <Sbox v={state === 'finished' ? match.home_score! : hp} set={editable ? setHp : undefined} real={state === 'finished'} />
      </div>
      <div className="flex items-center gap-3">
        <Team code={match.away_code} label={match.away_label}
          sub={state !== 'open' && prediction ? `you: ${prediction.away_pred}` : undefined} />
        <Sbox v={state === 'finished' ? match.away_score! : ap} set={editable ? setAp : undefined} real={state === 'finished'} />
      </div>

      {state === 'open' &&
        <button disabled={saving}
          onClick={async () => { setSaving(true); try { await onSave(hp, ap) } finally { setSaving(false) } }}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold text-[13px] disabled:opacity-50">
          {prediction ? 'Update prediction' : 'Lock prediction'} <Check size={16} />
        </button>}
      {state === 'locked' &&
        <div className="flex items-center gap-1.5 text-[11px] text-muted mt-3"><Clock size={13} /> Prediction locked</div>}
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- MatchCard`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchCard.tsx src/components/MatchCard.test.tsx
git commit -m "feat: MatchCard with open/locked/finished states

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: App shell, routing, bottom nav, route guard

**Files:**
- Create: `src/components/BottomNav.tsx`, `src/components/Protected.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: BottomNav**

Create `src/components/BottomNav.tsx`:
```tsx
import { NavLink } from 'react-router-dom'
import { Trophy, User, Circle, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const item = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1 text-[10px] font-semibold ${isActive ? 'text-accent' : 'text-muted'}`

export function BottomNav() {
  const { player } = useAuth()
  const Icon = ({ children, active }: { children: React.ReactNode; active?: boolean }) =>
    <span className={`w-11 h-11 rounded-xl grid place-items-center bg-surface ${active ? 'shadow-neu-inset' : 'shadow-neu-sm'}`}>{children}</span>
  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto flex justify-around p-3 bg-bg">
      <NavLink to="/matches" className={item}>{({ isActive }) => <><Icon active={isActive}><Circle size={20} /></Icon>Matches</>}</NavLink>
      <NavLink to="/ranking" className={item}>{({ isActive }) => <><Icon active={isActive}><Trophy size={20} /></Icon>Ranking</>}</NavLink>
      <NavLink to="/me" className={item}>{({ isActive }) => <><Icon active={isActive}><User size={20} /></Icon>Me</>}</NavLink>
      {player?.is_admin &&
        <NavLink to="/admin" className={item}>{({ isActive }) => <><Icon active={isActive}><Shield size={20} /></Icon>Admin</>}</NavLink>}
    </nav>
  )
}
```

- [ ] **Step 2: Protected route guard**

Create `src/components/Protected.tsx`:
```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Protected({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { session, player, loading } = useAuth()
  if (loading) return <div className="p-6 text-muted">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (admin && !player?.is_admin) return <Navigate to="/matches" replace />
  return <>{children}</>
}
```

- [ ] **Step 3: Wire the router**

Replace `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Protected } from './components/Protected'
import { BottomNav } from './components/BottomNav'
import { Login } from './screens/Login'
import { Matches } from './screens/Matches'
import { Ranking } from './screens/Ranking'
import { Me } from './screens/Me'
import { AdminResults } from './screens/admin/AdminResults'
import { AdminFixtures } from './screens/admin/AdminFixtures'
import { AdminPlayers } from './screens/admin/AdminPlayers'
import { AdminSettings } from './screens/admin/AdminSettings'

const Shell = ({ children }: { children: React.ReactNode }) =>
  <div className="max-w-md mx-auto px-4 pt-6 pb-24 min-h-full">{children}<BottomNav /></div>

export default function App() {
  const base = import.meta.env.BASE_URL
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/matches" element={<Protected><Shell><Matches /></Shell></Protected>} />
        <Route path="/ranking" element={<Protected><Shell><Ranking /></Shell></Protected>} />
        <Route path="/me" element={<Protected><Shell><Me /></Shell></Protected>} />
        <Route path="/admin" element={<Protected admin><Shell><AdminResults /></Shell></Protected>} />
        <Route path="/admin/fixtures" element={<Protected admin><Shell><AdminFixtures /></Shell></Protected>} />
        <Route path="/admin/players" element={<Protected admin><Shell><AdminPlayers /></Shell></Protected>} />
        <Route path="/admin/settings" element={<Protected admin><Shell><AdminSettings /></Shell></Protected>} />
        <Route path="*" element={<Navigate to="/matches" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```
> All referenced screens are created in Tasks 15–19. Until then, stub each as `export const X = () => <div/>` so the build passes, or implement Tasks 15–19 before building.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx src/components/Protected.tsx src/App.tsx
git commit -m "feat: routing, app shell, bottom nav, route guard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Login screen

**Files:**
- Create: `src/screens/Login.tsx`

- [ ] **Step 1: Implement Login**

Create `src/screens/Login.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, ArrowRight } from 'lucide-react'
import { login, signUp } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { session } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState(''); const [pin, setPin] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  if (session) { nav('/matches', { replace: true }) }

  async function submit() {
    setErr(''); setBusy(true)
    try {
      mode === 'login' ? await login(name, pin) : await signUp(name, pin)
      nav('/matches', { replace: true })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const Field = ({ icon, ...p }: any) =>
    <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-surface shadow-neu-inset text-txt">
      {icon}<input {...p} className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted" /></div>

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center gap-4 px-6">
      <div className="w-20 h-20 rounded-3xl mx-auto grid place-items-center bg-surface shadow-neu text-accent text-3xl">🏆</div>
      <h1 className="text-center font-extrabold text-2xl tracking-tight">WC26 Predictor</h1>
      <p className="text-center text-muted text-sm mb-2">Predict every match. Beat your friends.</p>
      <Field icon={<User size={17} className="text-muted" />} placeholder="Your name" value={name} onChange={(e:any)=>setName(e.target.value)} />
      <Field icon={<Lock size={17} className="text-muted" />} type="password" placeholder="PIN (6+ chars)" value={pin} onChange={(e:any)=>setPin(e.target.value)} />
      {err && <p className="text-red-400 text-xs text-center">{err}</p>}
      <button onClick={submit} disabled={busy}
        className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold disabled:opacity-50">
        {mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={18} />
      </button>
      <p className="text-center text-muted text-xs">
        {mode === 'login' ? 'New here? ' : 'Have an account? '}
        <b className="text-accent2 cursor-pointer" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Create account' : 'Log in'}</b>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open the URL, create an account (name + 6-char PIN). Confirm redirect to `/matches` and a `players` row appears in Supabase Studio.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Login.tsx
git commit -m "feat: login/signup screen (name + PIN)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Matches screen

**Files:**
- Create: `src/screens/Matches.tsx`

- [ ] **Step 1: Implement Matches**

Create `src/screens/Matches.tsx`:
```tsx
import { useMemo, useState } from 'react'
import { useMatches } from '../hooks/useMatches'
import { usePredictions } from '../hooks/usePredictions'
import { MatchCard } from '../components/MatchCard'
import { matchState } from '../lib/matchState'

type Filter = 'upcoming' | 'locked' | 'finished'

export function Matches() {
  const { matches, loading } = useMatches()
  const { byMatch, save } = usePredictions()
  const [filter, setFilter] = useState<Filter>('upcoming')

  const shown = useMemo(() => matches.filter(m => {
    const s = matchState(m)
    if (filter === 'upcoming') return s === 'open'
    if (filter === 'locked') return s === 'locked'
    return s === 'finished'
  }), [matches, filter])

  if (loading) return <p className="text-muted">Loading matches…</p>
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Matches</h1>
      <div className="flex gap-2 mb-4">
        {(['upcoming', 'locked', 'finished'] as Filter[]).map(f =>
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-2 rounded-xl bg-surface ${filter === f ? 'shadow-neu-inset text-accent' : 'shadow-neu-sm text-muted'}`}>
            {f[0].toUpperCase() + f.slice(1)}</button>)}
      </div>
      {shown.length === 0 && <p className="text-muted text-sm">No matches here.</p>}
      {shown.map(m =>
        <MatchCard key={m.id} match={m} prediction={byMatch[m.id]}
          onSave={(h, a) => save(m.id, h, a)} />)}
    </>
  )
}
```

- [ ] **Step 2: Manual verification**

Run dev server; log in; predict an upcoming match; confirm it saves and reappears with your numbers. Switch filters.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Matches.tsx
git commit -m "feat: matches screen with filter + prediction save

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Ranking screen + LeaderRow

**Files:**
- Create: `src/screens/Ranking.tsx`, `src/components/LeaderRow.tsx`

- [ ] **Step 1: LeaderRow**

Create `src/components/LeaderRow.tsx`:
```tsx
import { Flag } from './Flag'
import type { LeaderRow as Row } from '../lib/types'

export function LeaderRow({ row, rank, isMe }: { row: Row; rank: number; isMe: boolean }) {
  const top = rank <= 3
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface mb-3 ${isMe ? 'shadow-neu-inset' : 'shadow-neu-sm'}`}>
      <div className={`w-[30px] h-[30px] rounded-lg grid place-items-center font-bold text-[13px]
        ${top ? 'text-[#06101f] bg-gradient-to-b from-accent2 to-accent' : 'text-muted shadow-neu-inset'}`}>{rank}</div>
      <Flag code={row.flag_code} size="sm" />
      <div className="flex-1 font-semibold text-sm text-txt">{isMe ? `You · ${row.name}` : row.name}
        <small className="block text-[10.5px] text-muted">{row.exact_hits} exact · {row.diff_hits} diff</small></div>
      <div className="font-bold text-accent text-right">{row.total}<small className="block text-[9px] text-muted">PTS</small></div>
    </div>
  )
}
```

- [ ] **Step 2: Ranking screen**

Create `src/screens/Ranking.tsx`:
```tsx
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAuth } from '../context/AuthContext'
import { LeaderRow } from '../components/LeaderRow'

export function Ranking() {
  const { rows } = useLeaderboard()
  const { player } = useAuth()
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Ranking</h1>
      <p className="text-muted text-xs mb-4">{rows.length} players · updated live</p>
      {rows.map((r, i) => <LeaderRow key={r.id} row={r} rank={i + 1} isMe={r.id === player?.id} />)}
    </>
  )
}
```

- [ ] **Step 3: Manual verification + commit**

Confirm the leaderboard renders and your row is highlighted.
```bash
git add src/screens/Ranking.tsx src/components/LeaderRow.tsx
git commit -m "feat: ranking screen with live leaderboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Me / profile screen

**Files:**
- Create: `src/screens/Me.tsx`

- [ ] **Step 1: Implement Me (stats, change PIN, logout, pick flag)**

Create `src/screens/Me.tsx`:
```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logout } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { useLeaderboard } from '../hooks/useLeaderboard'

export function Me() {
  const { player } = useAuth()
  const { rows } = useLeaderboard()
  const me = rows.find(r => r.id === player?.id)
  const [pin, setPin] = useState(''); const [msg, setMsg] = useState('')

  async function changePin() {
    if (pin.length < 6) { setMsg('PIN must be 6+ characters'); return }
    const { error } = await supabase.auth.updateUser({ password: pin })
    setMsg(error ? error.message : 'PIN updated'); setPin('')
  }
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-4">Me</h1>
      <div className="bg-surface rounded-neu shadow-neu p-5 mb-4">
        <div className="text-lg font-bold">{player?.name}</div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          {[['Total', me?.total ?? 0], ['Exact', me?.exact_hits ?? 0], ['Diff', me?.diff_hits ?? 0]].map(([k, v]) =>
            <div key={k} className="rounded-xl bg-surface shadow-neu-inset py-3">
              <div className="text-accent font-bold text-lg">{v}</div>
              <div className="text-[10px] text-muted uppercase">{k}</div></div>)}
        </div>
      </div>
      <div className="bg-surface rounded-neu shadow-neu p-5 mb-4">
        <div className="text-sm font-semibold mb-2">Change PIN</div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="New PIN"
          className="w-full px-4 py-3 rounded-xl bg-surface shadow-neu-inset outline-none text-sm mb-2" />
        <button onClick={changePin} className="text-xs font-bold text-accent2">Update PIN</button>
        {msg && <p className="text-xs text-muted mt-2">{msg}</p>}
      </div>
      <button onClick={() => logout().then(() => location.reload())}
        className="w-full py-3 rounded-2xl bg-surface shadow-neu-sm text-muted font-semibold text-sm">Log out</button>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/Me.tsx
git commit -m "feat: profile screen with stats, change PIN, logout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Admin — results entry

**Files:**
- Create: `src/screens/admin/AdminResults.tsx`, `src/components/AdminTabs.tsx`

- [ ] **Step 1: Admin tab bar**

Create `src/components/AdminTabs.tsx`:
```tsx
import { NavLink } from 'react-router-dom'
const tabs = [['/admin', 'Results'], ['/admin/fixtures', 'Fixtures'], ['/admin/players', 'Players'], ['/admin/settings', 'Settings']]
export const AdminTabs = () =>
  <div className="flex gap-2 mb-4 overflow-x-auto">
    {tabs.map(([to, label]) =>
      <NavLink key={to} to={to} end className={({ isActive }) =>
        `text-xs font-semibold px-3 py-2 rounded-xl bg-surface whitespace-nowrap ${isActive ? 'shadow-neu-inset text-accent' : 'shadow-neu-sm text-muted'}`}>
        {label}</NavLink>)}
  </div>
```

- [ ] **Step 2: AdminResults (enter score → score_match RPC)**

Create `src/screens/admin/AdminResults.tsx`:
```tsx
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMatches } from '../../hooks/useMatches'
import { AdminTabs } from '../../components/AdminTabs'
import { Flag } from '../../components/Flag'

export function AdminResults() {
  const { matches, reload } = useMatches()
  const [busy, setBusy] = useState<string | null>(null)

  async function saveScore(id: string, hs: number, as: number) {
    setBusy(id)
    try {
      const { error: e1 } = await supabase.from('matches').update({ home_score: hs, away_score: as }).eq('id', id)
      if (e1) throw e1
      const { error: e2 } = await supabase.rpc('score_match', { p_match: id })
      if (e2) throw e2
      await reload()
    } catch (e) { alert((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      {matches.map(m => (
        <div key={m.id} className="bg-surface rounded-neu shadow-neu-sm p-3 mb-3">
          <div className="text-[10px] text-muted uppercase mb-2">{m.group_label ?? m.stage} · {new Date(m.kickoff_at).toLocaleString()} {m.status === 'finished' && '· FINISHED'}</div>
          <Row m={m} onSave={saveScore} busy={busy === m.id} />
        </div>
      ))}
    </>
  )
}

function Row({ m, onSave, busy }: any) {
  const [hs, setHs] = useState(m.home_score ?? 0)
  const [as, setAs] = useState(m.away_score ?? 0)
  const box = (v: number, set: (n: number) => void) =>
    <input type="number" min={0} value={v} onChange={e => set(Math.max(0, +e.target.value))}
      className="w-12 h-10 text-center font-bold rounded-lg bg-surface shadow-neu-inset text-bright" />
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 flex-1"><Flag code={m.home_code} label={m.home_label} size="sm" /><span className="text-sm">{m.home_label}</span></div>
      {box(hs, setHs)}<span className="text-muted">:</span>{box(as, setAs)}
      <div className="flex items-center gap-2 flex-1 justify-end"><span className="text-sm">{m.away_label}</span><Flag code={m.away_code} label={m.away_label} size="sm" /></div>
      <button disabled={busy} onClick={() => onSave(m.id, hs, as)}
        className="ml-2 text-xs font-bold text-accent2 disabled:opacity-50">Save</button>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

As an admin user (set `is_admin=true` on your player row in Studio), enter a score for a past match; confirm predictions get points and the leaderboard updates.

- [ ] **Step 4: Commit**

```bash
git add src/screens/admin/AdminResults.tsx src/components/AdminTabs.tsx
git commit -m "feat: admin results entry triggering score_match

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: Admin — fixtures, players (migration), settings

**Files:**
- Create: `src/screens/admin/AdminFixtures.tsx`, `src/screens/admin/AdminPlayers.tsx`, `src/screens/admin/AdminSettings.tsx`

- [ ] **Step 1: AdminPlayers (legacy points migration + admin toggle)**

Create `src/screens/admin/AdminPlayers.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'
import type { Player } from '../../lib/types'

export function AdminPlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  async function load() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers((data ?? []) as Player[])
  }
  useEffect(() => { load() }, [])

  async function setLegacy(id: string, v: number) {
    await supabase.from('players').update({ legacy_points: v }).eq('id', id); load()
  }
  async function toggleAdmin(id: string, v: boolean) {
    await supabase.from('players').update({ is_admin: v }).eq('id', id); load()
  }
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      <p className="text-muted text-xs mb-3">Set each player's starting (legacy) points to migrate the existing pool.</p>
      {players.map(p => (
        <div key={p.id} className="flex items-center gap-3 bg-surface rounded-neu shadow-neu-sm p-3 mb-2">
          <div className="flex-1 font-semibold text-sm">{p.name}</div>
          <label className="text-[10px] text-muted">legacy</label>
          <input type="number" defaultValue={p.legacy_points}
            onBlur={e => setLegacy(p.id, +e.target.value)}
            className="w-20 h-9 text-center rounded-lg bg-surface shadow-neu-inset text-bright text-sm" />
          <button onClick={() => toggleAdmin(p.id, !p.is_admin)}
            className={`text-[10px] font-bold px-2 py-1 rounded-lg ${p.is_admin ? 'text-accent' : 'text-muted'}`}>
            {p.is_admin ? 'ADMIN' : 'make admin'}</button>
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 2: AdminSettings (edit scoring values)**

Create `src/screens/admin/AdminSettings.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminTabs } from '../../components/AdminTabs'

const KEYS = ['points_exact','points_diff','points_outcome','mult_group','mult_r32','mult_r16','mult_qf','mult_sf','mult_third','mult_final']

export function AdminSettings() {
  const [vals, setVals] = useState<Record<string, number>>({})
  async function load() {
    const { data } = await supabase.from('settings').select('*')
    const map: Record<string, number> = {}
    ;(data ?? []).forEach((s: any) => { map[s.key] = Number(s.value) })
    setVals(map)
  }
  useEffect(() => { load() }, [])
  async function save(key: string, value: number) {
    await supabase.from('settings').upsert({ key, value }); load()
  }
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      <p className="text-muted text-xs mb-3">Scoring values. Changes apply when matches are (re)scored.</p>
      {KEYS.map(k => (
        <div key={k} className="flex items-center gap-3 bg-surface rounded-neu shadow-neu-sm p-3 mb-2">
          <div className="flex-1 text-sm">{k}</div>
          <input type="number" step="0.5" defaultValue={vals[k] ?? 0} onBlur={e => save(k, +e.target.value)}
            className="w-24 h-9 text-center rounded-lg bg-surface shadow-neu-inset text-bright text-sm" />
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 3: AdminFixtures (add/edit, incl. knockout)**

Create `src/screens/admin/AdminFixtures.tsx`:
```tsx
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMatches } from '../../hooks/useMatches'
import { AdminTabs } from '../../components/AdminTabs'
import type { Stage } from '../../lib/types'

const STAGES: Stage[] = ['group','r32','r16','qf','sf','third','final']
const DEFAULT_MULT: Record<Stage, number> = { group:1, r32:1.5, r16:2, qf:3, sf:4, third:6, final:6 }

export function AdminFixtures() {
  const { matches, reload } = useMatches()
  const [f, setF] = useState({ stage: 'r32' as Stage, home_label: '', away_label: '', home_code: '', away_code: '', kickoff_at: '' })

  async function add() {
    await supabase.from('matches').insert({
      stage: f.stage, multiplier: DEFAULT_MULT[f.stage],
      home_label: f.home_label, away_label: f.away_label,
      home_code: f.home_code || null, away_code: f.away_code || null,
      kickoff_at: new Date(f.kickoff_at).toISOString(),
    })
    setF({ ...f, home_label: '', away_label: '', home_code: '', away_code: '', kickoff_at: '' })
    reload()
  }
  const inp = (ph: string, key: keyof typeof f) =>
    <input placeholder={ph} value={f[key] as string} onChange={e => setF({ ...f, [key]: e.target.value })}
      className="px-3 py-2 rounded-lg bg-surface shadow-neu-inset text-sm outline-none" />
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight mb-1">Admin</h1>
      <AdminTabs />
      <div className="bg-surface rounded-neu shadow-neu p-4 mb-4 grid grid-cols-2 gap-2">
        <select value={f.stage} onChange={e => setF({ ...f, stage: e.target.value as Stage })}
          className="px-3 py-2 rounded-lg bg-surface shadow-neu-inset text-sm col-span-2">
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select>
        {inp('Home label (e.g. Winner C)', 'home_label')}{inp('Away label', 'away_label')}
        {inp('Home flag code (br)', 'home_code')}{inp('Away flag code (hr)', 'away_code')}
        <input type="datetime-local" value={f.kickoff_at} onChange={e => setF({ ...f, kickoff_at: e.target.value })}
          className="px-3 py-2 rounded-lg bg-surface shadow-neu-inset text-sm col-span-2" />
        <button onClick={add} className="col-span-2 py-2.5 rounded-xl bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold text-sm">Add fixture</button>
      </div>
      <p className="text-muted text-xs mb-2">{matches.length} fixtures loaded.</p>
    </>
  )
}
```

- [ ] **Step 4: Build + full test run**

Run: `npm test` → Expected: all pass.
Run: `npm run build` → Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/screens/admin/
git commit -m "feat: admin fixtures, player migration, and settings screens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: Deploy to production Supabase + GitHub Pages

**Files:** none (configuration)

- [ ] **Step 1: Create the cloud Supabase project**

Create a project at supabase.com. In its SQL editor or via CLI, push migrations + seed:
```bash
npx supabase link --project-ref <ref>
npx supabase db push          # applies migrations
psql "<connection string>" -f supabase/seed.sql
```

- [ ] **Step 2: Promote yourself to admin**

In Studio → SQL: `update players set is_admin = true where slug = '<your-slug>';`
(After signing up once on production.)

- [ ] **Step 3: Set GitHub Actions secrets/vars**

Repo Settings → Secrets and variables → Actions:
- Variable `VITE_SUPABASE_URL` = production URL
- Secret `VITE_SUPABASE_ANON_KEY` = production anon key

- [ ] **Step 4: Push to main, verify deploy**

```bash
git push origin main
```
Watch the Actions run; confirm the Pages URL loads, sign-up works, predictions save, admin can score, leaderboard updates.

- [ ] **Step 5: Final commit (docs note)**

Add a short `README.md` with run/deploy instructions and commit.

---

## Self-Review Notes (author)

- **Spec coverage:** auth (T8–9,15), per-match scoreline predictions + locking (T11–13,16, RLS T4), scoring 30/15/10 + multipliers (T6), leaderboard incl. legacy points (T6 view, T17), migration of totals (T20 AdminPlayers), admin results/fixtures/settings (T19–20), Supabase + RLS + Realtime (T3–4,12), GitHub Pages (T2,21), dark-neumorphism/Geist/flags visual (T1,10,13), Me tab (T18). All spec sections mapped.
- **Locking** is enforced both in RLS (T4) and UI (matchState T11) — defense in depth.
- **Type consistency:** `score_match(p_match uuid)` RPC name + param match the client call in T19; `LeaderRow` fields match the `leaderboard` view columns; `Match`/`Prediction`/`Player` types used consistently across hooks/components.
- **Known follow-ups (not blockers):** openfootball seed shape may need hand-tuning (flagged in T5); password reset is manual by design (spec §8); ET/penalties excluded from scoring (spec §6.1).
```
