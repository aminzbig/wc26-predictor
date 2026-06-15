# Social Wall — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design), pending implementation plan
**Author:** Amir + Claude (brainstorming session)

## Summary

Add a **Social** tab to the WC26 predictor: a single global wall where any signed-in
player posts short text, and everyone reacts with five emojis. The latest post is shown
as a big **Locket-style hero card** (with a reaction-burst animation), above a scrolling
**feed of compact, colored cards** for older posts — a hybrid of Locket and Twitter/X.

The feature reuses the app's existing Supabase auth, realtime, RLS conventions, and the
neo-brutalist visual system (Anton/Archivo, `paper`/`ink`, thick borders, drop shadows,
the `PANEL_COLORS` palette).

## Goals

- Lightweight social banter for the prediction group during the tournament.
- Live-updating: new posts and reaction counts appear without refresh.
- Visually native to the app, with a playful Locket-style "wow" on the newest post.

## Non-Goals (YAGNI for this prototype)

Replies/threads, notifications, editing posts, "who reacted" lists, image/photo
attachments, @mentions, public like-leaderboards, per-match comment sections.

## Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| Feed structure | Flat wall, no replies. Newest first. |
| Layout | **Hybrid**: Locket-style hero (latest post) + compact feed (older posts). |
| Reactions | 5 fixed: ❤️ heart, 👍 up, 👎 down, 🩴 sandal, 💀 dead. |
| Reaction behavior | **Unlimited tap** — every tap increments a counter. No per-user state, no "who reacted". Counts can be spammed (intentional, chaotic/fun). |
| Reaction button style | Rectangle buttons, filled the **card's own color**; most-tapped ("hot") reaction fills **solid black** (`ink`) with light text. |
| Post text | Free text, **1–280 chars**, with a live counter in the composer. |
| Match tag | **Optional** — a post may reference one match, shown as a chip/pill. |
| Card color | **Poster picks** from the palette via swatches in the composer (defaults to a random palette color). |
| Moderation | Author can delete own post; admin (`is_admin()`) can delete any. Posts are **not editable** (delete + repost). |
| Identity | Reuses `players` (name + `flag_code`). |

## Visual Design

Reference mockups live in `.superpowers/brainstorm/.../shots/` (locket-solo, locket-hybrid, colored).

**Hero card (latest post):**
- Large rounded card (border-radius ~26px) with the brand's thick `ink` border + offset drop shadow — Locket softness fused with the app's neo-brutalism.
- Background = poster's chosen palette color (`blue`/`red` flip text to `paper`, like match tiles).
- Header: flag + name (Anton, uppercase) + optional match chip + relative time.
- Body: large bold Archivo text.
- Reaction bar of 5 rectangle buttons, tinted the card color, hot = solid black.
- On reaction tap: a short **framer-motion burst** of that emoji floats up over the card.

**Feed cards (older posts):**
- Same content, compact. Slightly smaller rounded corners, smaller type.
- Colored backgrounds from the palette; reactions inline as small tinted buttons.

**Composer:**
- Rounded pill input ("Share something with the group…"), 280 counter, color swatch row,
  optional "Tag match" picker, Post button (`yellow`).

**Palette** (reuse from `MatchCard.tsx` / `MatchTile.tsx`):
```js
const PANEL_COLORS = ['bg-orange', 'bg-green', 'bg-blue text-paper', 'bg-yellow', 'bg-red text-paper']
// plus 'bg-paper' (cream) as a neutral option
```

## Data Model

New migration `supabase/migrations/0014_social.sql`.

```sql
create table social_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references players(id) on delete cascade,
  body         text not null,
  color        text not null default 'paper',
  match_id     uuid references matches(id) on delete set null,
  heart_count  int not null default 0,
  up_count     int not null default 0,
  down_count   int not null default 0,
  sandal_count int not null default 0,
  dead_count   int not null default 0,
  created_at   timestamptz not null default now(),
  constraint social_body_len   check (char_length(body) between 1 and 280),
  constraint social_color_valid check (color in ('orange','green','blue','yellow','red','paper'))
);
create index social_posts_created_idx on social_posts (created_at desc);
```

