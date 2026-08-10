# V-Tech Frontend — Project Review (Audit: 10 Aug 2026)

*Status: ARCHIVE / REFERENCE — isme se koi code change nahi karna. Future kaam me guided hoga.*

## Tech Stack
- Next.js 16.3 (Turbopack + React Compiler), React 19, TypeScript 5.9
- Tailwind 4, Supabase (DB + Auth), Chart.js + Recharts
- AI: Gemini (`@google/generative-ai`) + Groq (`groq-sdk`)
- PWA: Serwist 9, Android: Capacitor 8, QR: qrcode

## Journey Timeline
| Period | Kya hua |
|---|---|
| Oct 2024–Jan 2025 | Project start, base setup |
| 2025 scattered | Auth, backup/restore, MySQL→Supabase converter |
| Nov 2025–Jan 2026 | Main sprint — 55 commits, full app features |
| 08 Aug 2026 | Storage buckets migration |
| 09 Aug 2026 | Security sprint + Client Portal (Phase 1) |
| 10 Aug 2026 | sync_plan.md (MariaDB↔Supabase) — sirf plan |

## Features Built
- Core business app: Dashboard (charts), Jobs/Repairs, Clients, Direct Sales, Inventory, Mechanics + salary + ledger, Loans/Lenders, Expenses, Messages, WhatsApp templates
- AI Chat (Gemini + Groq), per-role AI settings, WhatsApp reply generation, AI alerts
- Client Portal Phase 1: `login_allowed` toggle, `profiles.client_id`, RLS (2 tables), email OTP login, IDOR-safe onboarding
- Print views (ledger-print), PWA, Android (Capacitor 8)
- 48 API routes, 88 me auth guards (`requireStaff/Admin/Client`)
- MySQL→Supabase converter + backup/restore (round-trip 0-fail, tested)
- 12 SQL migrations (6 active, 6 archived)

## Stats
- 184 TS/TSX files, ~55k lines, 55 commits last 2 months (41 Jan 2026 me)
- 0 TypeScript errors (achha)
- 615 lint errors (577 `no-explicit-any`) + 300 warnings — cleanup pending
- README default create-next-app hai — koi onboarding docs nahi

## Security Review
- **Strong:** API auth layer — 88/48 routes guard; signup band; role-escalation locked (09 Aug); public report leaks closed; IDOR-safe client onboarding
- **⚠️ Risk:** RLS sirf 2 of ~30 tables. 414 browser-side `supabase.from()` calls + 102 direct writes RLS ke bina. Anon key browser me public hai.
  - Matlab: ~16 tables (product_list, client_list, mechanic_list, client_loans, expense_list, suppliers...) browser se directly write-able
  - Plan me intentional hai: "API guards primary, RLS defense-in-depth" — par verify pending
- 1 API route bina auth: `device-info/route.ts` (harmless dev helper — documented)

## Pending / Risks
1. **Client portal migration apply nahi hua** — `20260809_client_portal.sql` SQL editor me run pending
2. **SMTP setup pending** (free: Gmail app password / Zoho / Brevo / Resend)
3. **Client emails set + `login_allowed` toggle** pending
4. **RLS rollout** ya browser-writes → API routes shift (security debt)
5. **615 lint errors** cleanup
6. **6 unused/archived migrations** me confusion possible
7. README/docs nahi hai

## Future Possibilities (plans me already documented)
1. **Client Portal Phase 2-5** (`client_portal_plan.md`) — migration apply + SMTP + production test. Quick win, 1-2 din.
2. **MariaDB↔Supabase Sync** (`sync_plan.md` ready) — offline shop + online portal. Hub-spoke, outbox pattern, LWW conflict. Sabse bada differentiation feature, ~2-3 hafte ka project.
3. **WhatsApp Business API** — 167 references + templates + reply generation built. India me paid, business value high.
4. **AI expansion** — AI alerts, stock alerts, overdue reminders, WhatsApp auto-replies (tool-calling built).
5. **Android app polish** — signed APK production build.
6. **Code hygiene sprint** — lint cleanup, README, unused migrations archive.

## Recommended Priority Order
1. Portal live karo (migration + SMTP + test) — 1-2 din, documented, ready
2. RLS complete ya browser-writes shift — security
3. WhatsApp/AI expansion — jab business ready
4. Sync plan — sirf jab offline-first requirement pakki (sabse bada project)

## Reference Files
- `client_portal_plan.md` — portal design + security fixes (detailed)
- `sync_plan.md` — MariaDB↔Supabase sync architecture
- `implementation_plan.md` — dependency update plan
- `src/app/reports/comparison_report.md` — PHP vs Next.js comparison
- `supabase/migrations/` — schema migrations
