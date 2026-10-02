-- ============================================================================
-- 20261002_attendance_derived_cols.sql
-- attendance_list — derived working-hours columns (P3, docs/ATTENDANCE_DUTY_HOURS_PLAN.md §4.3)
--
-- Kyun: auto-checkout/OT ab sirf read-time derive hote hain (display ke liye
-- bilkul sahi). Par "din band hone" par audit trail chahiye — kaun sa din
-- auto-close hua, us din ka worked/OT kitna tha (salary P4 me isi par aayegi).
--
-- Design:
--   * Columns NULLABLE (worked_min/duty_min) → purani rows par koi backfill
--     nahi; reader hamesha pehle live value nikaalta hai, persist sirf audit.
--     Backfill free hai: NULL time_out wali purani rows read-time par duty_end
--     se nikal hi jaati hain (plan §4.3).
--   * is_auto_closed = true ka matlab: time_out DB me "duty_end" likha gaya hai
--     (staff ne checkout nahi kiya tha) — OT rule me iska matlab 0 OT.
--   * ot_min: sirf ACTUAL late checkout par > 0 (auto-closed din me kabhi nahi).
--   * Ye columns sirf day-close events par bharte hain:
--       - report header ka "Close pending days" button (admin)
--       - staff ka real check-out (DailyAttendance handleSelfAction)
--       - admin edit save (AttendanceModal)
--     Baki sab kuch read-time derive rehta hai (cron infra exist nahi karti).
--
-- Follows repo conventions (guard-style idempotent, baar baar run safe).
-- Apply: Supabase SQL Editor me ek baar. Verify:
--   select column_name, data_type, column_default from information_schema.columns
--   where table_schema='public' and table_name='attendance_list'
--     and column_name in ('worked_min','ot_min','duty_min','is_auto_closed');
-- ============================================================================

alter table public.attendance_list
  add column if not exists worked_min integer;          -- time_in → effective out (min)

alter table public.attendance_list
  add column if not exists ot_min integer not null default 0;   -- auto-closed = hamesha 0

alter table public.attendance_list
  add column if not exists duty_min integer;            -- uss din ki duty (end-start-break)

alter table public.attendance_list
  add column if not exists is_auto_closed boolean not null default false;

-- (Column additions par koi naya grant/policy zaroorat nahi — table grants +
--  existing RLS policies row-level hain, columns par apply hoti rehti hain.)

NOTIFY pgrst, 'reload schema';

-- Report
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'attendance_list'
  and column_name in ('worked_min', 'ot_min', 'duty_min', 'is_auto_closed')
order by ordinal_position;
