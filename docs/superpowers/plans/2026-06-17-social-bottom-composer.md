# Social Bottom-Docked Glass Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline top-of-feed Social composer with a slim glass pill docked above the bottom nav that slides up from behind it, expands into the full editor on tap, and auto-hides on scroll down / reveals on scroll up.

**Architecture:** A `fixed`, column-centered composer rendered inside `Social` reads the Shell's scroll container via a new `ScrollContext` to drive Instagram-style auto-hide, and uses `visualViewport` to stay above the mobile keyboard. Pure scroll-direction logic is isolated in `src/lib/scroll.ts` for unit testing; the React wiring lives in two small hooks.

**Tech Stack:** React 19, framer-motion 12, Tailwind CSS 3, Vitest + @testing-library/react (jsdom, globals enabled — no need to import `test`/`expect`/`vi`).

## Global Constraints

- Glass material must match `BottomNav` (`src/components/BottomNav.tsx:23-28`): `border-[3px] border-ink`, `backdrop-blur-xl`, `supports-[backdrop-filter]` translucency, shadow `shadow-[0_12px_30px_-8px_rgba(20,18,16,0.5)]`.
- The composer's `onPost` contract is unchanged: `(body: string, color: SocialColor, font: SocialFont, scale: SocialScale, matchId: string | null) => void`.
- No changes to posting logic, the feed, reactions, or `src/lib/social.ts`.
- Only the inner `<div>` in `Shell` scrolls; the document body does not. `position: fixed` is therefore stable.
- Test command pattern: `npm test -- <path>` (runs `vitest run <path>`). Type check: `npx tsc -b`.

---

## File Structure

- Create `src/lib/scroll.ts` — pure `shouldHide()` decision + threshold constants.
- Create `src/lib/scroll.test.ts` — unit tests for `shouldHide()`.
- Create `src/context/ScrollContext.tsx` — context holding the scroll-container ref + `useScrollContainer()` hook.
- Create `src/hooks/useScrollDirection.ts` — wires a scroll listener to `shouldHide()`.
- Create `src/hooks/useKeyboardInset.ts` — `visualViewport`-based keyboard height.
- Modify `src/App.tsx` — `Shell` gets a scroll ref + `ScrollProvider`.
- Modify `src/components/SocialComposer.tsx` — reworked into floating glass pill + expanding editor.
- Modify `src/components/SocialComposer.test.tsx` — updated for collapsed/expanded behavior.
- Modify `src/screens/Social.tsx` — drop the inline top placement reliance; add a bottom spacer.

---

### Task 1: Pure scroll-direction logic

**Files:**
- Create: `src/lib/scroll.ts`
- Test: `src/lib/scroll.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `shouldHide(args: { scrollTop: number; lastScrollTop: number; expanded: boolean; currentlyHidden: boolean }): boolean`; constants `TOP_THRESHOLD = 8`, `DELTA_THRESHOLD = 6`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/scroll.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { shouldHide } from './scroll'

describe('shouldHide', () => {
  test('never hides while the editor is expanded', () => {
    expect(shouldHide({ scrollTop: 500, lastScrollTop: 0, expanded: true, currentlyHidden: false })).toBe(false)
  })

  test('always shown at the top of the feed', () => {
    expect(shouldHide({ scrollTop: 0, lastScrollTop: 400, expanded: false, currentlyHidden: true })).toBe(false)
  })

  test('hides when scrolling down past the threshold', () => {
    expect(shouldHide({ scrollTop: 200, lastScrollTop: 100, expanded: false, currentlyHidden: false })).toBe(true)
  })

  test('reveals when scrolling up past the threshold', () => {
    expect(shouldHide({ scrollTop: 100, lastScrollTop: 200, expanded: false, currentlyHidden: true })).toBe(false)
  })

  test('keeps current state inside the dead zone', () => {
    expect(shouldHide({ scrollTop: 203, lastScrollTop: 200, expanded: false, currentlyHidden: true })).toBe(true)
    expect(shouldHide({ scrollTop: 203, lastScrollTop: 200, expanded: false, currentlyHidden: false })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/scroll.test.ts`
Expected: FAIL — `Failed to resolve import "./scroll"` / `shouldHide is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/scroll.ts`:

