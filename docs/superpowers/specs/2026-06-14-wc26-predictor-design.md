# WC26 Predictor — Design Spec

**Date:** 2026-06-14
**Status:** Draft for review
**Author:** Amin (with Claude)

---

## 1. Overview

A web app where a private group of friends predicts the scoreline of every FIFA
World Cup 2026 match, earns points based on accuracy, and competes on a live
leaderboard. An admin enters real match results and migrates each player's
existing point total from the group's current (offline/spreadsheet) pool.

The 2026 World Cup is **already underway** (group stage 11–27 June, final 19
July). The build is therefore sequenced so the group stage goes live as fast as
possible, with knockout fixtures added by the admin as teams are confirmed.

### Goals
- Players log in with their name + PIN and predict match scorelines before kickoff.
- Predictions lock automatically at kickoff.
- Admin enters final scores; the system awards points automatically.
- Carry over each player's existing point total as a starting score.
- Live leaderboard.
- Clean, simple **dark neumorphism** look.

### Non-goals (explicitly out of scope)
- Bracket / "who advances" predictions (we predict scorelines only).
- Predicting corners, cards, first scorer (FIFA's extras — dropped for simplicity).
- Multiple separate pools / leagues (single shared pool).
- Public/global leaderboards beyond the one pool.
- Real-time minute-by-minute live score feeds (results are entered post-match).
- Native mobile apps (responsive web only).

---

## 2. Users & roles

| Role | Who | Can do |
|---|---|---|
| **Player** | Anyone who signs up | Predict open matches, view own predictions, view leaderboard, edit own profile/PIN |
| **Admin** | Amin (flag set in DB) | Everything a player can, plus: enter/edit match results, add/edit/lock fixtures, set each player's legacy (starting) points, manage players |

There is no separate "creator/admin link" — admin is simply a boolean flag on a
player account. First admin is set manually in the database.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + Vite + TypeScript** | Fast, simple, standard |
| Styling | **Tailwind CSS** + custom neumorphism shadow utilities | Neumorphism = bespoke box-shadows; Tailwind keeps it tidy |
| Font | **Geist** (Google Fonts) | Chosen modern typeface |
| Flags | **flag-icons** (rectangular) | Real SVG flags |
| Icons | **Lucide** (line icons) | Matches the mockups |
| Backend | **Supabase** (Postgres + Auth + RLS + Realtime) | Requested; gives DB, auth, security, live updates in one |
| Hosting | Static host (Vercel/Netlify) for frontend; Supabase cloud for backend | Free tier sufficient for <20 users |

Mobile-first, responsive up to desktop.

---

## 4. Visual design (locked)

- **Theme:** dark neumorphism. Base surface `#23272f`, dark shadow `#15181d`,
  light shadow `#2f343d`.
- **Accent:** azure `#2F9BFF` (with lighter `#57b0ff` for gradients).
- **Text:** primary `#d7dce4`, muted `#838a96`, bright `#f0f2f6`.
- **Typeface:** Geist (weights 400–800).
- **Flags:** rounded rectangles (~50×36 in cards, ~38×28 in lists).
- **Shape language:** soft, large border-radius (16–36px), dual-direction shadows;
  inset (sunken) shadows for inputs, selected states, and "your" leaderboard row;
  raised shadows for cards and buttons.

Reference mockups: `.superpowers/brainstorm/.../content/layout-v3.html`.

---

## 5. Screens

Bottom tab navigation: **Matches · Ranking · Me**. Admin sees an extra **Admin** entry.

### 5.1 Login / Sign up
- Fields: **Name**, **PIN** (6 characters).
- "Log in" and "Create account" modes.
- Session persists (stays logged in across visits).
- On sign-up: name must be unique within the pool.

### 5.2 Matches (home)
- Scrollable list of matches grouped by day, ordered by kickoff.
- Each match card shows both teams (flag + name) and two score input boxes.
- Card states:
  - **Open** — kickoff in the future. Score boxes editable; "Lock prediction" saves.
  - **Locked** — kickoff passed / match in progress. Shows the player's saved
    prediction, read-only, with a lock indicator + countdown text.
  - **Finished** — shows the real final score, the player's prediction (muted),
    and points earned (e.g. "+30").
- A small filter/segment to jump between **Upcoming**, **Live/Locked**, **Finished**,
  and stage (Group / R32 / R16 / QF / SF / Final).
- Predictions auto-save per match; a match with no prediction simply scores 0.

### 5.3 Ranking (leaderboard)
- All players ranked by total points (legacy + earned), descending.
- Top 3 highlighted with azure rank chips.
- Current user's row rendered "sunken" (inset) so it's easy to find.
- Sub-stats per row: count of exact hits and goal-difference hits.
- Updates live (Supabase Realtime) or on refresh.

### 5.4 Me (profile)
- Player's name, chosen flag (optional, cosmetic), and stats (total points,
  exact/diff/outcome counts, best matchday).
