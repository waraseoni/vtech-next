import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/attendance` ka page-level server seed — client ke session+`profiles`
 * (role, mechanic_id) lookup ka read-only mirror. Caller cookie+RLS client
 * pass karta hai, isliye RLS wahi rows deta hai jo client ko milti hain.
 *
 * DailyAttendance / MonthlyReport apna data khud fetch karte hain (date/month
 * URL params par depend karta hai) — seed sirf header/tabs ka first paint
 * kholta hai.
 */

export type AttendanceUserRole = "admin" | "staff" | "developer";

export type AttendanceSeed = {
  userRole: AttendanceUserRole;
  mechanicId: number | null;
};

export async function fetchAttendanceSeed(supabase: SupabaseClient): Promise<AttendanceSeed> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No session");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, mechanic_id")
    .eq("id", user.id)
    .single();
  // Client bhi missing profile par defaults ("staff" / null) hi rakhta hai.
  return {
    userRole: (profile?.role as AttendanceUserRole) || "staff",
    mechanicId: (profile?.mechanic_id as number | null) ?? null,
  };
}
