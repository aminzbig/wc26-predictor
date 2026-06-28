# Admin Per-Prediction Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin set or fix a single player's prediction for a match (creating it if it never saved) and re-score just that prediction, without touching the real match result or anyone else's points.

**Architecture:** A new security-definer Postgres function `admin_set_prediction` upserts one prediction row, re-derives its points via a shared `score_points` helper, and writes an audit row. A new admin **Fixes** screen lets the admin pick a match, see every player's prediction in one list (blank where a pick is missing), edit, and save per-row via the RPC. The leaderboard updates through the existing realtime subscription on `predictions`.

**Tech Stack:** React 18 + TypeScript + Vite, react-router-dom, Vitest + @testing-library/react, Supabase (Postgres + RLS + RPC), Tailwind.

> **⚠️ Correction (post-review).** Task 1 below originally introduced a
> `score_points` helper and refactored `recompute_match`, on the mistaken belief
> that production scoring was the best-of-three formula from `0003`/`0004`. It is
> not: current scoring is the FIFA-additive + booster + way-off model from
> `0013`/`0022`/`0023`, and three of its components (risky bonus, booster,
> way-off) cannot be expressed by a per-row scalar helper. The shipped migration
> `supabase/migrations/0027_admin_set_prediction.sql` therefore **restores the
> canonical `recompute_match` unchanged, drops `score_points`, and makes
> `admin_set_prediction` delegate to `recompute_match`**. See the design doc's
> "Scoring: reuse the canonical scorer" section. Read Task 1's SQL below as
> superseded by that file; Tasks 2 and 3 are unaffected.

## Global Constraints

- Database migrations are NOT applied by CI. Apply new files in `supabase/migrations/` to the Fifa26 project (ref `ekgaegdtozqeziyycoul`) via the Management API SQL endpoint with the owner PAT stored at `~/.claude/projects/-Users-amir-WORX-AmirAlaviWorx-WorldcupPrediction-wc26-predictor/memory/supabase-fifa26-deploy-token.md`. There is no local DB — the dev app points at this cloud project, so the migration must be applied for manual testing.
- Prefer idempotent DDL (`create or replace`, `if not exists`, `drop policy if exists` before `create policy`).
- The admin path is the **only** way to write another player's prediction; RLS otherwise restricts predictions to the owning player while the match is open. Enforce admin auth **inside** the `SECURITY DEFINER` function via `is_admin()`.
- Never change `matches.home_score`/`matches.away_score` in this feature — that is the existing Results tab's job.
- Run tests with `npm test`. A failing test blocks deploy.
- UI follows the existing poster style (`border-[3px] border-ink bg-paper`, `font-display`, uppercase) used in `src/screens/admin/AdminResults.tsx` and `AdminPoints.tsx`.

---

### Task 1: Database — score_points helper, admin_set_prediction RPC, audit table

**Files:**
- Create: `supabase/migrations/0026_admin_set_prediction.sql`

**Interfaces:**
- Produces (callable from the client via `supabase.rpc`):
  - `admin_set_prediction(p_player uuid, p_match uuid, p_home int, p_away int) returns integer` — returns the new `points_awarded` (null if the match has no final score yet).
- Produces (internal SQL): `score_points(p_home_pred int, p_away_pred int, p_home_score int, p_away_score int, p_mult numeric) returns integer`.
- Produces (table): `prediction_corrections`.
- Consumes: existing `is_admin()`, `settings` table (keys `points_exact`/`points_diff`/`points_outcome`), `matches`, `predictions` (unique constraint `(player_id, match_id)`).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0026_admin_set_prediction.sql`:

```sql
-- Single source of truth for the prediction scoring formula. STABLE (not
-- IMMUTABLE) because it reads the settings table. Replaces the formula that was
-- duplicated inline in 0003_score_function.sql and 0004_recompute.sql.
create or replace function score_points(
  p_home_pred int, p_away_pred int,
  p_home_score int, p_away_score int,
  p_mult numeric
) returns integer language sql stable set search_path = public as $$
  select (p_mult * (
    case
      when p_home_pred = p_home_score and p_away_pred = p_away_score
        then (select value from settings where key='points_exact')
      when p_home_pred - p_away_pred = p_home_score - p_away_score
        then (select value from settings where key='points_diff')
      when sign(p_home_pred - p_away_pred) = sign(p_home_score - p_away_score)
        then (select value from settings where key='points_outcome')
      else 0
    end))::int;
