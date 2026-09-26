// ─── Outside-Work Audit — bahar se hua har kaam, ek jagah ───────────────
// Staff geofence Phase 6 (user demand): activity_logs ki geo-tagged entries
// (geo_lat NOT NULL) — kaun staff, kahan se, kya change, kab.
// GUARDRAILS (plan me documented): sirf admin/developer dekh sakte hain;
// staff ko banner/badge me bataya jata hai ki bahar-kaam ki location save
// hoti hai; real-time tracking nahi (sirf tagged work entries).
// NOTE: tagging code deploy ke baad ki entries hi dikhengi — purani rows
// me geo NULL hai (empty state wahi batata hai).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Loader2, Search } from "lucide-react";
import { supabase, getCachedUser } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { DataTable, type Column } from "@/components/ui";
import { GeoPin } from "@/app/components/ViewOnlyBanner";
import { formatIST } from "@/lib/dateUtils";

interface OutsideRow {
  id: number;
  user_id: number;
  action: string;
  module: string;
  meta_id: string | null;
  details: string | null;
  date_created: string;
  geo_lat: number;
  geo_lng: number;
  geo_distance_m: number | null;
  staffName?: string;
}

export default function OutsideWorkPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OutsideRow[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await getCachedUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (myProfile?.role !== "admin" && myProfile?.role !== "developer") {
        router.push("/");
        return;
      }
      // Sirf geo-tagged (bahar se hua kaam) — latest 500, bounded
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, user_id, action, module, meta_id, details, date_created, geo_lat, geo_lng, geo_distance_m")
        .not("geo_lat", "is", null)
        .order("date_created", { ascending: false })
        .limit(500);
      if (error) {
        // Columns abhi apply nahi hue (migration pending) → seedha batao
        if (error.code === "42703" || /geo_lat/i.test(error.message)) {
          throw new Error("Geo columns abhi DB me nahi — migration chalao (20260927_activity_geo_tags.sql)");
        }
        throw error;
      }
      const logs = (data || []) as OutsideRow[];
      // Staff names: user_id = mechanic_list.id (0 = Admin) — geo rows modern hain
      const ids = [...new Set(logs.map((l) => Number(l.user_id)).filter((x) => x > 0))];
      let nameMap = new Map<number, string>();
      if (ids.length) {
        const { data: mechs } = await supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname")
          .in("id", ids);
        nameMap = new Map(
          (mechs || []).map((m) => [
            m.id,
            [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ").trim() || `Staff #${m.id}`,
          ])
        );
      }
      setRows(
        logs.map((l) => ({
          ...l,
          staffName: Number(l.user_id) === 0 ? "Admin" : nameMap.get(Number(l.user_id)) || `Staff #${l.user_id}`,
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load fail hua");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        (r.staffName || "").toLowerCase().includes(t) ||
        r.action.toLowerCase().includes(t) ||
        r.module.toLowerCase().includes(t)
    );
  }, [rows, q]);

  // Record link (reports/activity wala pattern): modern logs me meta_id =
  // canonical PK hai — /jobs/[id]/view PK se resolve karta hai (verified).
  const recordLink = (module: string, id: string | null) => {
    if (!id || id === "0") return null;
    const m = module.toLowerCase();
    if (m.includes("transaction") || m.includes("job")) return `/jobs/${id}/view`;
    if (m.includes("client")) return `/clients/${id}/view`;
    if (m.includes("mechanic")) return `/mechanics/${id}`;
    if (m.includes("sale")) return `/sales/view/${id}`;
    if (m.includes("inventory") || m.includes("product")) return `/inventory`;
    return null;
  };

  const columns: Column<OutsideRow>[] = useMemo(
    () => [
      {
        key: "date_created",
        header: "Kab",
        render: (r) => (
          <span className="text-[11px] font-bold text-muted whitespace-nowrap">
            {formatIST(r.date_created, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        ),
      },
      { key: "staffName", header: "Staff", render: (r) => <span className="font-black text-white text-xs">{r.staffName}</span> },
      {
        key: "job",
        header: "Job / Record",
        render: (r) => {
          const link = recordLink(r.module, r.meta_id);
          const isJob = /job|transaction/i.test(r.module);
          if (!link) return <span className="text-[11px] text-muted">—</span>;
          return (
            <Link
              href={link}
              className="text-xs font-black text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 whitespace-nowrap"
            >
              {isJob ? `Job #${r.meta_id}` : r.meta_id || "Kholo"}
            </Link>
          );
        },
      },
      {
        key: "action",
        header: "Kya Kiya",
        render: (r) => {
          const link = recordLink(r.module, r.meta_id);
          return link ? (
            <Link href={link} className="text-xs text-app-2 hover:text-white hover:underline underline-offset-2">
              {r.action}
            </Link>
          ) : (
            <span className="text-xs text-app-2">{r.action}</span>
          );
        },
      },
      { key: "module", header: "Module", render: (r) => <span className="text-[11px] text-muted">{r.module}</span> },
      {
        key: "geo",
        header: "Kahan Se",
        render: (r) => (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-300">
            <GeoPin lat={r.geo_lat} lng={r.geo_lng} distanceM={r.geo_distance_m} />
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-app font-sans pb-16">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-panel-2 border border-app hover:bg-panel-2 text-muted rounded-lg text-xs font-bold transition"
          >
            <ArrowLeft size={12} /> Reports
          </Link>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <MapPin size={18} className="text-sky-400" /> Bahar Se Hua Kaam
          </h1>
        </div>

        <p className="text-[11px] text-muted mb-4 bg-panel border border-app rounded-xl px-4 py-2.5">
          Sirf office ke <b>bahar</b> se hue kaam (permit/outside) — staff ko banner me bataya jata
          hai ki bahar-kaam ki location yahan save hoti hai. Office ke kaam is list me{" "}
          <b>kabhi nahi</b> aate. Sirf admin/developer dekh sakte hain.
        </p>

        <div className="relative mb-4">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Staff / kaam / module search…"
            className="w-full max-w-sm pl-10 pr-4 py-2.5 bg-panel border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500/60 transition"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={26} className="animate-spin text-muted-2" />
          </div>
        ) : (
          <DataTable<OutsideRow>
            data={filtered}
            columns={columns}
            keyField="id"
            totalItems={filtered.length}
            emptyMessage="Abhi koi bahar-kaam logged nahi — tagging code deploy + asli bahar-kaam ke baad yahan dikhega"
          />
        )}
      </div>
    </div>
  );
}
