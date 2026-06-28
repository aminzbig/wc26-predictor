# Knockout advancer picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player choose which team advances when they predict a knockout draw, captured per-prediction and shown on both the deck card and the detail view.

**Architecture:** A new shared `WinnerPicker` (in `matchFace.tsx`) slides up from behind the name bar when a knockout prediction is a tie; tap selects (swipe passes through via a shared `useTapNotSwipe` hook). The choice is stored in a new nullable `predictions.winner_side` column and folded into each card's existing debounced auto-save. No scoring change.

**Tech Stack:** React 19, framer-motion, Tailwind, Supabase, vitest + @testing-library/react.

## Global Constraints

- **No scoring change.** Do NOT touch `recompute_match` (SQL) or `src/lib/scoring.ts`. The pick is captured/displayed only.
- **Store the side, not a team code:** `winner_side` ∈ `'home' | 'away'` (early-round slots have no resolved code). Nullable.
- **Knockout = `match.stage !== 'group'`.**
- **Swipe threshold = 10px** (`SWIPE_PX`), identical to `FlagPanel`.
- **Chosen highlight:** `bg-yellow text-ink`. Caption "WHO ADVANCES?" → "✓ <ABBR> GOES THROUGH". Detail badge: trophy + flag + "<Team> to advance" (`bg-ink text-yellow border-[3px] border-yellow`).
- **Tokens:** ink `#141210`, paper `#f2eee2`, yellow `#ffd200`, blue `#1f49d6`; fonts `font-display` (Anton), `font-sans` (Archivo). Flags: `<span class="fi fis fi-{code}">`.
- **Reduced motion:** shimmer/pulse/slide disabled under `prefers-reduced-motion: reduce`.
- **Git hygiene:** the working tree has UNRELATED uncommitted changes in `src/lib/bracket.ts` and `src/lib/bracket.test.ts`. NEVER `git add -A` / `git add .`. Stage only the exact files listed per task.
- **Run a single test file:** `npm test -- <path>`. **Typecheck:** `npx tsc -b`.

---

### Task 1: Persistence — migration, type, hook

**Files:**
- Create: `supabase/migrations/0025_knockout_winner.sql`
- Modify: `src/lib/types.ts` (Prediction interface)
- Modify: `src/hooks/usePredictions.ts`
- Test: `src/hooks/usePredictions.test.ts` (create)

**Interfaces:**
- Produces: `buildPredictionRow(playerId, matchId, hp, ap, winnerSide?) => Record<string, unknown>`; `save(matchId: string, hp: number, ap: number, winnerSide?: 'home'|'away'|null) => Promise<void>`; `Prediction.winner_side?: 'home'|'away'|null`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0025_knockout_winner.sql`:

```sql
-- Knockout advancer pick: which side the player thinks goes through when they
-- predict a level scoreline (e.g. 1-1). Side-based ('home'/'away') because
-- early-round knockout slots have no resolved team code at prediction time.
-- Captured/displayed only — recompute_match() is intentionally unchanged.
alter table predictions
  add column if not exists winner_side text
  check (winner_side in ('home','away'));
```

- [ ] **Step 2: Extend the `Prediction` type**

In `src/lib/types.ts`, add the field to the `Prediction` interface:

```ts
export interface Prediction {
  id: string; player_id: string; match_id: string
  home_pred: number; away_pred: number; points_awarded: number | null
  winner_side?: 'home' | 'away' | null
}
```

- [ ] **Step 3: Write the failing test for `buildPredictionRow`**

Create `src/hooks/usePredictions.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { buildPredictionRow } from './usePredictions'

