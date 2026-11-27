-- K8/B1 hotfix — next_brand_job_no() must be VOLATILE.
--
-- Root cause: pehle function `STABLE` tha. PostgreSQL me STABLE/IMMUTABLE
-- functions ke commands READ-ONLY mode me chalte hain, isliye andar ka
-- `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` fail ho raha tha. Browser
-- helper error ko silently null kar deta tha, aur job bina brand_job_no ke
-- save ho jata tha (brand_id phase bhi tha).
--
-- Fix: VOLATILE — counter increment likhne ke liye sahi volatility class.
-- Signature/grants/index/column unchanged. Global job_id untouched.
--
-- Owner apply karein; agent live DB write nahi karta.
--
-- Verify:
--   select p.provolatile
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname='next_brand_job_no';
--   -- expected: v  (VOLATILE)
--
-- Rollback (sirf agar wapas STABLE karna ho — recommended nahi):
--   alter function public.next_brand_job_no(integer, text) stable;

alter function public.next_brand_job_no(integer, text) volatile;

notify pgrst, 'reload schema';
