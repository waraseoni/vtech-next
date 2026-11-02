import { Suspense } from "react";
import AttendanceClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchAttendanceSeed } from "./attendanceSeed";

export const metadata = {
  title: "Attendance Hub — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  // Profile (role + mechanic_id) server par seed hota hai — header/tabs ka
  // first paint turant; tab data (daily/monthly) apna fetch client me karta hai.
  const initial = await loadStaffSeed("Attendance", (supabase) => fetchAttendanceSeed(supabase));

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <AttendanceClient initial={initial} />
    </Suspense>
  );
}
