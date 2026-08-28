import { useEffect, useState } from "react";
import { supabase, getCachedUser } from "@/lib/supabase";

export function useRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getRole() {
      const {
        data: { user },
      } = await getCachedUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setRole(data?.role || "staff");
      }
      setLoading(false);
    }
    getRole();
  }, []);

  return { role, loading };
}
