"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isOnline, type Presence } from "@/lib/messaging";
import { subscribePresence } from "@/lib/presence";
import { MessageSquare } from "lucide-react";

type TeamMember = { id: string; full_name: string | null; role: string | null };

// Sidebar me compact "Team online" strip — kisi user ko messages page par laana.
export function TeamOnline() {
  const [online, setOnline] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);

  const refresh = async () => {
    try {
      const [{ data: profs }, { data: pres }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role"),
        supabase.from("user_presence").select("user_id, status, last_seen"),
      ]);
      const plist = (profs || []) as TeamMember[];
      const pm: Record<string, Presence> = {};
      (pres || []).forEach((r) => (pm[r.user_id] = { status: r.status, last_seen: r.last_seen }));
      setTotal(plist.length);
      setOnline(plist.filter((p) => isOnline(pm[p.id])));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void refresh();
    const sub = subscribePresence(() => void refresh());
    return () => sub.unsubscribe();
  }, []);

  return (
    <Link
      href="/messages"
      className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl hover:bg-white/[0.04] transition-colors group"
    >
      <span className="relative flex-shrink-0">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center" />
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d1117]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-slate-200 truncate">Team online</span>
        <span className="block text-[10px] text-slate-500 truncate">
          {online.length > 0
            ? online.map((m) => m.full_name || "User").join(", ")
            : "Abhi koi online nahi"}
        </span>
      </span>
      {online.length > 0 && (
        <MessageSquare
          size={13}
          className="ml-auto text-slate-500 group-hover:text-blue-400 flex-shrink-0"
        />
      )}
    </Link>
  );
}