describe('buildPredictionRow', () => {
  test('omits winner_side when not provided', () => {
    expect(buildPredictionRow('p', 'm', 1, 2)).toEqual({
      player_id: 'p', match_id: 'm', home_pred: 1, away_pred: 2,
    })
  })
  test('includes winner_side when a side is given', () => {
    expect(buildPredictionRow('p', 'm', 1, 1, 'home')).toMatchObject({ winner_side: 'home' })
  })
  test('includes winner_side when explicitly null (clears it)', () => {
    expect(buildPredictionRow('p', 'm', 1, 1, null)).toHaveProperty('winner_side', null)
  })
})
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npm test -- src/hooks/usePredictions.test.ts`
Expected: FAIL — `buildPredictionRow` is not exported.

- [ ] **Step 5: Implement the helper and new `save` signature**

Replace `src/hooks/usePredictions.ts` with:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Prediction } from '../lib/types'
import { useAuth } from '../context/AuthContext'

// Build the upsert payload. winner_side is included ONLY when provided (incl.
// null, which clears it) so a plain score save never disturbs an existing pick.
export function buildPredictionRow(
  playerId: string, matchId: string, hp: number, ap: number,
  winnerSide?: 'home' | 'away' | null,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    player_id: playerId, match_id: matchId, home_pred: hp, away_pred: ap,
  }
  if (winnerSide !== undefined) row.winner_side = winnerSide
  return row
}

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

  async function save(matchId: string, hp: number, ap: number, winnerSide?: 'home' | 'away' | null) {
    if (!player) return
    const { error } = await supabase.from('predictions')
      .upsert(buildPredictionRow(player.id, matchId, hp, ap, winnerSide),
              { onConflict: 'player_id,match_id' })
    if (error) throw new Error(error.message)
    await load()
  }
  return { byMatch, save, reload: load }
}
```

- [ ] **Step 6: Run the test (pass)**

Run: `npm test -- src/hooks/usePredictions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0025_knockout_winner.sql src/lib/types.ts src/hooks/usePredictions.ts src/hooks/usePredictions.test.ts
git commit -m "feat(knockout): persist a winner_side advancer pick on predictions"
```

---

### Task 2: Shared `useTapNotSwipe` hook + refactor `FlagPanel`

**Files:**
- Modify: `src/components/matchFace.tsx` (add hook; refactor `FlagPanel` to use it)
- Test: `src/components/matchFace.test.tsx` (add characterization test)

**Interfaces:**
- Produces: `useTapNotSwipe(onTap: () => void) => { onPointerDown, onPointerMove, onClick }` (handlers typed for React pointer/mouse events).

- [ ] **Step 1: Add a characterization test (passes before and after the refactor)**

Append to `src/components/matchFace.test.tsx`:

```tsx
import { render as r2, screen as s2, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { FlagPanel } from './matchFace'

test('FlagPanel: a tap focuses the score input, a swipe does not', () => {
  r2(<FlagPanel code="br" label="Brazil" value={1} editable onChange={vi.fn()} />)
  const overlay = s2.getByTestId('num-overlay')
  const input = s2.getByLabelText(/Brazil predicted score/i)

  // swipe (travel > 10px) → no edit
  fireEvent.pointerDown(overlay, { clientX: 0, clientY: 0 })
  fireEvent.pointerMove(overlay, { clientX: 40, clientY: 0 })
  fireEvent.click(overlay)
  expect(input).not.toHaveFocus()

  // tap (no travel) → edit
  fireEvent.pointerDown(overlay, { clientX: 0, clientY: 0 })
  fireEvent.click(overlay)
  expect(input).toHaveFocus()
})
```

- [ ] **Step 2: Run it (should PASS against current code)**

Run: `npm test -- src/components/matchFace.test.tsx`
Expected: PASS — this locks current `FlagPanel` behavior before refactoring.

- [ ] **Step 3: Add the `useTapNotSwipe` hook**

In `src/components/matchFace.tsx`, update the React import and add the hook near the top (after imports):

```tsx
import { useEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react'
```

```tsx
// Distinguish a deliberate tap from a swipe: a drag (pointer travels > SWIPE_PX)
// passes straight through to the deck's framer-motion drag / the modal scroll,
// while a genuine tap runs onTap. Shared by the score number and the advancer
// picker so the two behave identically.
const SWIPE_PX = 10
export function useTapNotSwipe(onTap: () => void) {
  const down = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  return {
    onPointerDown: (e: RPointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; swiped.current = false },
    onPointerMove: (e: RPointerEvent) => {
      if (!down.current || swiped.current) return
      if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > SWIPE_PX) swiped.current = true
    },
    onClick: (e: RMouseEvent) => {
      if (swiped.current) return
      e.stopPropagation()
      onTap()
    },
  }
}
```

- [ ] **Step 4: Refactor `FlagPanel` to use the hook**

