import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/profile` ka neutral server seed — client ke pehle read-only load
 * (auth user + profiles row + mechanic_list dropdown) ka mirror.
 * Sirf SELECT; koi write nahi. Caller cookie+RLS client pass karta hai.
 */

export type ProfileMechanicOption = { id: number; name: string };

export type ProfileSeed = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  mechanicId: string;
  mechanicName: string;
  mechanics: ProfileMechanicOption[];
};

export async function fetchProfileSeed(supabase: SupabaseClient): Promise<ProfileSeed> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No authenticated user for profile seed");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, mechanic_id, email, avatar_url")
    .eq("id", user.id)
    .single();

  // Mechanics list (PHP: mechanic_list WHERE status=1) — dropdown ke liye
  const { data: mechs } = await supabase
    .from("mechanic_list")
    .select("id, firstname, middlename, lastname")
    .eq("status", 1)
    .order("firstname");

  const mechanics: ProfileMechanicOption[] = (mechs || []).map((m) => ({
    id: m.id,
    name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
  }));

  let mechanicId = "";
  let mechanicName = "";
  if (profile?.mechanic_id) {
    mechanicId = String(profile.mechanic_id);
    const linked = mechanics.find((m) => m.id === profile.mechanic_id);
    if (linked) mechanicName = linked.name;
  }

  return {
    userId: user.id,
    email: profile?.email || user.email || "",
    fullName: profile?.full_name || user.email?.split("@")[0] || "",
    role: profile?.role || "staff",
    avatarUrl: profile?.avatar_url || null,
    mechanicId,
    mechanicName,
    mechanics,
  };
}
