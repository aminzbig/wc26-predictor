# Circular photo-blend avatars

**Date:** 2026-06-17
**Status:** Approved, implementing

## Goal

Let users set a personal **circular avatar** that is their live-captured **photo with their chosen flag tinted over it**. A blend slider controls how strongly the flag shows (0% = just photo, 100% = just flag). The avatar represents the user's *identity* and appears everywhere the user is shown; the two **team** flags inside a match stay rectangular and unchanged.

## Decisions (from brainstorming)

- **Scope:** Circular avatar replaces the user's flag at all *identity* sites: profile stats header, leaderboard rows, social card, social hero, match-detail picks board. Match team flags (`MatchCard`, `MatchTile`, `MatchFlags`, admin) keep the rectangular `Flag`.
- **Blend:** Flag tint over photo. Slider 0–100 = flag layer opacity over the photo.
- **Photo source:** Live camera capture via `getUserMedia` (camera-only, by choice). Desktops without a webcam can't set a photo — they keep the flag picker. This is accepted.
- **Bake once:** The composite is rendered to a canvas once at save time and uploaded as a single image. Every render site shows a plain `<img>` cropped to a circle — identical and correct on every page, no per-render compositing.
- **No photo → circular flag.** If `avatar_url` is null, the avatar is the user's flag rendered inside a circle (existing flag-icons, zero storage). No flag and no photo → initials fallback.

## Backend

New migration `supabase/migrations/0017_avatars.sql`:

- **Bucket** `avatars`: public read; insert/update/delete restricted to the authenticated owner's own folder (`name like auth.uid() || '/%'`).
- **Columns on `players`:**
  - `avatar_url text` — public URL of the baked composite; null = fall back to circular flag.
  - `avatar_blend smallint` — last slider value (0–100), so reopening the editor restores the slider.
- **Update the `leaderboard` view** to also select `avatar_url` (leaderboard rows render the avatar).

Storage layout per user (id = `auth.uid()`):
- `avatars/{id}/source.jpg` — raw capture, so the slider can be re-adjusted without re-shooting.
- `avatars/{id}/avatar.jpg` — baked 512×512 composite (what `avatar_url` points to).

Sizing: baked JPEG 512×512, quality ~0.85, ~50–120 KB. Well within Supabase free tier (1 GB storage / 5 GB egress).

## Frontend

### `src/components/Avatar.tsx` (new)
Circular identity avatar. Props `{ url, code, label, size }` (`sm|md|lg`, square 1:1 dims matching the existing `Flag` heights: sm 24, md 28, lg 44 → use square `w/h`). Render priority:
1. `url` → `<img>` cover-fit, `rounded-full`, `border-2 border-ink`.
2. else `code` → circular flag (`fi fi-{code}` background, `rounded-full overflow-hidden`).
3. else → initials in a circle.

### `src/components/AvatarStudio.tsx` (new)
The camera + blend editor, shown under the **Photo** tab.
- States: `idle` (start camera) → `live` (video preview in circular mask + Capture) → `review` (captured frame on canvas + blend slider + Save/Retake).
- `getUserMedia({ video: { facingMode: 'user' } })`; stop all tracks on capture, on tab leave, and on unmount.
- Compose on a 512×512 canvas: photo cover-fit, then flag SVG cover-fit at `globalAlpha = blend/100`. The slider re-renders this live.
- Flag image is loaded from the **bundled, same-origin** flag-icons SVG asset (resolved via Vite) so the canvas is not tainted and `toBlob` works.
- Save: `canvas.toBlob('image/jpeg', 0.85)` → upload baked to `avatars/{id}/avatar.jpg` and the raw frame to `avatars/{id}/source.jpg` (`upsert: true`) → `players.update({ avatar_url: <public url + cache-busting query>, avatar_blend })` → refresh player in context.
- Requires a flag to be selected first; if none, prompt the user to pick a flag (Flag tab).

### `src/screens/Me.tsx`
- The "YOUR FLAG" panel gets a 2-tab header: **Flag** (existing picker) and **Photo** (`AvatarStudio`).
- Stats header uses `<Avatar url={player.avatar_url} code={flag} label={player.name} size="sm" />`.

### Identity render sites — swap `Flag` → `Avatar`
- `LeaderRow.tsx` (needs `avatar_url` on `LeaderRow` type + `leaderboard` view).
- `SocialCard.tsx` and `SocialHero.tsx` (needs `author_avatar` on `PostView`/`PlayerLite`; `useSocialPosts` select adds `avatar_url`).
- `MatchDetail.tsx` picks board (the per-person prediction row — uses the player's identity flag).
- `Me.tsx` stats header.

### Types / data
- `Player`, `LeaderRow` get `avatar_url: string | null`.
- `social.ts`: `PlayerLite` + `PostView` get an avatar field; `toView` maps it.
- `useSocialPosts` select: `id, name, flag_code, avatar_url`.
- `AuthContext` already does `select('*')`, so `avatar_url` loads automatically; add a way to refresh the player after save (re-fetch or local merge).

## Per-page correctness (explicit requirement)

Flags are 4:3; the avatar is 1:1, so each call site is checked for width/alignment, not just `rounded-full`:
- Profile stats header — sits next to the name; confirm vertical centering.
- LeaderRow — between rank box and name; confirm gap/size.
- SocialCard / SocialHero — author row; confirm baseline with name + timestamp.
- MatchDetail picks board — confirm it lines up in the row grid.

## Testing / verification

- `npm run build` (or typecheck) passes.
- Run the app; on the profile, capture a photo, move the slider (0 → photo, 100 → flag), save; confirm the circular avatar appears in profile, leaderboard, social, and picks board.
- Confirm a user with no photo shows a circular flag, and match team flags remain rectangular.

## Out of scope

- Photo upload from library / file picker (camera-only by decision).
- Image moderation, cropping/zoom controls, multiple photos.
- Pro image-transformation/CDN resizing.