In `FlagPanel`, delete its local `const SWIPE_PX = 10`, the `down`/`swiped` refs, and the inline `onPointerDown`/`onPointerMove`/`onClick` on the overlay div. Replace with a hook instance and spread it. The overlay `<div data-testid="num-overlay" ...>` becomes:

```tsx
const tap = useTapNotSwipe(() => {
  const el = inputRef.current
  if (el) { el.focus(); el.select() }   // focus in-gesture → iOS keyboard
  setEditing(true)
})
```

```tsx
<div
  data-testid="num-overlay"
  className={`absolute inset-0 grid place-items-center ${editing ? 'opacity-0 pointer-events-none' : 'cursor-text'}`}
  {...tap}
>
  <span className={numCls} style={shadow}>{value == null ? '–' : value}</span>
</div>
```

Keep the rest of `FlagPanel` (input element, `inputRef`, `editing` state) unchanged.

- [ ] **Step 5: Run tests (still PASS)**

Run: `npm test -- src/components/matchFace.test.tsx`
Expected: PASS — behavior preserved by the refactor.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/matchFace.tsx src/components/matchFace.test.tsx
git commit -m "refactor(matchFace): extract shared useTapNotSwipe from FlagPanel"
```

---

### Task 3: `WinnerPicker` + `AdvancerBadge` components + CSS

**Files:**
- Modify: `src/components/matchFace.tsx` (add `WinnerPicker`, `AdvancerBadge`)
- Modify: `src/index.css` (attract keyframes)
- Test: `src/components/matchFace.test.tsx` (add picker/badge tests)

**Interfaces:**
- Produces:
  - `WinnerPicker({ homeLabel, awayLabel, homeCode, awayCode, value: 'home'|'away'|null, editable?: boolean, onChange?: (side: 'home'|'away') => void })` — a `motion.div` to be wrapped in `<AnimatePresence>` by the parent and rendered only when it should be visible.
  - `AdvancerBadge({ side: 'home'|'away', homeLabel, awayLabel, homeCode, awayCode })`.

- [ ] **Step 1: Write failing tests**

Append to `src/components/matchFace.test.tsx`:

```tsx
import { WinnerPicker, AdvancerBadge } from './matchFace'

const PICK = { homeLabel: 'Brazil', awayLabel: 'Croatia', homeCode: 'br', awayCode: 'hr' }

test('WinnerPicker: tapping a side selects it', () => {
  const onChange = vi.fn()
  r2(<WinnerPicker {...PICK} value={null} editable onChange={onChange} />)
  fireEvent.pointerDown(s2.getByLabelText(/Brazil advances/i), { clientX: 0, clientY: 0 })
  fireEvent.click(s2.getByLabelText(/Brazil advances/i))
  expect(onChange).toHaveBeenCalledWith('home')
})

test('WinnerPicker: a swipe does not select (passes through)', () => {
  const onChange = vi.fn()
  r2(<WinnerPicker {...PICK} value={null} editable onChange={onChange} />)
  const el = s2.getByLabelText(/Croatia advances/i)
  fireEvent.pointerDown(el, { clientX: 0, clientY: 0 })
  fireEvent.pointerMove(el, { clientX: 40, clientY: 0 })
  fireEvent.click(el)
  expect(onChange).not.toHaveBeenCalled()
})

test('WinnerPicker: read-only does not fire onChange on tap', () => {
  const onChange = vi.fn()
  r2(<WinnerPicker {...PICK} value="home" editable={false} onChange={onChange} />)
  fireEvent.click(s2.getByLabelText(/Brazil advances/i))
  expect(onChange).not.toHaveBeenCalled()
})