- Change PIN. Log out.

### 5.5 Admin
- **Results:** list of matches; enter/edit final score; "Save & score" triggers
  point calculation for all predictions on that match.
- **Fixtures:** add/edit matches (used to add knockout fixtures once teams are
  known; edit kickoff times; correct team assignments). Set stage + multiplier.
- **Players:** view all players; set each player's **legacy points** (the
  migration step); toggle admin; remove a player.
- **Settings:** edit scoring values (exact/diff/outcome points and per-stage
  multipliers) without code changes.

---

## 6. Scoring

### 6.1 Base points (per match)
Compared against the **regulation full-time score** (90 minutes; extra time and
penalties are ignored for scoring, to keep it unambiguous).

| Result of prediction | Points |
|---|---|
| **Exact score** (both numbers right) | **30** |
| **Correct goal difference** (not exact, but `home−away` matches; includes correct non-exact draws) | **15** |
| **Correct outcome only** (right winner/draw, wrong margin & difference) | **10** |
| Wrong | **0** |

Evaluation order: exact → goal difference → outcome → wrong (first match wins).

### 6.2 Stage multiplier
Final points = base × stage multiplier.

| Stage | Multiplier |
|---|---|
| Group | ×1 |
| Round of 32 | ×1.5 |
| Round of 16 | ×2 |
| Quarter-final | ×3 |
| Semi-final | ×4 |
| 3rd place / Final | ×6 |

