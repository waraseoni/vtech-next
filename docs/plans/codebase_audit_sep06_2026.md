# Codebase Audit Report + Todo (Sep 06, 2026)

> Ye file full-project audit ka result hai: (A) complexity report, (B) dead/useless code list,
> (C) permanent safe list, (D) prioritized improvement todo.

---

## A. Complexity Report

- **Scale:** 338 `.ts/.tsx` files, ~119,000 lines `src/` me. ~3000-line pages, `~30%` report copy-paste.
- **Rating:** 7.5/10 — dukaan software, medium-SaaS jitni architecture complexity.

### A1. Monolith pages (sabse bada rog)
| File | Lines | Problem |
|---|---|---|
| `src/app/jobs/page.tsx` | 3,232 | 35+ useState, 6 parallel queries, 5+ modals inline |
| `src/app/clients/[id]/view/page.tsx` | 2,682 | Profile+ledger+jobs+payments+loan sab ek |
| `src/app/RootClient.tsx` | 2,053 | Sidebar (40+ items) + universal search + AI drawer |
| `src/app/(dashboard)/dashboard/page.tsx` | 1,821 | 12-month revenue loop (24+ db calls) inline |
| `src/app/settings/page.tsx` | 1,760 | 10+ unrelated settings, 35+ useState |
| `src/lib/gemini-tools.ts` | 1,369 | AI tool dispatch monolith |
| Others 1000+ | 15+ files | jaise inventory, salary, ledger reports |

### A2. Duplication hotspots
- Reports folder: **16,489 lines / 27 pages** — `inr()` formatter 5+ jagah, `StatCard`/`LoadingBlock` copy-paste, date nav + desktop/mobile dual render + print handler har page par dubaara. ~30% (4-5k lines) shared `ReportLayout` se hat sakti hain.
- `STATUS_MAP`: **4 alag jagah** (`status-colors.ts`, `jobs/page.tsx`, `RootClient.tsx`, `gemini-tools.ts`).

### A3. Architecture concerns
- **312 direct `supabase.from()` browser se** (113 files) — critical logic (jobs, ledger, profit) client-side, koi consistent server-validation nahi; RLS hi asli boundary.
- 80 API routes me se **22 sirf print endpoints**; baaki admin/license/push/AI ke liye.

### A4. Kya theek hai (fairness)
- Push layering (`push.ts` → `push-send.ts` → `notify.ts`) sahi hai.
- `useAppBoot.ts` (auth timeout/retry, idle, theme, presence) — over-engineered nahi, real edge cases.
- AI multi-provider (Gemini/Groq) + camera fallback (native→web) intentional hain.

---

## B. Dead / Useless Code List

### B1. Delete karne layak (confirmed dead)
- [ ] `src/lib/notify.ts` — 115 lines, **0 imports**, koi call nahi karta.
- [ ] `src/app/salary/page.tsx` + `src/app/salary/[id]/ledger/page.tsx` — `next.config.ts:55-60` permanent redirect ke peeche **unreachable** (copy `mechanics/salary` + `mechanics/[id]/ledger` me hai).
- [ ] `package.json` scripts `version:patch/minor/major` — semantic-release hi versioner hai, kabhi use nahi hote.
- [ ] `autoprefixer` dependency — Tailwind v4 khud prefixing karta hai.

### B2. Repo hygiene (disk junk ~80MB; sab gitignored, git clean)
- [ ] `vtech_backup_converted.json`, `vtech_backup_converted_090826.json`, `vtech_backup_restore.json` (~24MB each)
- [ ] `vtech-pro-release.apk` (8MB)
- [ ] `scratch/`, `.freebuff/`, stale root `sync_plan.md`
- [ ] `backups/env store/` me **plaintext `.env.local` secrets** → kisi secure place (password manager) par shift karna (credential risk).
- [ ] `.gitignore` stale rules: `src/app/backup/page_100%*` (:95) + `src/app/salary/*page - Copy.tsx*` (:96) — ye copies ab exist nahi karte; `/out/` rule duplicate (:17).

### B3. Missing safety nets
- [ ] Tests: **654 lines vs ~119k source (~0.5%)** — sirf 6 `src/lib/*.test.ts`.
- [ ] Dual-era `activity_logs`/`meta_id` reader (flagged bug area) — koi test nahi.
- [ ] `vitest.config.mts:23` coverage sirf `src/lib/**` — pages/routes excluded.

---

## C. 🛡 PERMANENT SAFE LIST (hamesha ke liye saf / kabhi delete nahi)

- **P1. `src/app/jobs/old/page.tsx` + `src/app/jobs/[id]/old/page.tsx`** — KEEP FOREVER.
  - **Kyu:** Naam "old" hai par ye page bahut kaam ka hai. Inse **manually chosen old IDs** ke saath entries hain jo DB me entry suru hone **se pahle** banayi jati thi. `jobs/new` + `jobs/[id]/edit` **hamesha nayi id auto-generate** karte hain — wo **purani id ka sync tod dete**. Users purane time me saare IDs manually banate the, isliye in pages ko kisi bhi cost par chhodna nahi.
  - **Action:** In files ko kabhi delete/refactor nahi karna. `RootClient.tsx` me unke links bhi rakhte jana.
  - **Note:** Ye dono files aapas me identical hain aur `src/app/jobs/page.tsx` ke 4 jagah se link hain (`/jobs/old`, `/jobs/:txn.id/old`) — ye links intentional hain, remove nahi karna.

---

## D. Prioritized Todo List (baki sudhar)

### Phase 1 — Safe cleanup (chhota + low risk)
- [ ] Delete `src/lib/notify.ts`
- [ ] Remove `autoprefixer` dep
- [ ] Prune `version:patch/minor/major` scripts (ya `deprecated:` note likho)
- [ ] `.gitignore` stale rules cleanup + root junk delete (~80MB)
- [ ] `backups/env store/` secrets kisi password manager me shift + delete

### Phase 2 — Unreachable pages
- [ ] `src/app/salary/*` — ya delete, ya redirects hata kar `mechanics/salary` me merge
- [ ] Confirm `jobs/old` links ki reachability QA me (safe list, sirf verify, delete nahi)

### Phase 3 — Test hardening
- [ ] Unit test: dual-era `fetchStatusChangeLogs` (legacy + modern merge) — `DATA_MIGRATION_NOTES.md` referenced
- [ ] Unit tests for `boxPrint.ts` (itemsLayout/font fit — currently untested)
- [ ] 1-2 component tests (testing-library already installed)
- [ ] `vitest.config.ts` me kuch pages bhi coverage me lao

### Phase 4 — Refactor (big, priority dhyan se)
- [ ] Shared `ReportLayout` + `inr()`/`fmtDate`/`StatCard` util extract (reports ~30% cut)
- [ ] Single source `STATUS_MAP` (status-colors.ts canonical; baaki import karein)
- [ ] Monolith split: `jobs/page.tsx` → components (job list / filters / modals / mobile cards)
- [ ] Monolith split: `settings/page.tsx` → per-domain settings components
- [ ] Server data-access tier: writes kisi route/server-action se, client sirf read (RLS + validation)

---

Verification commands:
- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint`
- `npm test`