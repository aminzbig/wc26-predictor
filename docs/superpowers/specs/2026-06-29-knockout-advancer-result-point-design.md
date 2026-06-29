# Knockout advancer — the result point follows who advances

**Date:** 2026-06-29
**Status:** Approved

## Problem

The +10 result point ("Correct Outcome") was awarded for the sign of the played
(FT/extra-time) score in every round. In knockouts that conflated two different
skills — reading the match vs. calling who goes through — and created two unfair
edges:

- **Gap A:** a player who predicted a tie and correctly tapped the advancing side
  (`winner_side`) scored nothing for it. Real case: predicted **1–1, Canada**;
  Canada won **0–1 in regulation**, so the "draw" outcome was wrong and the
  advancer call paid 0 → 8 points instead of credit for the right team.
- **Gap B:** in a penalty shoot-out the played result is a **draw**, so a player
  who predicted a decisive win for the side that actually advanced had their
  outcome marked wrong.

## Decision

In **knockout rounds only**, the +10 result point is earned for correctly
predicting **who advances** (regulation, extra time, or penalties) instead of the
played-score sign. Everything else is identical. Group-stage scoring is unchanged.

In any match decided in normal/extra time, "advancer" and "played-outcome" are the
same, so nothing changes; they differ only for penalty matches (Gap B) and for
tie-predictors whose side won outright (Gap A).

### Rules

- **Predicted advancer** = the higher side of the prediction; on a tie, the tapped
  side (`winner_side`). A tie with no `winner_side` = no call = no point.
- **Actual advancer** = the higher side of the FT/ET score; if level, the penalty
  shoot-out winner (`home_pens`/`away_pens`).
- The advancer point is **exempt from the way-off => 0 rule** (kept even when the
  scoreline is zeroed for being far off); the +5 scoreline components are still
  zeroed by way-off.
- Multiplied by the match multiplier and the booster, like everything else.
- **Risky** is unchanged (contrarian-but-correct on the played, decisive result).
- **Max stays 30** base — same ceiling as group, no inflation.

## Effect on the one knockout already played (South Africa 0–1 Canada)

Additive — re-running `recompute_match` tops up two players and takes points from
no one:

| Player | Pick | Before | After |
|---|---|---|---|
| Amir Alavi | 1–1, Canada | 8 | 23 |
| sinoox | 0–0, Canada | 8 | 23 |

Exact-score predictors stay at 45; wrong-team and no-side-tapped picks stay at 8.
(+15 not +10 because of the ×1.5 R32 multiplier.)

## Changes

### 1. Scoring (source of truth) — `supabase/migrations/0028_knockout_advancer.sql`

`create or replace function recompute_match(p_match uuid)`. Derives `adv_actual`
(score winner, else shoot-out winner). The result point is split into:

- a knockout advancer term (`m.stage <> 'group'`, predicted advancer = `adv_actual`)
  added **outside** the way-off gate, and
- the scoreline term inside the gate, where the group result point
  (`m.stage = 'group'` and `sign(pred) = actual_out`) lives.

Group rounds reduce byte-for-byte to the previous (0027) behaviour.

### 2. Frontend mirror — `src/lib/scoring.ts`

`ADVANCER_POINT = 10`, `predictedAdvancer()`, `actualAdvancer()`, `advancerPoint()`
mirroring the SQL. Live projection (`projectedPoints` / `livePicks.ts`) is
unchanged — it approximates the result point from the current scoreline and does
not resolve the advancer (decided only at full time); for a decisive live score
its outcome point already equals the advancer.

## Out of scope / future

- **Risky advancer** (a bonus for backing an upset side that <20% of the field
  picked) — noted, not built.
- No UI change: the advancer pick and its flag are already shown; a decisive pick's
  advancer is implicit in the score.

## Tests

`src/lib/scoring.test.ts` — `predictedAdvancer` / `actualAdvancer` / `advancerPoint`
covering Gap A, Gap B, shoot-out winner, wrong side, and no-side-tapped.
