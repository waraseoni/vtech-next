# CHANGELOG

Is project ka change log **automatically** `semantic-release` se generate hota hai
(conventional commits → changelog + semver version + git tag + GitHub Release).

Jo bhi release hoga, uski entries neeche isi file me peg hoti hain. Manual edit karne
ki zaroorat nahi — yeh file `v1.0.0` release se aage auto-update hoti hai.

## [1.0.0] - 2026-09-03

Stable baseline. Is release tak ke major capability areas (pehla tagged/stable version):

### Added
- **Messenger** — staff 1-on-1 chat with realtime presence (team online + last seen),
  push notifications, media share with compression, 3-state ticks (sent/delivered/read),
  typing indicator, message delete (2-step confirm), unread sidebar badge, supervision
  tool (admin/developer read-only), image/media manager for the `media` bucket.
- **Theme system** — System / Dark / Light mode toggle (theme-aware UI), screen-aware
  and theme-aware theme dropdown.
- **Native Android app** (Capacitor) — pull-to-refresh, hardware back button override,
  in-app preview for print routes, native print/export bridge (printer, filesystem,
  share), camera via Capacitor, edge-swipe back/forward gestures.
- **Attendance redesign** — live IST clock header, biometric punch card, KPI stats,
  date navigator, monthly heatmap matrix, mobile cards.
- **Reports** — Vyapar Darshan rewrite, customer report, daily-done & delivered redesign,
  jobs-in-shop, top-customers balance.
- **Salary page** — redesigned for PC and mobile with executive KPIs.
- **Expenses** — pay-outs page redesign for mobile with avatars, KPI cards, searchable dropdown.

### Fixed
- Webview pull-to-refresh reliability (non-passive touchmove preventDefault).
- Messenger media orphan (delete storage file via service role API route).
- Messenger history load on refresh with `?to=`; inverted `deleted_at` filter.
- Theme toggle not overridden by OS prefers-color-scheme.
- Client avatar normalization (`safeImageSrc`) to prevent invalid URL crash.
- Typing indicator / presence realtime subscriptions.
- Unread messenger badge (per-user count + RLS so read status persists).
- Client view page speed (parallel queries, N+1 removal).
- Jobs page rupee/em-dash mojibake.

### Performance
- Client profile view page: all 7 Supabase queries parallelized; eliminated loans N+1.