$$;

-- Refactor the whole-match scorer to use the shared helper. Behavior unchanged.
create or replace function recompute_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
begin
  select * into m from matches where id = p_match;
  if m.home_score is null or m.away_score is null then
    raise exception 'match has no final score';
  end if;

  update predictions p set
    points_awarded = score_points(p.home_pred, p.away_pred, m.home_score, m.away_score, m.multiplier),
    updated_at = now()
  where p.match_id = p_match;

  update matches set status='finished' where id = p_match;
end; $$;

-- Audit trail of admin per-prediction corrections.
create table if not exists prediction_corrections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  admin_id uuid not null references players(id),
  old_home_pred int, old_away_pred int, old_points int,
  new_home_pred int not null, new_away_pred int not null, new_points int,
  created_at timestamptz not null default now()
);
alter table prediction_corrections enable row level security;
drop policy if exists prediction_corrections_admin_read on prediction_corrections;
create policy prediction_corrections_admin_read on prediction_corrections
  for select to authenticated using (is_admin());

-- Admin may read everyone's predictions in any match state, for the Fixes screen.
drop policy if exists predictions_admin_read on predictions;
create policy predictions_admin_read on predictions
  for select to authenticated using (is_admin());

-- Admin: set/fix one player's prediction for one match, re-score that single
-- row, and record the change. Returns new points (null if match not scored yet).
create or replace function admin_set_prediction(
  p_player uuid, p_match uuid, p_home int, p_away int
) returns integer language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  existing predictions%rowtype;
  new_points int;
begin
  if not is_admin() then
    raise exception 'only admins can correct predictions';
  end if;
  if p_home < 0 or p_away < 0 then
    raise exception 'scores must be non-negative';
  end if;

  select * into m from matches where id = p_match;
  if not found then raise exception 'match not found'; end if;

  select * into existing from predictions
    where player_id = p_player and match_id = p_match;

  if m.home_score is not null and m.away_score is not null then
    new_points := score_points(p_home, p_away, m.home_score, m.away_score, m.multiplier);
  else
    new_points := null;
  end if;

  insert into predictions (player_id, match_id, home_pred, away_pred, points_awarded, updated_at)
  values (p_player, p_match, p_home, p_away, new_points, now())
  on conflict (player_id, match_id) do update
    set home_pred = excluded.home_pred,
        away_pred = excluded.away_pred,
        points_awarded = excluded.points_awarded,
        updated_at = now();

  insert into prediction_corrections (
    match_id, player_id, admin_id,
    old_home_pred, old_away_pred, old_points,
    new_home_pred, new_away_pred, new_points
  ) values (
    p_match, p_player, auth.uid(),
    existing.home_pred, existing.away_pred, existing.points_awarded,
    p_home, p_away, new_points
  );

  return new_points;
end; $$;

revoke all on function admin_set_prediction(uuid, uuid, int, int) from public, anon;
grant execute on function admin_set_prediction(uuid, uuid, int, int) to authenticated;
```

- [ ] **Step 2: Set a shell variable for the SQL endpoint helper**

Run (from repo root) to capture the PAT and define a query helper for this shell:

```bash
TOKEN=$(grep -oE 'sbp_[A-Za-z0-9]+' ~/.claude/projects/-Users-amir-WORX-AmirAlaviWorx-WorldcupPrediction-wc26-predictor/memory/supabase-fifa26-deploy-token.md | head -1)
runsql () { curl -s -X POST "https://api.supabase.com/v1/projects/ekgaegdtozqeziyycoul/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(jq -Rsn --arg q "$1" '{query:$q}')"; }
echo "${TOKEN:0:4}…"
```
Expected: prints `sbp_…` (token found). If empty, stop — the token file path is wrong.

- [ ] **Step 3: Run a verification query to confirm the function does NOT yet exist (failing check)**

```bash
runsql "select score_points(2,1,2,1,1)"
```
Expected: a JSON error mentioning `function score_points(...) does not exist`.

- [ ] **Step 4: Apply the migration**

```bash
runsql "$(cat supabase/migrations/0026_admin_set_prediction.sql)"
```
Expected: `[]` (success, no rows).

- [ ] **Step 5: Run verification queries to confirm the formula and objects**

```bash
runsql "select
  score_points(2,1,2,1,1) = (select value from settings where key='points_exact') as exact_ok,
  score_points(2,1,3,2,1) = (select value from settings where key='points_diff') as diff_ok,
  score_points(3,0,1,0,1) = (select value from settings where key='points_outcome') as outcome_ok,
  score_points(0,2,2,0,1) = 0 as miss_ok,
  score_points(2,1,2,1,2) = 2*(select value from settings where key='points_exact') as mult_ok,
  to_regclass('public.prediction_corrections') is not null as table_ok,
  exists(select 1 from pg_proc where proname='admin_set_prediction') as rpc_ok"
