"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AdminPage({ title, subtitle, children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (p?.role !== "admin") {
        router.push("/");
        return;
      }
      setAllowed(true);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <p className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
          Loading...
        </p>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-[#0d1117] px-4 py-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-slate-600 text-sm mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

