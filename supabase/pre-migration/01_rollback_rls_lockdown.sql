-- ════════════════════════════════════════════════════════════════════════
-- 01_rollback_rls_lockdown.sql — 20260911 migration ka ULTAA (revert)
--
-- KAB CHALAO: SIRF emergency me — agar 20260911_rls_lockdown.sql apply
-- karne ke baad kuch toota ho (koi page empty / permission error) aur
-- `node scripts/verify-rls.cjs` bhi fail raha ho.
--
-- YE FILE KYA KARTI HAI:
--   Migration ki banayi hui 30 policies drop karti hai (idempotent — baar
--   baar chala sakte ho). RLS flags intentionally HATA nahi jaata: wo
--   migration se pehle bhi ON the (live probe confirmed) — RLS off karna
--   tables ko anon ke liye khol deta, wahi bug jisse lockdown tha.
--
-- ⚠️ IMPORTANT (exact restore):
--   Ye sirf MIGRATION ke naye elements hata ti hai. Migration ke section-2
--   drop-loop ne 19 tables ki PURANI policies pehle hata di thi — unhe wapas
--   laane ke liye 00_snapshot_policies.sql ka SAVED OUTPUT chahiye
--   (supabase/pre-migration/snapshot-policies-*.sql). Agar aapne wo save
--   nahi kiya ho to bhi ye rollback app ko chalane ke layak chhod deti hai
--   (staff/client reads service-role APIs se hi hote hain), bas exact purani
--   policy-definitions nahi.
--
-- PROCESS:
--   1) is file ka content SQL Editor me paste karo, RUN karo.
--   2) verify: node scripts/verify-rls.cjs <staff-email> <staff-pass>
--   3) Agar exact purani state chahiye: saved snapshot se create policy runs
--      phir se chalao.
-- ════════════════════════════════════════════════════════════════════════

-- ── Section 3: staff business CRUD ───────────────────────────────────────
drop policy if exists rlslock_client_list_staff              on public.client_list;
drop policy if exists rlslock_mechanic_list_staff            on public.mechanic_list;
drop policy if exists rlslock_expense_list_staff             on public.expense_list;
drop policy if exists rlslock_lender_list_staff              on public.lender_list;
drop policy if exists rlslock_loan_payments_staff            on public.loan_payments;
drop policy if exists rlslock_attendance_list_staff          on public.attendance_list;
drop policy if exists rlslock_inventory_list_staff           on public.inventory_list;
drop policy if exists rlslock_product_list_staff             on public.product_list;
drop policy if exists rlslock_product_locations_staff        on public.product_locations;
drop policy if exists rlslock_job_id_counter_staff           on public.job_id_counter;
drop policy if exists rlslock_transaction_products_staff     on public.transaction_products;
drop policy if exists rlslock_transaction_services_staff     on public.transaction_services;
drop policy if exists rlslock_transaction_images_staff       on public.transaction_images;
drop policy if exists rlslock_advance_payments_staff         on public.advance_payments;
drop policy if exists rlslock_mech_salary_staff              on public.mechanic_salary_history;
drop policy if exists rlslock_mech_commission_staff          on public.mechanic_commission_history;
drop policy if exists rlslock_service_list_staff             on public.service_list;
drop policy if exists rlslock_direct_sale_items_staff        on public.direct_sale_items;

-- ── Section 4: profiles ──────────────────────────────────────────────────
drop policy if exists rlslock_profiles_staff                 on public.profiles;
drop policy if exists rlslock_profiles_client_self           on public.profiles;
drop policy if exists rlslock_profiles_client_self_update    on public.profiles;

-- ── Section 5: client_list self ──────────────────────────────────────────
drop policy if exists rlslock_client_list_client_self        on public.client_list;

-- ── Section 6: portal financial (recreated — wapas hatao) ────────────────
-- NOTE: portal_transaction_list_client_own / portal_client_payments_client_own
-- migration ne TOUCH nahi ki the — wo yahan drop nahi hote.
drop policy if exists portal_transaction_list_staff           on public.transaction_list;
drop policy if exists portal_client_payments_staff            on public.client_payments;
drop policy if exists portal_direct_sales_staff               on public.direct_sales;
drop policy if exists portal_client_loans_staff               on public.client_loans;

-- ── Section 7: purchase orders + push subscriptions ──────────────────────
drop policy if exists rlslock_purchase_orders_staff           on public.purchase_orders;
drop policy if exists rlslock_purchase_order_items_staff      on public.purchase_order_items;
drop policy if exists rlslock_push_subscriptions_staff        on public.push_subscriptions;
drop policy if exists rlslock_push_subscriptions_self         on public.push_subscriptions;

-- ── Verify status ────────────────────────────────────────────────────────
select p.tablename, p.policyname
from pg_policies p
where p.schemaname = 'public'
  and (p.policyname like 'rlslock\_%'
       or p.policyname in ('portal_transaction_list_staff','portal_client_payments_staff',
                           'portal_direct_sales_staff','portal_client_loans_staff'))
order by p.tablename, p.policyname;