```ts
// Pure decision for the auto-hiding bottom composer. Kept framework-free so the
// direction/threshold logic is unit-testable without a DOM.
export const TOP_THRESHOLD = 8 // px from top where the pill is always shown
export const DELTA_THRESHOLD = 6 // px of movement before we react (dead zone)

export function shouldHide(args: {
  scrollTop: number
  lastScrollTop: number
  expanded: boolean
  currentlyHidden: boolean
}): boolean {
  const { scrollTop, lastScrollTop, expanded, currentlyHidden } = args
  if (expanded) return false // composing → always visible
  if (scrollTop <= TOP_THRESHOLD) return false // at the top → always visible
  const delta = scrollTop - lastScrollTop
  if (delta > DELTA_THRESHOLD) return true // scrolling down → hide
  if (delta < -DELTA_THRESHOLD) return false // scrolling up → show
  return currentlyHidden // within dead zone → keep current state
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/scroll.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scroll.ts src/lib/scroll.test.ts
git commit -m "feat(social): pure scroll-direction logic for auto-hiding composer"
```

---

### Task 2: ScrollContext + Shell wiring

**Files:**
- Create: `src/context/ScrollContext.tsx`
- Modify: `src/App.tsx:23-31` (the `Shell` component)

**Interfaces:**
- Consumes: nothing.
- Produces: `ScrollProvider` (React context provider) and `useScrollContainer(): RefObject<HTMLDivElement | null> | null`. The Shell scroll `<div>`'s ref is provided to all routed children.

- [ ] **Step 1: Create the context**

Create `src/context/ScrollContext.tsx`:

```tsx
import { createContext, useContext, type RefObject } from 'react'

// Holds a ref to the Shell's scroll container so floating overlays (e.g. the
// Social composer) can react to feed scrolling without prop-drilling.
const ScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export const ScrollProvider = ScrollContext.Provider

export function useScrollContainer(): RefObject<HTMLDivElement | null> | null {
  return useContext(ScrollContext)
}
```

- [ ] **Step 2: Wire the Shell**

In `src/App.tsx`, add to the imports at the top (after the existing `react-router-dom`/`framer-motion` imports):

```tsx
import { useRef } from 'react'
import { ScrollProvider } from './context/ScrollContext'
```

Replace the `Shell` component (currently `src/App.tsx:23-31`) with:

```tsx
const Shell = ({ children }: { children: React.ReactNode }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div className="relative max-w-md mx-auto bg-paper h-[100dvh] flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+104px)]">
        <ScrollProvider value={scrollRef}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
            {children}
          </motion.div>
        </ScrollProvider>
      </div>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Verify the app still renders existing tests**

Run: `npm test -- src/components/BottomNav.test.tsx`
Expected: PASS (unchanged behavior — the Shell wiring is additive).

- [ ] **Step 5: Commit**

```bash
git add src/context/ScrollContext.tsx src/App.tsx
git commit -m "feat(shell): expose scroll container via ScrollContext"
```

---

### Task 3: Scroll-direction and keyboard-inset hooks

**Files:**
- Create: `src/hooks/useScrollDirection.ts`
- Create: `src/hooks/useKeyboardInset.ts`

**Interfaces:**
- Consumes: `shouldHide` from `src/lib/scroll.ts` (Task 1); `RefObject<HTMLDivElement | null>` shape from `ScrollContext` (Task 2).
- Produces:
  - `useScrollDirection(scrollRef: RefObject<HTMLDivElement | null> | null, expanded: boolean): boolean` — returns whether the pill should be hidden.
  - `useKeyboardInset(active: boolean): number` — px the composer must lift to clear the on-screen keyboard (0 when inactive or unsupported).

- [ ] **Step 1: Create `useScrollDirection`**

Create `src/hooks/useScrollDirection.ts`:

```ts
import { useEffect, useRef, useState, type RefObject } from 'react'
import { shouldHide } from '../lib/scroll'