```
Expected: one row with every column `true`:
`[{"exact_ok":true,"diff_ok":true,"outcome_ok":true,"miss_ok":true,"mult_ok":true,"table_ok":true,"rpc_ok":true}]`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0026_admin_set_prediction.sql
git commit -m "feat(db): admin_set_prediction RPC + score_points helper + corrections audit"
```

---

### Task 2: Pure row-merge helper

**Files:**
- Create: `src/screens/admin/mergePredictions.ts`
- Test: `src/screens/admin/mergePredictions.test.ts`

**Interfaces:**
- Produces: `CorrectionRow` type and `mergePlayerPredictions(players, predictions): CorrectionRow[]`.
- Consumes: `Player`, `Prediction` from `src/lib/types.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/screens/admin/mergePredictions.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { mergePlayerPredictions } from './mergePredictions'
import type { Prediction } from '../../lib/types'

const players = [
  { id: 'p1', name: 'Alice', flag_code: null, avatar_url: null },
  { id: 'p2', name: 'Bob', flag_code: 'br', avatar_url: null },
]

describe('mergePlayerPredictions', () => {
  test('a player without a prediction gets null scores (blank boxes)', () => {
    const rows = mergePlayerPredictions(players, [])
    expect(rows[0]).toMatchObject({ player_id: 'p1', home_pred: null, away_pred: null, points_awarded: null })
  })

  test('a player with a prediction keeps its values', () => {
    const preds: Prediction[] = [
      { id: 'x', player_id: 'p2', match_id: 'm', home_pred: 2, away_pred: 1, points_awarded: 30 },
    ]
    const rows = mergePlayerPredictions(players, preds)
    expect(rows[1]).toMatchObject({ player_id: 'p2', home_pred: 2, away_pred: 1, points_awarded: 30 })
  })

  test('preserves player order', () => {
    const rows = mergePlayerPredictions(players, [])
    expect(rows.map(r => r.player_id)).toEqual(['p1', 'p2'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mergePredictions`
Expected: FAIL — cannot find module `./mergePredictions` / `mergePlayerPredictions is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/screens/admin/mergePredictions.ts`:

```ts
import type { Player, Prediction } from '../../lib/types'

export interface CorrectionRow {
  player_id: string
  name: string
  flag_code: string | null
  avatar_url: string | null
  home_pred: number | null
  away_pred: number | null
  points_awarded: number | null
}

// Left-join players to their prediction for one match. Players with no
// prediction get null scores so the UI renders blank, fillable boxes.
export function mergePlayerPredictions(
  players: Pick<Player, 'id' | 'name' | 'flag_code' | 'avatar_url'>[],
  predictions: Prediction[],
): CorrectionRow[] {
  const byPlayer = new Map(predictions.map(p => [p.player_id, p]))
  return players.map(pl => {
    const pr = byPlayer.get(pl.id)
    return {
      player_id: pl.id,
      name: pl.name,
      flag_code: pl.flag_code,
      avatar_url: pl.avatar_url,
      home_pred: pr ? pr.home_pred : null,
      away_pred: pr ? pr.away_pred : null,
      points_awarded: pr ? pr.points_awarded : null,
    }
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- mergePredictions`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/screens/admin/mergePredictions.ts src/screens/admin/mergePredictions.test.ts
git commit -m "feat(admin): player/prediction merge helper for corrections screen"
```

---

### Task 3: Fixes screen + tab + route

**Files:**
- Create: `src/screens/admin/AdminCorrections.tsx`
- Test: `src/screens/admin/AdminCorrections.test.tsx`
- Modify: `src/components/AdminTabs.tsx` (add the Fixes tab)
- Modify: `src/App.tsx` (import + add `/admin/fixes` route)

**Interfaces:**
- Consumes: `mergePlayerPredictions` / `CorrectionRow` (Task 2); `admin_set_prediction` RPC (Task 1); `useMatches()` from `src/hooks/useMatches.ts`; `Avatar` from `src/components/Avatar.tsx`.
- Produces: `AdminCorrections` React component; new route `/admin/fixes`.

- [ ] **Step 1: Write the failing test**

Create `src/screens/admin/AdminCorrections.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, beforeEach, test, expect } from 'vitest'
import type { Match } from '../../lib/types'

