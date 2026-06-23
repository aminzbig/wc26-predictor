# "Way-off" zero-out scoring rule

**Date:** 2026-06-23
**Status:** Approved (brainstorm) — pending spec review

## Problem

The current scoring is additive (see `supabase/migrations/0013_fifa_scoring.sql`, mirrored
in `src/lib/scoring.ts`):

| Component | Points |
|---|---|
| Correct outcome (W/D/L) | 10 |
| Correct home goals | 5 |
| Correct away goals | 5 |
| Correct goal difference | 5 |
| Exact score bonus | 5 |
| Risky bonus (non-draw outcome predicted by <20% of users) | 10 |

The flat **10-point correct-outcome** reward means cautious lowballing has no downside.
A player who predicts **1–0** and one who predicts **4–0** earn the *same* outcome points
when the match ends **5–0**, even though the 4–0 caller read the game far better. Players
converge on "safe" scorelines (e.g. 2–1) because the magnitude of the scoreline never costs
them anything. We want the predicted scoreline's *magnitude* to matter: a prediction that is
wildly far from the real scoreline should not be rewarded.

## The rule

For each prediction on a finished match, compute the scoreline distance (total goal error):

```
dist = |predHome − actHome| + |predAway − actAway|
```

If `dist >= 5`, the **entire prediction scores 0** for that match. Every component is wiped —
correct outcome, home goals, away goals, goal difference, exact-score bonus, and risky bonus —
and the per-match `multiplier` / `boost` of 0 is still 0. If `dist < 5`, scoring is unchanged
from today.

The threshold is **5**, chosen deliberately:

- `1–0` vs `5–0` → dist 4 → **keeps** its points (the original motivating example survives).
- `5–1` vs `1–0` → dist 5 → **zeroed** (was 10).
- `3–3` vs `0–0` → dist 6 → **zeroed** (was 15: outcome + goal-diff).
- `4–2` vs `1–0` → dist 5 → **zeroed** (was 10).

Exact and near-exact predictions are inherently safe (an exact score is dist 0; a high-scoring
exact like `4–3` vs `4–3` is dist 0). The rule only bites genuinely far-off scorelines.

## Rollout: going-forward only

Matches already played keep their existing scores. The rule applies **only to matches kicking
off on or after a cutoff timestamp**, set to the deploy time. The tournament is live (12 days
into the group stage as of 2026-06-23), so retroactively re-scoring would reshuffle the
leaderboard and strip points players already earned — we explicitly avoid that.

**Gating mechanism:** a single UTC timestamp constant, `FAR_OFF_RULE_FROM`, compared against
each match's `kickoff_at`. No per-match flag to toggle by hand; deterministic. The SQL cutoff
and the client-side constant must be set to the same value and documented together.

Two scoring regimes therefore coexist for the rest of the tournament (pre-cutoff matches under
old rules, post-cutoff under the new rule). This is communicated to players via the rule note
(see UI section).

## Implementation

Two places implement scoring and **must stay in sync** (the SQL function is the source of truth;
the TS file mirrors it for live projection and display):

### 1. `supabase/migrations/00XX_far_off_zero.sql` (source of truth)

`recompute_match()` gains a guard in the `update predictions` statement. When the match's
`kickoff_at >= FAR_OFF_RULE_FROM` **and** the per-row `dist >= 5`, `points_awarded` is forced to
`0`; otherwise the existing additive expression is used unchanged. Sketch:

```sql
points_awarded = case
  when m.kickoff_at >= '<FAR_OFF_RULE_FROM>'::timestamptz
       and abs(p.home_pred - m.home_score) + abs(p.away_pred - m.away_score) >= 5
    then 0
  else mult * ( /* existing additive expression, unchanged */ )
end
```

The cutoff is stored as a literal/constant in the migration. The risky-bonus distribution
calculation above it is unaffected (a zeroed row simply ends up at 0 regardless).

### 2. `src/lib/scoring.ts` (frontend mirror)

`basePoints` gains an optional flag indicating the far-off rule is active for this match
(the caller compares `match.kickoff_at` to the client `FAR_OFF_RULE_FROM` constant). When the
flag is set and `dist >= 5`, `basePoints` returns `0` before summing components. `projectedPoints`
passes the flag through, so the live projection and the post-match figure agree with the server.

A shared constant (e.g. exported `FAR_OFF_RULE_FROM` and `FAR_OFF_THRESHOLD = 5`) keeps the
client values in one place; the SQL literal is set to the identical timestamp.

### 3. Tests — `src/lib/scoring.test.ts`

New cases:
- dist 4 keeps full points (`1–0` vs `5–0` → 10).
- dist 5 zeroes (`5–1` vs `1–0` → 0; was 10).
- far-off draw zeroes (`3–3` vs `0–0` → 0; was 15).
- blowout-predicted, tight result zeroes (`4–2` vs `1–0` → 0).
- exact and near-exact unaffected (`4–3` vs `4–3` → 30).
- rule-inactive (match before cutoff): far-off prediction scores as it does today.

## UI & player communication

A prediction silently showing **0** when the player "got the winner right" reads as a bug, so
this is in scope for v1:

- **Match card:** when a prediction is zeroed by this rule (rule active for the match AND
  `dist >= 5`), show a short reason — **"Too far off — 0 pts"** — in place of a bare `0`.
- **Rule note:** one line wherever scoring is explained, noting the far-off zero rule and that
  it applies to matches from the cutoff onward.

## Out of scope (v1)

- Retroactive re-scoring of pre-cutoff matches.
- A gradual taper / partial-credit curve (we chose a hard cutoff for explainability).
- Any change to the additive component values or the risky bonus.
