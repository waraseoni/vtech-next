-- 20260917_peek_preview_job_id.sql
-- PLAY PREVIEW job-id (non-claiming) + counter auto-heal
--
-- 1) peek_next_job_id()  — next_job_id() ke ULTA: sirf PREVIEW value return
--    karta hai, counter INCREMENT/CLAIM NAHI karta. Form (new/bulk) par jo
--    "Job No." dikhta hai wo isi se aata hai, taaki page kholne bhar se IDs
--    waste na hon. Asli claim hamesha save-par ATOMIC next_job_id() se hota
--    hai (20260916 migration).
--
-- 2) Counter sync  — agar kabhi counter actual max job_id se aage nikal jaye
--    (jaise tab jab preview/verify ke liye IDs claim ho jayen par job na
--    bane), to is UPDATE se wapas actual max par aa jata hai. Idempotent:
--    kabhi bhi re-run kar sakte hain.
--
-- Re-runnable: CREATE OR REPLACE + IF NOT EXISTS wali cheezon se safe.

-- ── 1) Read-only preview RPC ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.peek_next_job_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  SELECT COALESCE(last_job_id, 0) + 1
    INTO next_val
    FROM public.job_id_counter
   WHERE id = 1;

  IF next_val IS NULL THEN
    -- Counter row missing — fallback: max numeric job_id se (>=28101 floor).
    SELECT GREATEST(COALESCE(MAX((job_id)::bigint), 0), 28100) + 1
      INTO next_val
      FROM public.transaction_list
     WHERE job_id ~ '^[0-9]+$';
  END IF;

  RETURN next_val;
END;
$$;

REVOKE ALL ON FUNCTION public.peek_next_job_id() FROM public;
GRANT EXECUTE ON FUNCTION public.peek_next_job_id() TO anon;
GRANT EXECUTE ON FUNCTION public.peek_next_job_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_next_job_id() TO service_role;

-- ── 2) Counter self-heal (idempotent) ───────────────────────────────────────
UPDATE public.job_id_counter
   SET last_job_id = GREATEST(
         COALESCE(
           (SELECT MAX((job_id)::bigint)
              FROM public.transaction_list
             WHERE job_id ~ '^[0-9]+$'),
           0
         ),
         28100
       )
 WHERE id = 1;