const finished = {
  id: 'm1', match_no: 1, stage: 'group', group_label: 'A',
  home_code: 'mx', away_code: 'za', home_label: 'Mexico', away_label: 'South Africa',
  kickoff_at: '2026-06-12T00:00:00Z', home_score: 2, away_score: 0,
  multiplier: 1, status: 'finished', prob_home: null, prob_draw: null, prob_away: null,
} as Match

vi.mock('../../hooks/useMatches', () => ({
  useMatches: () => ({ matches: [finished], loading: false, reload: async () => {} }),
}))

const players = [
  { id: 'p1', name: 'Alice', flag_code: null, avatar_url: null },
  { id: 'p2', name: 'Bob', flag_code: null, avatar_url: null },
]
let predictions: any[] = []
const rpc = vi.fn(async () => ({ error: null }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: async () => ({ data: table === 'players' ? players : predictions }),
        eq: async () => ({ data: predictions }),
      }),
    }),
    rpc: (...args: any[]) => rpc(...args),
  },
}))

import { AdminCorrections } from './AdminCorrections'

beforeEach(() => { predictions = []; rpc.mockClear() })

function pickMatch() {
  fireEvent.change(screen.getByLabelText(/select match/i), { target: { value: 'm1' } })
}

test('shows the actual result read-only once a match is picked', async () => {
  render(<AdminCorrections />)
  pickMatch()
  expect(await screen.findByText(/Mexico 2 : 0 South Africa/)).toBeInTheDocument()
})

test('a player with no prediction renders blank boxes', async () => {
  render(<AdminCorrections />)
  pickMatch()
  const home = await screen.findByLabelText(/Alice home prediction/i) as HTMLInputElement
  expect(home.value).toBe('')
})

test('saving calls the RPC with player, match and entered scores', async () => {
  render(<AdminCorrections />)
  pickMatch()
  const home = await screen.findByLabelText(/Alice home prediction/i)
  const away = screen.getByLabelText(/Alice away prediction/i)
  fireEvent.change(home, { target: { value: '2' } })
  fireEvent.change(away, { target: { value: '1' } })
  fireEvent.click(screen.getAllByRole('button', { name: /save/i })[0])
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_set_prediction', {
    p_player: 'p1', p_match: 'm1', p_home: 2, p_away: 1,
  }))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- AdminCorrections`
Expected: FAIL — cannot find module `./AdminCorrections`.

- [ ] **Step 3: Write the screen**

Create `src/screens/admin/AdminCorrections.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMatches } from '../../hooks/useMatches'
import { AdminTabs } from '../../components/AdminTabs'
import { Avatar } from '../../components/Avatar'
import { mergePlayerPredictions, type CorrectionRow } from './mergePredictions'
import type { Prediction } from '../../lib/types'

