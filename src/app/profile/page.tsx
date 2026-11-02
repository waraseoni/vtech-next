import { Suspense } from "react";
import ProfileClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchProfileSeed } from "./profileSeed";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const initial = await loadStaffSeed("Profile", (supabase) => fetchProfileSeed(supabase));
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <ProfileClient initial={initial} />
    </Suspense>
  );
}
