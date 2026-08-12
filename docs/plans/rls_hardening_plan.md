# RLS Hardening (Security Debt) — Implementation Plan & TODO

*Status: ✅ COMPLETE — migration applied + live verified (11 Aug 2026). Details → `completed_tasks.md`.*
*Created: 10 Aug 2026 · Source: live anon-key audit (verify-rls.cjs + write tests)*

## 1. Why (Problem Statement)

- Frontend bundle me PUBLIC anon key hota hai — browser client (`src/lib/supabase.ts`) usi se chalata hai.
- Audit (29 tables): **6 tables anon ke liye KHULI** thi — koi bhi anon key se REST API call karke read/write kar sakta tha.
- `system_info` ka **SELECT leak critical**: `ai_api_key` (Groq), `csrf_token`, `upi_id`, `signature` publicly visible.
- `payment_reminders` → client ke due amounts (financial data) anon ko dikhte the.
- `activity_logs`, `suppliers`, `spare_supplier`, `wp_template_history` → anon READ+WRITE open (Allow-all policy).
- Baaki 23 tables already RLS-closed (empty policies = deny by default) — `scripts/fix_rls.sql` se.

## 2. Vulnerable tables (anon exposure matrix)

| Table | anon READ | anon WRITE | Action |
|---|---|---|---|
| `system_info` | ✅ OPEN — **ai_api_key/csrf_token/upi_id/signature leak** | insert blocked | anon whitelist + staff CRUD |
| `activity_logs` | ✅ OPEN | ✅ INSERT open | staff/admin only |
| `payment_reminders` | ✅ OPEN | ✅ INSERT open | staff/admin only |
| `suppliers` | ✅ OPEN | ✅ INSERT open | staff/admin only |
| `spare_supplier` | ✅ OPEN | ✅ INSERT open | staff/admin only |
| `wp_template_history` | ✅ OPEN | ✅ INSERT open | staff/admin only |
| `message_list` | hidden | ✅ INSERT (contact form chahiye) | anon INSERT only + staff all |

## 3. App-impact analysis (kya kabhi nahi tootega)

- Public site (`(public)/layout.tsx`) sirf `system_info.name` padhta hai; home sirf `cover` — anon whitelist in dono ko cover karti hai.
- `/about`, `/contact`, `/job-status` pages koi table directly read nahi karte (sirf `message_list` INSERT = contact form). ✅
- Staff pages (settings, suppliers, reports/due-reminders, activity-logs, whatsapp-templates) browser se **staff session** me chalte hain → `hardening_*_staff` policies (proven `fix_rls.sql` pattern) unhe full access deti hain.
- Client portal (`/my-account`) browser se in 6 tables me se koi bhi nahi padhta — service-role API se data leta hai. ✅
- `api/reports/ledger`, `api/reports/balancesheet`, `api/admin/clean-logs` = session-based (authenticated) → RLS-friendly; clean-logs ka DELETE already service-role. ✅
- `api/settings/signature` = **anon-key client** (system_info write) → **service-role switch karna zaroori** (done in code).
- `gemini-tools.ts` = service-role (RLS bypass) → anon fallback hata diya (done in code).

## 4. Migration — `supabase/migrations/20260910_rls_hardening.sql`

1. Drop all policies on the 7 tables (idempotent `do $$ ... pg_policies`).
2. RLS ON (idempotent).
3. `system_info`: anon SELECT whitelist (name/short_name/logo/cover/email/contact/address/owner/biz_days/biz_open/biz_close/gst_no/gstin/map_url/map_iframe/whatsapp/facebook/instagram/youtube/footer_text/announcement); authenticated non-sensitive (`meta_field not in ('ai_api_key','csrf_token')`); staff/admin full CRUD.
4. `activity_logs`, `payment_reminders`, `suppliers`, `spare_supplier`, `wp_template_history`: staff/admin full CRUD (same pattern).
5. `message_list`: anon INSERT `with check (true)` + staff/admin full.
6. End me applied-policies report.

## 5. Code changes (this repo)

- `src/app/api/settings/signature/route.ts` → `SUPABASE_SERVICE_ROLE_KEY` (requireStaff guard already hai).
- `src/lib/gemini-tools.ts` → service-role only (anon fallback hata).

## 6. Testing checklist

- [ ] Migration apply (SQL editor) — no errors, report shows policies
- [ ] anon SELECT `system_info` → only public fields (no ai_api_key/csrf_token/upi_id/signature)
- [ ] anon SELECT/INSERT on 5 staff tables → denied (empty/error)
- [ ] anon INSERT `message_list` → works (public contact form)
- [ ] staff session: settings save, supplier add, logActivity, payment reminder, template history — sab works
- [ ] client portal + print-bill + ledger + balancesheet + clean-logs regression
- [ ] public home loads (name + cover readable)
- [ ] `npx tsc --noEmit` + `npm run build` pass (done: EXIT 0)
- [ ] Deploy → Vercel (code changes) + SQL applied (DB)

## 7. Effort

| Task | Hours |
|---|---|
| Audit (anon read/write matrix + impact analysis) | 2–3 |
| Migration SQL | 1 |
| Signature route + gemini-tools fix | 0.5 |
| Live verify + regression | 1–2 |
| **Total** | **~5–7 hrs** |

---

## ⚡ EXECUTION ORDER (TODO)

1. ✅ (done 10 Aug) anon read/write audit — 6 tables vulnerable confirmed, column schemas + callers mapped
2. ✅ (done 10 Aug) App-impact analysis — public pages whitelist, staff pages safe, signature route + gemini anon fallback found
3. ✅ (done 10 Aug) `supabase/migrations/20260910_rls_hardening.sql` likha (7 tables, idempotent)
4. ✅ (done 10 Aug) `api/settings/signature` → service-role; `gemini-tools` anon fallback hata; `tsc` + `build` pass
5. ✅ (done 11 Aug) Supabase SQL editor me migration apply kariya (user) + live RLS verify (anon REST tests pass — `completed_tasks.md` dekho)
6. ✅ (done 11 Aug) Regression: client portal API service-role safe, public pages name/cover whitelisted, ai-settings service-role — sab verified