// Listens to the given scroll container and returns true when the bottom
// composer should hide (scrolling down) vs show (scrolling up / at top /
// expanded). Direction logic lives in the pure shouldHide() helper.
export function useScrollDirection(
  scrollRef: RefObject<HTMLDivElement | null> | null,
  expanded: boolean,
): boolean {
  const [hidden, setHidden] = useState(false)
  const hiddenRef = useRef(false)
  const lastTop = useRef(0)

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    function onScroll() {
      const scrollTop = el!.scrollTop
      const next = shouldHide({
        scrollTop,
        lastScrollTop: lastTop.current,
        expanded,
        currentlyHidden: hiddenRef.current,
      })
      lastTop.current = scrollTop
      if (next !== hiddenRef.current) {
        hiddenRef.current = next
        setHidden(next)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, expanded])

  // Expanding the editor always reveals the composer.
  useEffect(() => {
    if (expanded) {
      hiddenRef.current = false
      setHidden(false)
    }
  }, [expanded])

  return hidden
}
```

- [ ] **Step 2: Create `useKeyboardInset`**

Create `src/hooks/useKeyboardInset.ts`:

```ts
import { useEffect, useState } from 'react'

// How far the on-screen keyboard overlaps the bottom of the layout viewport,
// via the visualViewport API. Used to lift the fixed composer above the
// keyboard while typing. Returns 0 when inactive or unsupported (e.g. desktop).
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) {
      setInset(0)
      return
    }
    function update() {
      const v = window.visualViewport!
      const overlap = window.innerHeight - v.height - v.offsetTop
      setInset(Math.max(0, Math.round(overlap)))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return inset
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useScrollDirection.ts src/hooks/useKeyboardInset.ts
git commit -m "feat(social): scroll-direction and keyboard-inset hooks"
```

---

### Task 4: Floating glass composer + Social wiring

**Files:**
- Modify: `src/components/SocialComposer.tsx` (full rewrite)
- Modify: `src/components/SocialComposer.test.tsx` (full rewrite for new behavior)
- Modify: `src/screens/Social.tsx:11-37` (composer stays first child; add bottom spacer)

**Interfaces:**
- Consumes: `useScrollContainer` (Task 2), `useScrollDirection` (Task 3), `useKeyboardInset` (Task 3); existing exports from `src/lib/social.ts`.
- Produces: `<SocialComposer matchList onPost />` — same props as before; now self-positions `fixed` and manages its own collapsed/expanded state.

- [ ] **Step 1: Rewrite the test for the new collapsed/expanded behavior**

Replace the entire contents of `src/components/SocialComposer.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { SocialComposer } from './SocialComposer'
import { ScrollProvider } from '../context/ScrollContext'

// SocialComposer reads the scroll container from context; wrap it in a provider
// with a real ref so the auto-hide hook has something to attach to.
function Harness({ onPost = () => {} }: { onPost?: (...a: unknown[]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref}>
      <ScrollProvider value={ref}>
        <SocialComposer matchList={[]} onPost={onPost} />
      </ScrollProvider>
    </div>
  )
}

test('collapsed pill shows the prompt and hides the editor', () => {
  render(<Harness />)
  expect(screen.getByText(/share something with the group/i)).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: /^post$/i })).toBeNull()
})

