# Knockout prediction: "–" defaults + penalty-result clarity

**Date:** 2026-06-28
**Status:** Approved

## Problem

For knockout matches (Round of 32 and later) a predicted level scoreline goes to a
penalty shootout, and the player picks who wins. Two issues:

1. **Default 0–0 false tie.** The editable predicted score initializes to `0`, so an
   untouched knockout match reads as `0–0` — a tie — which immediately shows the
   "who advances" picker. Players are confused: they haven't predicted anything yet,
   but the penalty picker is already demanding a choice.

2. **Penalty result is not obvious.** The picker says "Who advances?" / "✓ TEAM goes
   through". It never says this is a *penalty shootout* outcome, nor that the shootout
   *score* is irrelevant — only the winner matters.

## Goals

- Unentered knockout scores display `–` (not `0`), and the penalty picker only appears
  once **both** scores are entered and equal (a deliberately-typed `0–0` still counts).
- The penalty picker clearly reads as a penalty-shootout result: who wins on penalties,
  and that the pen score doesn't matter.
- Consistent penalty wording wherever the pick is surfaced.

## Non-goals

- No scoring change. `winner_side` stays display-only; `recompute_match()` is unchanged
  (per migration `0025`).
- No DB migration. `home_pred`/`away_pred` remain `NOT NULL`; "not entered" stays
  represented by the absence of a prediction row.
- `PensLine` (real shootout score on finished matches) is unchanged.

## Design

### Part 1 — Empty scores show "–", picker only on a real tie

The score/save/picker logic is duplicated in `MatchCard.tsx` (swipe deck) and
`MatchDetail.tsx` (modal). Apply identically to both.

- **Nullable editable state.** `hp`/`ap`: `useState(prediction?.home_pred ?? 0)` →
  `?? null`, typed `number | null`. The mount-sync `useEffect` matches.
- **Empty renders as "–".** `FlagPanel` already renders `null` as `–`
  (`matchFace.tsx:199,204`). Its `<input>` shows an empty field (not `0`) when the value
  is `null`, and clearing the field yields `null` (not `0`). `onChange` widens to
  `(n: number | null) => void`.
- **Picker gating is correct by construction.**
  `tie = homeNum != null && awayNum != null && homeNum === awayNum` is already `false`
  while either side is empty, so an untouched knockout shows `– –` and no picker. A
  deliberately-entered `0–0` (both typed) is a real tie and shows the picker.
- **Auto-save guard.** Add `if (hp == null || ap == null) return` before the debounce so
  a half-entered prediction never tries to persist (DB columns are `NOT NULL`).

### Part 2 — `WinnerPicker` reads as a penalty result (`matchFace.tsx`)

- **Header caption** (`h-[18px]` band): unpicked → `TIE → WHO WINS ON PENALTIES?`;
  picked → `✓ {TEAM} WINS ON PENALTIES`; non-editable with no pick → `No advancer picked`.
- **Choices** (`h-[46px]`): unchanged.
- **New hint strip** (~14px) below the choices, small muted text:
  `Only the winner counts — penalty score doesn't matter`. Shown while editable.
- Small penalty-spot/PK glyph beside the header caption for instant recognition.
- The slide-up band grows by ~14px (the hint strip).

### Part 3 — Consistent wording (`matchFace.tsx`)

- `AdvancerBadge`: `{TEAM} to advance` → `{TEAM} wins on penalties`.

## Files touched

- `src/components/matchFace.tsx` — `FlagPanel` input (nullable/empty), `WinnerPicker`
  (caption + hint + glyph), `AdvancerBadge` (wording).
- `src/components/MatchCard.tsx` — nullable score state + save guard.
- `src/components/MatchDetail.tsx` — nullable score state + save guard.

## Testing

- Untouched knockout match: shows `– –`, no picker.
- Enter one score only: shows `5 –` (or `– 2`), no picker, nothing saved.
- Enter equal scores incl. `0–0`: picker appears; picking a side saves `winner_side`.
- Enter unequal scores: no picker.
- Existing saved `0–0` knockout prediction: still shows picker (real saved tie).
- Group match: unaffected (no picker, `–` default still applies harmlessly).
