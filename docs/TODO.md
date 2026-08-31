# TODO / Work Log

Har kaam ke liye: plan + todo banate hain, jo complete ho jata hai use mark karte hain.
- `[ ]` = pending / `[x]` = complete
- Commits: `docs/COMMITS.md` (agar bana ho) — warna neeche "Deployed" section.

---

## Project: Staff Messenger v2 (1-on-1 chat)

### Plan
Web-only staff messenger enhancements — auto-deployed via Vercel + Supabase.
Base messenger already live (`30aae41`). Ye round un requested features add karta hai.

### Todos

#### 1. Base messenger (prev round) — DONE
- [x] Staff messenger page + realtime presence (`30aae41`)
- [x] TeamOnline sidebar widget + Users-page presence dots/badges (`30aae41`)
- [x] Message push route (`30aae41`)
- [x] `?to=` deep link + unread badges per conversation (`30aae41`)
- [x] Fix empty "no users" bug (bad profile columns) (`8dc9a63`)
- [x] Fix own-user truncated UUID (skip self presence) (`fcd42c4`)
- [x] Fix offline/new user chat not opening (`b9b0496`)

#### 2. Messenger v2 features — DONE (code deployed, migration applied)
- [x] 3-state ticks (sent / delivered / seen) via `delivered_at` + `read_at`
- [x] Typing indicator (realtime broadcast)
- [x] Media share with client-side compress to ~50–100KB (`src/lib/media.ts`)
- [x] Public `media` bucket upload (storage path stored in `media_url`)
- [x] Delete message (+ storage file cleanup)
- [x] Unread badge on sidebar Messages icon (`RootClient.tsx`)
- [x] DB migration written: columns, RLS update fix, delete policy, bucket
- [x] Typecheck + `next build` pass
- [x] Commit `50df6c0` + push → Vercel auto-deploy
- [x] User applied migration in Supabase SQL Editor (columns confirmed)

### Pending verification (manual QA)
- [ ] Test 3-state ticks live
- [ ] Test typing indicator between two users
- [ ] Test media share + compression on mobile
- [ ] Test delete message
- [ ] Test unread sidebar badge counts/reset

#### 3. Post-v2 bug fixes + polish — DONE
- [x] Fix history not loading (inverted `deleted_at` filter returned only soft-deleted) — commit `6ca81dc`
- [x] Show user avatar in messenger (list / header / new-chat) — commit `22b2cec`
- [x] Hide global floating mobile back button on `/messages` (overlapped paperclip) — commit `44db4b3`
- [x] Fix attach-image-only send (`messages_content_check`: non-empty placeholder content for media-only) — commit `6335f9b`
- [x] Images manager: show + manage messenger `media` bucket (recursive folders + refs from `messages.media_url`) — commit `3335482`
- [x] Fix media orphan bug (client storage.remove silently failed under RLS) → server `/api/media/delete` via service_role — commit `f65dad1`
- [x] Delete-message confirmation (2-step "Confirm?") — commit (pending)

### Pending verification (manual QA — v3)
- [ ] Confirm message delete now needs 2 clicks (no accidental delete)
- [ ] Confirm deleting a media message removes image from `/images` manager (no orphan)
- [ ] Confirm `/images` shows Messages Media bucket

---

## Open Questions / Notes
- Comments Hinglish me; no emojis in UI.
- Sanitized: migration must be re-run if any part fails midway (idempotent file).