test('tapping the pill expands the editor, posts, then collapses', async () => {
  const onPost = vi.fn()
  render(<Harness onPost={onPost} />)
  await userEvent.click(screen.getByText(/share something with the group/i))
  const box = screen.getByRole('textbox')
  await userEvent.type(box, 'Brazil are cooking 🔥')
  const post = screen.getByRole('button', { name: /^post$/i })
  expect(post).toBeEnabled()
  await userEvent.click(post)
  expect(onPost).toHaveBeenCalledTimes(1)
  expect(onPost.mock.calls[0]).toEqual(['Brazil are cooking 🔥', 'paper', 'sans', 1, null])
  // posting collapses back to the pill
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('shows remaining character count while expanded', async () => {
  render(<Harness />)
  await userEvent.click(screen.getByText(/share something with the group/i))
  await userEvent.type(screen.getByRole('textbox'), 'hello')
  expect(screen.getByText('275')).toBeInTheDocument() // 280 - 5
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/SocialComposer.test.tsx`
Expected: FAIL — the current composer renders the editor immediately (no collapsed pill / no ScrollProvider usage), so `queryByRole('textbox')` is non-null and the prompt text assertions fail.

- [ ] **Step 3: Rewrite `SocialComposer.tsx`**

Replace the entire contents of `src/components/SocialComposer.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil } from 'lucide-react'
import {
  PALETTE, FONTS, SCALES, colorClass, fontClass, validBody, matchOption,
  type SocialColor, type SocialFont, type SocialScale, type MatchLite,
} from '../lib/social'
import { useScrollContainer } from '../context/ScrollContext'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

const MAX = 280
const BASE = 16 // composer preview base px, scaled by the chosen size

// Same glass recipe as BottomNav, so the composer reads as part of the dock.
const GLASS =
  'border-[3px] border-ink bg-paper/80 backdrop-blur-xl ' +
  'supports-[backdrop-filter]:bg-paper/70 ' +
  'shadow-[0_12px_30px_-8px_rgba(20,18,16,0.5)]'

export function SocialComposer({ matchList, onPost }: {
  matchList: MatchLite[]
  onPost: (body: string, color: SocialColor, font: SocialFont, scale: SocialScale, matchId: string | null) => void
}) {
  const [body, setBody] = useState('')
  const [color, setColor] = useState<SocialColor>('paper')
  const [font, setFont] = useState<SocialFont>('sans')
  const [scale, setScale] = useState<SocialScale>(1)
  const [matchId, setMatchId] = useState<string>('')
  const [pickMatch, setPickMatch] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const scrollRef = useScrollContainer()
  const hidden = useScrollDirection(scrollRef, expanded)
  const kbInset = useKeyboardInset(expanded)

  const can = validBody(body)

  function submit() {
    if (!can) return
    onPost(body.trim(), color, font, scale, matchId || null)
    setBody(''); setMatchId(''); setPickMatch(false); setExpanded(false)
  }
  function collapse() { setExpanded(false); setPickMatch(false) }

  // Esc collapses the expanded editor.
  useEffect(() => {
    if (!expanded) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') collapse() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const tucked = hidden && !expanded // slid down behind the nav

  return (
    <>
      {/* Scrim dims the feed while composing; tap to collapse. */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="composer-scrim"
            className="fixed inset-0 z-[55] bg-ink/30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={collapse}
          />
        )}
      </AnimatePresence>

      {/* Floating composer, centered to the app column above the nav. */}
      <motion.div
        className={`fixed left-1/2 w-full max-w-md -translate-x-1/2 px-4 ${expanded ? 'z-[60]' : 'z-30'}`}
        style={{ bottom: `calc(env(safe-area-inset-bottom) + 104px + ${kbInset}px)` }}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: tucked ? 160 : 0, opacity: tucked ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <div className={`${GLASS} ${tucked ? 'pointer-events-none' : ''}`}>
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="text-[14px] font-700 text-ink/55">Share something with the group…</span>
              <Pencil size={18} strokeWidth={2.75} className="text-ink/70" />
            </button>
          ) : (
            <div className="p-3">
              <textarea
                autoFocus
                value={body}
                maxLength={MAX}
                onChange={e => setBody(e.target.value)}
                rows={2}
                placeholder="Share something with the group…"
                style={{ fontSize: BASE * scale }}
                className={`w-full resize-none bg-transparent outline-none leading-tight text-ink placeholder:text-ink placeholder:opacity-50 ${fontClass(font)}`}
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

              {/* font picker — each chip rendered in its own font */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {FONTS.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    aria-label={`font ${f.key}`}
                    onClick={() => setFont(f.key)}
                    className={`${fontClass(f.key)} px-2 py-0.5 text-[14px] leading-none border-2 border-ink bg-paper text-ink ${font === f.key ? 'ring-2 ring-ink ring-offset-1' : ''}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* text size picker */}
              <div className="flex gap-1.5 mt-2">
                {SCALES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    aria-label={`size ${s.value}`}
                    onClick={() => setScale(s.value)}
                    className={`px-2.5 py-0.5 text-[13px] font-display leading-none border-2 border-ink bg-paper text-ink ${scale === s.value ? 'ring-2 ring-ink ring-offset-1' : ''}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {pickMatch && matchList.length > 0 && (
                <select
                  value={matchId}
                  onChange={e => setMatchId(e.target.value)}
                  className="mt-2 w-full border-2 border-ink bg-paper text-ink text-[12px] font-800 p-1"
                >
                  <option value="">No match</option>
                  {matchList.map(m => (
                    <option key={m.id} value={m.id}>
                      {matchOption(m)}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => setPickMatch(v => !v)}
                  className="text-[11px] font-900 uppercase border-2 border-ink px-2 py-0.5 bg-paper text-ink"
                >
                  ＋ Tag match
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] opacity-60">{MAX - body.length}</span>
                  <button
                    type="button"
                    disabled={!can}
                    onClick={submit}
                    className="font-display uppercase bg-yellow text-ink border-[3px] border-ink px-4 py-1.5 text-[14px] disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
```

- [ ] **Step 4: Run the composer test to verify it passes**

Run: `npm test -- src/components/SocialComposer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the bottom spacer in Social**

In `src/screens/Social.tsx`, the composer is already the first child and now self-positions `fixed` (out of flow). Add a spacer as the last child of the outer `<div className="flex flex-col gap-2">` so the final feed card clears the docked pill. Replace the closing of the outer div (currently `src/screens/Social.tsx:35-37`):

```tsx
      )}

      {/* Spacer so the last card clears the docked composer pill. */}
      <div aria-hidden className="h-16" />
    </div>
  )
}
```

(The opening `return ( <div className="flex flex-col gap-2"> <SocialComposer … /> …` is unchanged.)

- [ ] **Step 6: Run the full test suite + type check**

Run: `npm test -- src/components/SocialComposer.test.tsx src/lib/scroll.test.ts && npx tsc -b`
Expected: all PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/SocialComposer.tsx src/components/SocialComposer.test.tsx src/screens/Social.tsx
git commit -m "feat(social): bottom-docked glass composer with slide-up + auto-hide"
```

---

### Task 5: Manual verification on the running app

**Files:** none (verification only).

- [ ] **Step 1: Build to confirm production compile**

Run: `npm run build`
Expected: completes with no TypeScript or Vite errors.

- [ ] **Step 2: Run the dev server and verify behavior**

Run: `npm run dev` (Vite on :5175 — needs `.env.local` cloud Supabase creds per project memory). Navigate to `/social` and confirm:
- The glass pill slides up from behind the nav on entry.
- Tapping the pill expands the editor; the feed dims behind it.
- Tapping the scrim, pressing Esc, or posting collapses it (and posting clears the draft).
- Scrolling down hides the pill (tucks behind the nav); scrolling up reveals it; it's always shown at the top.
- On a mobile device/emulator with the keyboard open, the textarea stays above the keyboard.
- The pill's glass matches the bottom nav.

- [ ] **Step 2 fallback:** If Supabase creds are unavailable, verify the interaction states via the Vitest suite (Tasks 1 & 4) and a `npm run build`, and note that on-device keyboard behavior is the one item that requires a real device.

---

## Self-Review

**Spec coverage:**
- Slide up from behind nav → Task 4 entrance `initial y:80` + `z-30` below nav. ✓
- Expand into full editor → Task 4 expanded branch. ✓
- Dim + tap-out / Esc / post to collapse → Task 4 scrim + `collapse()` + Esc handler + `submit()`. ✓
- Auto-hide on scroll down / reveal on scroll up / always at top → Tasks 1 + 3 (`shouldHide`, `useScrollDirection`). ✓
- Glass like the nav → `GLASS` constant mirrors `BottomNav`. ✓
- Keyboard handling via visualViewport → Task 3 `useKeyboardInset`, applied in Task 4. ✓
- Plumbing (Shell ref + context, Social spacer) → Tasks 2 + 4. ✓
- Non-goals respected: no changes to feed/reactions/social.ts; `onPost` signature preserved. ✓

**Placeholder scan:** none — every code step shows complete code.

**Type consistency:** `shouldHide` arg shape identical in Task 1 def, Task 1 tests, and Task 3 call site. `useScrollDirection(scrollRef, expanded)` and `useKeyboardInset(active)` signatures match between Task 3 defs and Task 4 call sites. `ScrollProvider`/`useScrollContainer` and the `RefObject<HTMLDivElement | null>` type match across Tasks 2, 3, 4. `onPost` tuple in the Task 4 test matches the `social.ts` defaults (`paper`/`sans`/`1`/`null`).