All base values and multipliers are stored in a `settings` table and editable by
the admin. (Values above are defaults, FIFA-inspired with the user's "30 for
exact" anchor.)

### 6.3 Total
`player_total = legacy_points + Σ(points_awarded across all their predictions)`

### 6.4 When scoring runs
When the admin saves a final score for a match, a Postgres function
`score_match(match_id)` runs server-side: it reads every prediction for that
match, computes `points_awarded`, writes it back, and marks the match
`finished`. Re-saving a corrected score recomputes idempotently.

---

## 7. Data model (Postgres / Supabase)

```
teams
  code        text primary key      -- ISO-ish flag code, e.g. 'br'
  name        text not null         -- 'Brazil'

players
  id            uuid primary key     -- = auth.users.id
  name          text not null unique
  slug          text not null unique -- derived from name; used for synthetic email
  flag_code     text references teams(code)  -- cosmetic, nullable
  is_admin      boolean not null default false
  legacy_points integer not null default 0   -- migrated starting total
  created_at    timestamptz default now()

matches
  id           uuid primary key
  match_no     integer              -- official match number (optional)
  stage        text not null        -- 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
  group_label  text                 -- 'Group C' (null for knockouts)
  home_code    text references teams(code)  -- nullable until known (knockouts)
  away_code    text references teams(code)
  home_label   text                 -- placeholder when team unknown ('Winner Group C')
  away_label   text
  kickoff_at   timestamptz not null
  home_score   integer              -- null until finished
  away_score   integer
  multiplier   numeric not null default 1
  status       text not null default 'scheduled' -- 'scheduled' | 'finished'
  created_at   timestamptz default now()

predictions
  id             uuid primary key
  player_id      uuid references players(id) on delete cascade
  match_id       uuid references matches(id) on delete cascade
  home_pred      integer not null
  away_pred      integer not null
  points_awarded integer            -- null until match scored
  created_at     timestamptz default now()
  updated_at     timestamptz default now()
  unique (player_id, match_id)

settings
  key   text primary key   -- 'points_exact', 'points_diff', 'points_outcome', 'mult_group', ...
  value numeric not null
```

**Leaderboard** is a SQL view summing `legacy_points + coalesce(sum(points_awarded),0)`
per player, with exact/diff counts.

A match is **open for prediction** when `status = 'scheduled' AND kickoff_at > now()`.

---

## 8. Authentication (name + PIN on Supabase)

Supabase Auth is email/password based, so name+PIN is mapped onto it:

- On sign-up the app derives a synthetic email: `"{slug}@players.wc26.local"`
  (slug = lowercased, hyphenated name). PIN is the password.
- PIN is **6 characters** to satisfy Supabase's minimum password length.
- Name uniqueness is enforced by `players.name unique`, which guarantees email
  uniqueness too.
- A `players` row is created on sign-up (via trigger on `auth.users` or an app
  call) carrying name, slug, defaults.
- Sessions persist via Supabase's stored session (stays logged in).
- This synthetic-email scheme is an internal detail; players only ever see
  "name + PIN".

**Trade-off:** no password reset by email (no real emails). For a <20-person
friends pool the admin can reset a player's PIN manually. Acceptable.

---

## 9. Security (Row Level Security)

RLS enabled on all tables:

- `players`: a user can read all players (leaderboard needs names); can update
  only their own row, and **cannot** change `is_admin` or `legacy_points`
  themselves. Admins can update any player.
- `matches`: everyone can read; only admins can insert/update/delete.
- `predictions`: a user can read all predictions **only for matches that are
  finished or already locked** (so nobody sees others' open-match picks); can
  read their own always; can insert/update their own prediction **only while the
  match is open** (`kickoff_at > now() AND status='scheduled'`); cannot set
  `points_awarded` (only the `score_match` function does, running with elevated
  privilege).
- `settings`: everyone reads; only admins write.

Locking is thus enforced in the database, not just the UI.

---

## 10. Live updates

Leaderboard and finished-match results use Supabase Realtime subscriptions on
`predictions` and `matches`. If Realtime is not wired up in the first cut, the
app refetches on screen focus / pull-to-refresh. Realtime is an enhancement, not
a blocker.

---

## 11. Migration of existing scores

The group already tracks points elsewhere (spreadsheet/manual). Migration =
admin enters each player's **current total** into `players.legacy_points` via the
Admin → Players screen. From then on, new match points add on top. No historical
per-match predictions are imported (per decision). Players created before they
sign up themselves: admin can pre-create accounts, or players self-sign-up and
the admin then sets their legacy points by matching names.

---

## 12. Match/fixture data

- **Teams & group-stage fixtures:** seeded once from a free open dataset
  (`openfootball/worldcup.json`) into `teams` and `matches`.
- **Results:** entered by the admin after each match. Optional future
  enhancement: a "fetch suggested score" button backed by a free API
  (`rezarahiminia/worldcup2026`) that pre-fills the boxes; admin always confirms.
- **Knockout fixtures:** added/edited by the admin once participants are known,
  using placeholder labels (`Winner Group C`) beforehand if desired.

---

## 13. Build sequence (informs the implementation plan)

1. **Foundation** — Vite+React+TS+Tailwind project, Geist/flag-icons/Lucide,
   neumorphism design tokens, Supabase project + schema + RLS + seed teams/fixtures.
2. **Auth** — name+PIN sign-up/login, persisted session, profile row creation.
3. **Matches + predictions** — match list, score inputs, open/locked/finished
   states, save with DB-enforced locking.
4. **Scoring + leaderboard** — `score_match` function, admin result entry,
   leaderboard view + screen.
5. **Admin tools** — fixtures, players (legacy points migration), settings.
6. **Polish + live** — Realtime, Me/profile stats, responsive/desktop pass,
   knockout multipliers verified.

Group stage (steps 1–4) is the launch-critical path.

---

## 14. Open questions / assumptions

- **Assumption:** scoring on 90-minute regulation score (ET/penalties ignored).
- **Assumption:** single admin (Amin) initially; more can be promoted.
- **Assumption:** ~18 players, free tiers throughout.
- **Assumption:** group-stage seed data is acceptable from openfootball; if its
  fixtures lag, admin edits them.
```