Reactions are **counter columns**, not rows — the right shape for unlimited-tap (a rows
table would balloon and we don't track who reacted).

## Reactions RPC

Clients must not write counts directly (they could forge totals). A `security definer`
function performs the validated atomic increment:

```sql
create or replace function react_to_post(p_id uuid, kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update social_posts set
    heart_count  = heart_count  + (kind = 'heart')::int,
    up_count     = up_count     + (kind = 'up')::int,
    down_count   = down_count   + (kind = 'down')::int,
    sandal_count = sandal_count + (kind = 'sandal')::int,
    dead_count   = dead_count   + (kind = 'dead')::int
  where id = p_id;
  if kind not in ('heart','up','down','sandal','dead') then
    raise exception 'invalid reaction kind %', kind;
  end if;
end $$;
```

(Implementation note: validate `kind` before the update; the form above is illustrative.)

## RLS (new migration section, mirrors `0002_rls.sql`)

```sql
alter table social_posts enable row level security;

-- read: any authenticated user
create policy social_read on social_posts for select to authenticated using (true);

-- insert: only as yourself, valid body/color (also enforced by table constraints)
create policy social_insert_self on social_posts for insert to authenticated
  with check (author_id = auth.uid());

-- delete: author or admin
create policy social_delete on social_posts for delete to authenticated
  using (author_id = auth.uid() or is_admin());

-- no UPDATE policy: reactions go through react_to_post(); posts are not editable.
grant execute on function react_to_post(uuid, text) to authenticated;
```

## Realtime

Add `social_posts` to the `supabase_realtime` publication, using the same idempotent
`do $$ … $$` guard as `matches` in `0011_realtime_and_recompute.sql`.

`useSocialPosts` hook:
1. Initial load: `select * from social_posts order by created_at desc limit 50`
   (join author name/flag + optional match label).
2. Subscribe to the table:
   - `INSERT` → prepend; the newest becomes the hero.
   - `UPDATE` → patch that post's reaction counts in place.
   - `DELETE` → remove from list.

## Frontend Components

- `src/screens/Social.tsx` — composer + hero + feed; owns the hook.
- `src/components/SocialHero.tsx` — big Locket-style latest card + reaction burst.
- `src/components/SocialCard.tsx` — compact colored feed card.
- `src/components/SocialComposer.tsx` — textarea, 280 counter, color swatches, optional
  match picker, Post.
- `src/components/ReactionBar.tsx` — the 5 rectangle reaction buttons (shared by hero +
  card via a `size` prop), optimistic increment → `react_to_post` RPC.
- `src/hooks/useSocialPosts.ts` — data + realtime subscription.
- `src/lib/social.ts` — pure helpers: reaction → column mapping, `hottest(post)`,
  `relativeTime(iso)`, palette → class map, body/color validation.

**Wiring:**
- `App.tsx`: add `<Route path="/social" element={<Protected><Shell><Social/></Shell></Protected>} />`.
- `BottomNav.tsx`: add a Social tab (lucide `MessageCircle`) between Matches and Ranking.
  Note: with Social added, non-admins have 4 tabs and admins have 5 — verify spacing/borders
  in `BottomNav` still look right at 5 items.

Reuse: `Flag`, `useAuth`, the match list (for the tag picker), `framer-motion`.

## Edge Cases

- **Empty wall** → friendly "Be the first to post" hero placeholder.
- **Optimistic post**: insert locally, reconcile when realtime echoes the row.
- **Optimistic reaction**: bump the count immediately, fire the burst, call the RPC; realtime
  UPDATE reconciles the true count.
- **No match tag**: no chip rendered.
- **Deleted post you're viewing as hero**: next-newest post becomes the hero.
- **Long unbroken text**: wraps; bounded by the 280-char cap so cards never grow unbounded.
- **Tagged match later deleted**: `match_id` set null (chip disappears) — no broken reference.

## Testing (Vitest, matching existing `*.test.ts(x)` style)

- `social.test.ts`: reaction→column mapping, `hottest()`, `relativeTime()`, body/color
  validation (1–280, allowed colors).
- `SocialCard.test.tsx`: renders name/flag/body/counts; hot reaction highlighted; light-text
  colors apply.
- (Optional) composer disables Post when body empty or > 280.

## Open Questions

None blocking. Possible follow-ups after the prototype: reactions throttle/rate-limit if
spam becomes annoying; a "jump to latest" affordance when scrolled into the feed.