export function AdminCorrections() {
  const { matches } = useMatches()
  const [matchId, setMatchId] = useState('')
  const [rows, setRows] = useState<CorrectionRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const match = useMemo(() => matches.find(m => m.id === matchId), [matches, matchId])

  async function loadRows(id: string) {
    if (!id) { setRows([]); return }
    const { data: players } = await supabase
      .from('players').select('id, name, flag_code, avatar_url').order('name')
    const { data: preds } = await supabase
      .from('predictions').select('*').eq('match_id', id)
    setRows(mergePlayerPredictions(players ?? [], (preds ?? []) as Prediction[]))
  }
  useEffect(() => { loadRows(matchId) }, [matchId])

  async function save(playerId: string, home: number, away: number) {
    setBusy(playerId)
    try {
      const { error } = await supabase.rpc('admin_set_prediction', {
        p_player: playerId, p_match: matchId, p_home: home, p_away: away,
      })
      if (error) throw error
      await loadRows(matchId)
    } catch (e) { alert((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <>
      <AdminTabs />
      <p className="font-sans font-700 text-[11px] uppercase tracking-widest text-ink/60 mb-3">
        Fix one player's prediction for a match. Does not change the real result.
      </p>
      <select
        aria-label="Select match"
        value={matchId}
        onChange={e => setMatchId(e.target.value)}
        className="w-full h-11 mb-4 px-2 border-[3px] border-ink bg-paper font-display text-[14px] uppercase">
        <option value="">— pick a match —</option>
        {matches.map(m => (
          <option key={m.id} value={m.id}>
            {m.home_label} v {m.away_label} · {new Date(m.kickoff_at).toLocaleDateString()}
          </option>
        ))}
      </select>

      {match && (
        <div className="border-[3px] border-ink bg-paper p-3 mb-4">
          <div className="font-sans font-900 text-[10px] uppercase tracking-widest text-ink/60 mb-1">
            {match.status === 'finished' ? 'Actual result · final' : 'Actual result · not scored yet'}
          </div>
          <div className="font-display text-[18px] uppercase">
            {`${match.home_label} ${match.home_score ?? '–'} : ${match.away_score ?? '–'} ${match.away_label}`}
          </div>
        </div>
      )}

      {match && rows.map(r => (
        <PlayerRow key={r.player_id} row={r} busy={busy === r.player_id} onSave={save} />
      ))}
    </>
  )
}

function PlayerRow({ row, busy, onSave }: {
  row: CorrectionRow; busy: boolean
  onSave: (playerId: string, home: number, away: number) => void
}) {
  const [hs, setHs] = useState<string>(row.home_pred?.toString() ?? '')
  const [as, setAs] = useState<string>(row.away_pred?.toString() ?? '')
  const box = (label: string, v: string, set: (s: string) => void) =>
    <input aria-label={label} type="number" min={0} value={v}
      onChange={e => set(e.target.value)}
      className="w-12 h-10 text-center font-display text-[18px] border-[3px] border-ink bg-paper text-ink outline-none" />
  return (
    <div className="flex items-center gap-2 border-[3px] border-ink bg-paper p-2 mb-2">
      <Avatar url={row.avatar_url} code={row.flag_code} label={row.name} size="sm" />
      <span className="font-display text-[14px] uppercase truncate flex-1 min-w-0">{row.name}</span>
      <span className="font-sans font-800 text-[10px] uppercase tracking-widest text-ink/60">
        {row.points_awarded ?? '—'} pts
      </span>
      {box(`${row.name} home prediction`, hs, setHs)}
      <span className="font-display text-ink/40">:</span>
      {box(`${row.name} away prediction`, as, setAs)}
      <button disabled={busy} onClick={() => onSave(row.player_id, Math.max(0, +hs || 0), Math.max(0, +as || 0))}
        className="ml-1 font-display text-[12px] uppercase tracking-wide bg-ink text-paper px-3 py-1.5 disabled:opacity-50">
        Save
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- AdminCorrections`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the Fixes tab**

In `src/components/AdminTabs.tsx`, add the `/admin/fixes` entry to the `tabs` array (after Points):

```tsx
const tabs = [['/admin', 'Results'], ['/admin/fixtures', 'Fixtures'], ['/admin/players', 'Players'], ['/admin/points', 'Points'], ['/admin/fixes', 'Fixes'], ['/admin/settings', 'Settings']]
```

- [ ] **Step 6: Add the route**

In `src/App.tsx`, add the import alongside the other admin imports:

```tsx
import { AdminCorrections } from './screens/admin/AdminCorrections'
```

And add the route after the `/admin/points` route:

```tsx
<Route path="/admin/fixes" element={<Protected admin><Shell><AdminCorrections /></Shell></Protected>} />
```

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test`
Expected: PASS — all tests, including the new `mergePredictions` and `AdminCorrections` suites.

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/screens/admin/AdminCorrections.tsx src/screens/admin/AdminCorrections.test.tsx src/components/AdminTabs.tsx src/App.tsx
git commit -m "feat(admin): Fixes screen to correct a single player's prediction"
```

---

## Manual verification (after Task 3)

1. Run the app (`npm run dev`), log in as an admin, go to `/admin/fixes`.
2. Pick a finished match. Confirm the actual result shows read-only.
3. Find a player whose boxes are blank (no prediction). Enter a score, Save. Confirm their points appear and the leaderboard (Standings) updates.
4. Edit an existing prediction to the exact final score, Save. Confirm points jump to the exact value × multiplier.
5. In Supabase, confirm a `prediction_corrections` row was written with the correct old → new values and `admin_id`.
6. Confirm the real `matches.home_score`/`away_score` are unchanged.

## Notes / future

- No viewer UI for `prediction_corrections` yet — data is recorded for later inspection via SQL.
- Undo = re-run the correction with the previous values (visible in `prediction_corrections`).