test('AdvancerBadge: names the advancing team', () => {
  r2(<AdvancerBadge side="away" {...PICK} />)
  expect(s2.getByText(/Croatia to advance/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run and watch fail**

Run: `npm test -- src/components/matchFace.test.tsx`
Expected: FAIL — `WinnerPicker` / `AdvancerBadge` not exported.

- [ ] **Step 3: Add the CSS attract treatment**

Append to `src/index.css`:

```css
/* Knockout advancer picker — gloss sweep + pulsing ring while no side is chosen,
   modeled on .booster-shine. Gated by .winner-needs on the band. */
.winner-needs .winner-choices::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 38%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  transform: translateX(-160%) skewX(-18deg);
  pointer-events: none;
  z-index: 3;
  animation: winner-shine 2.7s ease-in-out infinite;
}
@keyframes winner-shine {
  0%   { transform: translateX(-160%) skewX(-18deg); }
  34%  { transform: translateX(360%) skewX(-18deg); }
  100% { transform: translateX(360%) skewX(-18deg); }
}
.winner-needs { animation: winner-pulse 1.7s ease-in-out infinite; }
@keyframes winner-pulse {
  0%, 100% { box-shadow: inset 0 0 0 2px rgba(255, 210, 0, 0); }
  50%      { box-shadow: inset 0 0 0 2px rgba(255, 210, 0, 0.95); }
}
@media (prefers-reduced-motion: reduce) {
  .winner-needs .winner-choices::after, .winner-needs { animation: none; }
}
```

- [ ] **Step 4: Implement `WinnerPicker` and `AdvancerBadge`**

In `src/components/matchFace.tsx`: add `import { motion } from 'framer-motion'` and `import { Trophy } from 'lucide-react'` at the top. Add these exports (place after `TeamNameBar`, reusing the existing `abbr3` helper):

```tsx
type Side = 'home' | 'away'

// Slide-up "who advances" band. Rendered inside the (relative, overflow-hidden)
// flags container, pinned just above TeamNameBar, so it appears to emerge from
// behind the names. Parent wraps this in <AnimatePresence> and only mounts it
// when it should show. Tap selects; a swipe passes through (useTapNotSwipe).
export function WinnerPicker({ homeLabel, awayLabel, homeCode, awayCode, value, editable, onChange }: {
  homeLabel: string | null; awayLabel: string | null
  homeCode: string | null; awayCode: string | null
  value: Side | null; editable?: boolean; onChange?: (side: Side) => void
}) {
  const homeTap = useTapNotSwipe(() => { if (editable) onChange?.('home') })
  const awayTap = useTapNotSwipe(() => { if (editable) onChange?.('away') })
  const needs = editable && value == null

  const half = (side: Side, label: string | null, code: string | null, tap: ReturnType<typeof useTapNotSwipe>) => {
    const chosen = value === side
    const dimmed = value != null && !chosen
    const mark = side === 'home' ? '▸' : '◂'
    const flag = code
      ? <span className={`fi fis fi-${code} !w-[26px] !h-[18px] bg-cover border-2 ${chosen ? 'border-ink' : 'border-paper'} flex-none`} />
      : null
    return (
      <div
        {...(editable ? tap : {})}
        role={editable ? 'button' : undefined}
        aria-label={`${label ?? 'team'} advances`}
        className={`flex-1 flex items-center justify-center gap-2 select-none ${editable ? 'cursor-pointer' : ''} ${chosen ? 'bg-yellow text-ink' : 'text-paper'} ${dimmed ? 'opacity-40' : ''}`}
      >
        {side === 'away' && <span className="font-display text-[15px] leading-none">{mark}</span>}
        {side === 'home' && flag}
        <span className="font-display text-[22px] uppercase leading-none">{abbr3(label)}</span>
        {side === 'away' && flag}
        {side === 'home' && <span className="font-display text-[15px] leading-none">{mark}</span>}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: '115%' }} animate={{ y: 0 }} exit={{ y: '115%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className={`absolute inset-x-0 bottom-0 z-[6] bg-ink border-t-[3px] border-ink ${needs ? 'winner-needs' : ''}`}
    >
      <div className="h-[18px] grid place-items-center bg-black/25 font-sans font-900 text-[9px] uppercase tracking-[0.22em] text-yellow leading-none">
        {value ? `✓ ${abbr3(value === 'home' ? homeLabel : awayLabel)} goes through` : 'Who advances?'}
      </div>
      <div className="winner-choices relative flex h-[46px] overflow-hidden">
        {half('home', homeLabel, homeCode, homeTap)}
        {half('away', awayLabel, awayCode, awayTap)}
        <span aria-hidden className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-blue z-[2] pointer-events-none" />
      </div>
    </motion.div>
  )
}

// Detail-view summary: surfaces the chosen advancer as the match winner.
export function AdvancerBadge({ side, homeLabel, awayLabel, homeCode, awayCode }: {
  side: Side; homeLabel: string | null; awayLabel: string | null; homeCode: string | null; awayCode: string | null
}) {
  const label = side === 'home' ? homeLabel : awayLabel
  const code = side === 'home' ? homeCode : awayCode
  return (
    <div className="mt-2 inline-flex items-center gap-2 bg-ink text-yellow border-[3px] border-yellow px-3 py-2">
      <Trophy size={16} />
      {code && <span className={`fi fis fi-${code} !w-[24px] !h-[17px] bg-cover border-2 border-yellow flex-none`} />}
      <span className="font-display text-[16px] uppercase tracking-wide leading-none">{label ?? '—'} to advance</span>
    </div>
  )
}
```

- [ ] **Step 5: Run tests (pass)**

Run: `npm test -- src/components/matchFace.test.tsx`
Expected: PASS (all picker/badge/FlagPanel tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/matchFace.tsx src/components/matchFace.test.tsx src/index.css
git commit -m "feat(knockout): add WinnerPicker + AdvancerBadge with attract animation"
```

---

### Task 4: Wire `MatchCard` (deck)

**Files:**
- Modify: `src/components/MatchCard.tsx`
- Test: `src/components/MatchCard.test.tsx`

**Interfaces:**
- Consumes: `WinnerPicker`, `useTapNotSwipe` (Task 2/3), `Prediction.winner_side` (Task 1).
- Produces: `MatchCard` `onSave` prop becomes `(h: number, a: number, winnerSide?: 'home'|'away'|null) => Promise<void>`.

- [ ] **Step 1: Write failing tests**

Append to `src/components/MatchCard.test.tsx`:

```tsx
const ko: Match = { ...m, stage: 'r16', group_label: null }

test('knockout tie prediction shows the advancer picker', () => {
  render(<MatchCard match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} />)
  expect(screen.getByLabelText(/Brazil advances/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/Croatia advances/i)).toBeInTheDocument()
})

test('knockout decisive prediction hides the advancer picker', () => {
  render(<MatchCard match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 2, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} />)
  expect(screen.queryByLabelText(/Brazil advances/i)).toBeNull()
})

test('group-stage tie shows no advancer picker', () => {
  render(<MatchCard match={m}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} />)
  expect(screen.queryByLabelText(/Brazil advances/i)).toBeNull()
})

test('choosing an advancer auto-saves with the winner_side', async () => {
  vi.useFakeTimers()
  try {
    const onSave = vi.fn(async () => {})
    render(<MatchCard match={ko}
      prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
      onSave={onSave} />)
    fireEvent.pointerDown(screen.getByLabelText(/Croatia advances/i), { clientX: 0, clientY: 0 })
    fireEvent.click(screen.getByLabelText(/Croatia advances/i))
    await act(async () => { vi.advanceTimersByTime(800) })
    expect(onSave).toHaveBeenCalledWith(1, 1, 'away')
  } finally {
    vi.useRealTimers()
  }
})
```

- [ ] **Step 2: Run and watch fail**

Run: `npm test -- src/components/MatchCard.test.tsx`
Expected: FAIL — no picker rendered / `onSave` not called with a side.

- [ ] **Step 3: Implement**

In `src/components/MatchCard.tsx`:

(a) Update imports:

```tsx
import { motion, AnimatePresence } from 'framer-motion'
```

```tsx
import { GameInfo, TopThreePredictors, FlagPanel, TeamNameBar, PointsStar, ScoreLine, PensLine, WinnerPicker } from './matchFace'
```

(b) Update the prop type:

```tsx
export function MatchCard({ match, prediction, onSave, onOpen, boosterActive, boosterRoundUsed, onToggleBooster }:
  { match: Match; prediction?: Prediction; onSave: (h: number, a: number, winnerSide?: 'home' | 'away' | null) => Promise<void>; onOpen?: () => void
    boosterActive?: boolean; boosterRoundUsed?: boolean; onToggleBooster?: () => void }) {
```

(c) Add winner state and knockout flag (after the `hp`/`ap`/`touched`/`saving` state):

```tsx
  const isKnockout = match.stage !== 'group'
  const [winner, setWinner] = useState<'home' | 'away' | null>(prediction?.winner_side ?? null)
```

(d) Sync winner in the existing prediction→state effect:

```tsx
  useEffect(() => {
    setHp(prediction?.home_pred ?? 0)
    setAp(prediction?.away_pred ?? 0)
    setWinner(prediction?.winner_side ?? null)
  }, [prediction?.home_pred, prediction?.away_pred, prediction?.winner_side])
```

(e) Extend the auto-save effect to include the winner:

```tsx
  const savedH = prediction?.home_pred ?? null, savedA = prediction?.away_pred ?? null
  const savedWinner = prediction?.winner_side ?? null
  useEffect(() => {
    if (!editable || !touched) return
    if (hp === savedH && ap === savedA && winner === savedWinner) return
    const t = setTimeout(async () => {
      setSaving(true)
      try { await (isKnockout ? onSave(hp, ap, winner) : onSave(hp, ap)) } finally { setSaving(false) }
    }, 700)
    return () => clearTimeout(t)
  }, [hp, ap, winner, editable, touched, savedH, savedA, savedWinner]) // eslint-disable-line react-hooks/exhaustive-deps
```

(f) Compute picker visibility (after `homeNum`/`awayNum` are defined):

```tsx
  const tie = homeNum != null && awayNum != null && homeNum === awayNum
  const showPicker = isKnockout && tie && (editable ? (prediction != null || touched) : prediction != null)
```

(g) Add `overflow-hidden` to the flags container and render the picker inside it:

```tsx
      <div className="relative flex-1 min-h-0 flex items-stretch border-t-[3px] border-ink overflow-hidden">
        <FlagPanel code={match.home_code} label={match.home_label} value={homeNum} editable={editable} onChange={n => { setHp(n); setTouched(true) }} />
        <div className="w-[3px] bg-ink self-stretch flex-none" />
        <FlagPanel code={match.away_code} label={match.away_label} value={awayNum} editable={editable} onChange={n => { setAp(n); setTouched(true) }} />
        <AnimatePresence>
          {showPicker && (
            <WinnerPicker
              homeLabel={match.home_label} awayLabel={match.away_label}
              homeCode={match.home_code} awayCode={match.away_code}
              value={winner} editable={editable}
              onChange={side => { setWinner(side); setTouched(true) }}
            />
          )}
        </AnimatePresence>
      </div>
```

- [ ] **Step 4: Run tests (pass)**

Run: `npm test -- src/components/MatchCard.test.tsx`
Expected: PASS (new + existing tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: error in `MatchDeck.tsx` is EXPECTED here (its `onSave` arg type not yet updated) — it is fixed in Task 6. If `tsc -b` blocks, proceed; Task 6 resolves it. (If you prefer a clean gate, run Task 6 immediately after.)

- [ ] **Step 6: Commit**

```bash
git add src/components/MatchCard.tsx src/components/MatchCard.test.tsx
git commit -m "feat(knockout): show advancer picker on the deck card"
```

---

### Task 5: Wire `MatchDetail` (picker + winner badge)

**Files:**
- Modify: `src/components/MatchDetail.tsx`
- Test: `src/components/MatchDetail.test.tsx` (create)

**Interfaces:**
- Consumes: `WinnerPicker`, `AdvancerBadge`, `Prediction.winner_side`.
- Produces: `MatchDetail` `onSave` prop becomes `(h, a, winnerSide?: 'home'|'away'|null) => Promise<void>`.

- [ ] **Step 1: Write failing tests**

Create `src/components/MatchDetail.test.tsx`:

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { MatchDetail } from './MatchDetail'
import type { Match } from '../lib/types'

const ko: Match = {
  id: '1', match_no: 73, stage: 'r16', group_label: null,
  home_code: 'br', away_code: 'hr', home_label: 'Brazil', away_label: 'Croatia',
  kickoff_at: new Date(Date.now() + 3.6e6).toISOString(),
  home_score: null, away_score: null, multiplier: 1, status: 'scheduled',
  prob_home: null, prob_draw: null, prob_away: null,
}

test('knockout tie shows the advancer picker in the detail view', () => {
  render(<MatchDetail match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.getByLabelText(/Brazil advances/i)).toBeInTheDocument()
})

test('a chosen advancer renders the winner badge', () => {
  render(<MatchDetail match={ko}
    prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null, winner_side: 'away' }}
    onSave={async () => {}} onClose={() => {}} />)
  expect(screen.getByText(/Croatia to advance/i)).toBeInTheDocument()
})

test('choosing an advancer auto-saves with the winner_side', async () => {
  vi.useFakeTimers()
  try {
    const onSave = vi.fn(async () => {})
    render(<MatchDetail match={ko}
      prediction={{ id: 'p', player_id: 'x', match_id: '1', home_pred: 1, away_pred: 1, points_awarded: null }}
      onSave={onSave} onClose={() => {}} />)
    fireEvent.pointerDown(screen.getByLabelText(/Brazil advances/i), { clientX: 0, clientY: 0 })
    fireEvent.click(screen.getByLabelText(/Brazil advances/i))
    await act(async () => { vi.advanceTimersByTime(800) })
    expect(onSave).toHaveBeenCalledWith(1, 1, 'home')
  } finally {
    vi.useRealTimers()
  }
})
```

- [ ] **Step 2: Run and watch fail**

Run: `npm test -- src/components/MatchDetail.test.tsx`
Expected: FAIL — picker/badge not rendered.

- [ ] **Step 3: Implement**

In `src/components/MatchDetail.tsx`:

(a) Update imports:

```tsx
import { GameInfo, FlagPanel, TeamNameBar, PointsStar, ScoreLine, WinnerPicker, AdvancerBadge } from './matchFace'
```

(b) Update the prop type and add winner state / knockout flag (alongside the existing `hp`/`ap`/`touched`/`saving`):

```tsx
export function MatchDetail({ match, prediction, onSave, onClose }: {
  match: Match
  prediction?: Prediction
  onSave: (h: number, a: number, winnerSide?: 'home' | 'away' | null) => Promise<void>
  onClose: () => void
}) {
```

```tsx
  const isKnockout = match.stage !== 'group'
  const [winner, setWinner] = useState<'home' | 'away' | null>(prediction?.winner_side ?? null)
```

(c) Sync winner in the prediction→state effect:

```tsx
  useEffect(() => {
    setHp(prediction?.home_pred ?? 0)
    setAp(prediction?.away_pred ?? 0)
    setWinner(prediction?.winner_side ?? null)
  }, [prediction?.home_pred, prediction?.away_pred, prediction?.winner_side])
```

(d) Extend the auto-save effect:

```tsx
  const savedH = prediction?.home_pred ?? null, savedA = prediction?.away_pred ?? null
  const savedWinner = prediction?.winner_side ?? null
  useEffect(() => {
    if (!editable || !touched) return
    if (hp === savedH && ap === savedA && winner === savedWinner) return
    const t = setTimeout(async () => {
      setSaving(true)
      try { await (isKnockout ? onSave(hp, ap, winner) : onSave(hp, ap)) } finally { setSaving(false) }
    }, 700)
    return () => clearTimeout(t)
  }, [hp, ap, winner, editable, touched, savedH, savedA, savedWinner]) // eslint-disable-line react-hooks/exhaustive-deps
```

(e) Compute visibility (after `homeNum`/`awayNum`):

```tsx
  const tie = homeNum != null && awayNum != null && homeNum === awayNum
  const showPicker = isKnockout && tie && (editable ? (prediction != null || touched) : prediction != null)
```

(f) Add `overflow-hidden` to the flags container and render the picker inside it:

```tsx
            <div className="relative flex items-stretch gap-2 h-[clamp(200px,calc(var(--app-vh)*0.34),280px)] overflow-hidden">
              <FlagPanel code={match.home_code} label={match.home_label} value={homeNum} editable={editable} onChange={n => { setHp(n); setTouched(true) }} />
              <FlagPanel code={match.away_code} label={match.away_label} value={awayNum} editable={editable} onChange={n => { setAp(n); setTouched(true) }} />
              {points != null && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] aspect-square z-10">
                  <PointsStar points={points} multiplier={match.multiplier} />
                </div>
              )}
              <AnimatePresence>
                {showPicker && (
                  <WinnerPicker
                    homeLabel={match.home_label} awayLabel={match.away_label}
                    homeCode={match.home_code} awayCode={match.away_code}
                    value={winner} editable={editable}
                    onChange={side => { setWinner(side); setTouched(true) }}
                  />
                )}
              </AnimatePresence>
            </div>
```

`AnimatePresence` is already imported in `MatchDetail.tsx`.

(g) Add the advancer summary block. Insert it right after the locked-hint block (`{state === 'locked' && !live && (...)}`) and before the odds bar (`{showOdds && (...)}`):

```tsx
            {isKnockout && tie && (
              <div className="mt-4">
                <div className="text-[11px] font-sans font-900 uppercase tracking-widest opacity-70">Advances to next round</div>
                {winner
                  ? <AdvancerBadge side={winner} homeLabel={match.home_label} awayLabel={match.away_label} homeCode={match.home_code} awayCode={match.away_code} />
                  : editable
                    ? <div className="mt-2 text-[12px] font-sans font-900 uppercase tracking-wider text-ink/70">▲ Pick who advances above</div>
                    : <div className="mt-2 text-[12px] font-sans font-700 uppercase tracking-wider opacity-60">No advancer picked</div>}
              </div>
            )}
```

- [ ] **Step 4: Run tests (pass)**

Run: `npm test -- src/components/MatchDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchDetail.tsx src/components/MatchDetail.test.tsx
git commit -m "feat(knockout): advancer picker + winner badge in the detail view"
```

---

### Task 6: Thread `winner_side` through `MatchDeck` and `Matches`

**Files:**
- Modify: `src/components/MatchDeck.tsx`
- Modify: `src/screens/Matches.tsx`

**Interfaces:**
- Consumes: `MatchCard`/`MatchDetail` `onSave` signatures (Task 4/5), `usePredictions.save` (Task 1).

- [ ] **Step 1: Update `MatchDeck`**

In `src/components/MatchDeck.tsx`, change the `onSave` prop type and the active card's `onSave`:

```tsx
  onSave: (matchId: string, h: number, a: number, winnerSide?: 'home' | 'away' | null) => Promise<void>
```

```tsx
            <MatchCard
              match={active}
              prediction={byMatch[active.id]}
              onSave={(h, a, winnerSide) => onSave(active.id, h, a, winnerSide)}
              onOpen={() => { if (!dragged.current) onOpen(active) }}
              boosterActive={activeBoosted}
              boosterRoundUsed={boosterRoundCommitted}
              onToggleBooster={() => { if (activeBoosted) clearBooster(active.id); else setBooster(active.id, active.stage) }}
            />
```

(The peek cards keep `onSave={async () => {}}` — they accept the extra arg fine.)

- [ ] **Step 2: Update `Matches` (detail onSave)**

In `src/screens/Matches.tsx`, update the `MatchDetail` `onSave` (the `MatchDeck` `onSave={save}` already matches the new signature):

```tsx
        <MatchDetail
          match={selectedLive}
          prediction={byMatch[selectedLive.id]}
          onSave={(h, a, winnerSide) => save(selectedLive.id, h, a, winnerSide)}
          onClose={() => setSelected(null)}
        />
```

- [ ] **Step 3: Typecheck (clean now)**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Full test + lint**

Run: `npm test`
Expected: all suites PASS.
Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchDeck.tsx src/screens/Matches.tsx
git commit -m "feat(knockout): thread winner_side from cards through to save"
```

---

## Manual verification (after Task 6)

1. `npm run dev`, open a knockout match (stage R32+).
2. Set a tie (e.g. 1–1) → the band slides up from behind the names, shimmering.
3. Tap a side → it fills yellow, shimmer stops; detail view shows "🏆 <Team> to advance".
4. Change to a decisive score → band slides back down.
5. Reload → the saved pick is restored on a tie. Group-stage ties show no band.

## Self-review notes (coverage)

- Spec §Data model → Task 1 (migration, side-based, no scoring change). ✓
- Spec §Types / Persistence → Task 1 (type, `save`, `buildPredictionRow`). ✓
- Spec §Shared component (`useTapNotSwipe`, `WinnerPicker`) → Tasks 2, 3. ✓
- Spec §Visibility rule → Tasks 4, 5 (`showPicker`). ✓
- Spec §States (open/locked/finished read-only) → `editable` gating in `WinnerPicker` + `showPicker`. ✓
- Spec §MatchCard / MatchDetail (+ winner badge, nudge) → Tasks 4, 5. ✓
- Spec §CSS animations → Task 3. ✓
- Spec §MatchDeck/Matches threading → Task 6. ✓
- Spec §Scope (MatchGrid/bracket untouched) → no tasks touch them. ✓
- Spec §Testing → tests in Tasks 1,2,3,4,5,6. ✓
