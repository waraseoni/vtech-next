// ─── Sprint 4 #16: navbar search hook ───────────────────────────────────────
// RootClient/NavbarSearch se nikala hua search logic. Behavior 1:1 same hai —
// debounce, Ctrl+K, outside-click, 7-table parallel search समेत.
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { locPath } from "@/lib/locations";

export type SearchResult = {
  id: number | string;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  href: string;
  icon: "client" | "job" | "product" | "mechanic" | "sale" | "location" | "spot";
};

export function useNavbarSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Ctrl+K to open search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector("[data-search-input]") as HTMLInputElement;
        if (input) input.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    const like = `%${q}%`;
    const num = parseInt(q);

    try {
      const [clientRes, jobRes, prodRes, mechRes, saleRes, locRes, spotRes] = await Promise.all([
        // Clients — name, contact, address
        supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname, contact, address")
          .eq("delete_flag", 0)
          .or(
            `firstname.ilike.${like},middlename.ilike.${like},lastname.ilike.${like},contact.ilike.${like},address.ilike.${like}`
          )
          .limit(25),

        // Jobs — item, fault, job_id, code, uniq_id
        supabase
          .from("transaction_list")
          .select("id, job_id, item, fault, status, date_created")
          .eq("del_status", 0)
          .or(
            `item.ilike.${like},fault.ilike.${like},job_id.ilike.${like},code.ilike.${like},uniq_id.ilike.${like}${!isNaN(num) ? `,job_id.eq.${q}` : ""}`
          )
          .limit(25),

        // Products
        supabase
          .from("product_list")
          .select("id, name, price")
          .eq("delete_flag", 0)
          .ilike("name", like)
          .limit(25),

        // Mechanics
        supabase
          .from("mechanic_list")
          .select("id, firstname, lastname, designation, contact")
          .eq("status", 1)
          .or(`firstname.ilike.${like},lastname.ilike.${like},contact.ilike.${like}`)
          .limit(25),

        // Direct Sales — sale_code, remarks
        supabase
          .from("direct_sales")
          .select("id, sale_code, total_amount, remarks, date_created")
          .or(`sale_code.ilike.${like},remarks.ilike.${like}`)
          .limit(25),

        // Inventory Locations — zone, rack, bin, box, label, code
        supabase
          .from("locations")
          .select("id, zone, rack, bin, box, label, code, kind")
          .eq("kind", "inventory")
          .eq("status", 1)
          .eq("delete_flag", 0)
          .or(
            `zone.ilike.${like},rack.ilike.${like},bin.ilike.${like},box.ilike.${like},label.ilike.${like},code.ilike.${like}`
          )
          .limit(25),

        // Job Spots — rack (spot name)
        supabase
          .from("locations")
          .select("id, rack, kind")
          .eq("kind", "job")
          .eq("status", 1)
          .eq("delete_flag", 0)
          .ilike("rack", like)
          .limit(25),
      ]);

      const STATUS_LABELS: Record<number, string> = {
        0: "Pending",
        1: "In Progress",
        2: "Done",
        3: "Paid",
        4: "Cancelled",
        5: "Delivered",
      };
      const STATUS_COLORS: Record<number, string> = {
        0: "bg-muted/20 text-muted",
        1: "bg-blue-500/20 text-blue-400",
        2: "bg-teal-500/20 text-teal-400",
        3: "bg-emerald-500/20 text-emerald-400",
        4: "bg-red-500/20 text-red-400",
        5: "bg-purple-500/20 text-purple-400",
      };

      const out: SearchResult[] = [];

      (clientRes.data || []).forEach((r) => {
        const name = [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" ");
        out.push({
          id: r.id,
          title: name,
          subtitle: r.contact || r.address || "—",
          tag: "Client",
          tagColor: "bg-blue-500/20 text-blue-400",
          href: `/clients/${r.id}/view`,
          icon: "client",
        });
      });

      (jobRes.data || []).forEach((r) => {
        out.push({
          id: r.id,
          title: `Job #${r.job_id} — ${r.item}`,
          subtitle: r.fault || "—",
          tag: STATUS_LABELS[r.status] || "Job",
          tagColor: STATUS_COLORS[r.status] || "bg-muted/20 text-muted",
          href: `/jobs/${r.id}/view`,
          icon: "job",
        });
      });

      (prodRes.data || []).forEach((r) => {
        out.push({
          id: r.id,
          title: r.name,
          subtitle: `Rs.${r.price?.toFixed(2) || "0.00"}`,
          tag: "Product",
          tagColor: "bg-amber-500/20 text-amber-400",
          href: `/inventory/${r.id}`,
          icon: "product",
        });
      });

      (mechRes.data || []).forEach((r) => {
        const name = [r.firstname, r.lastname].filter(Boolean).join(" ");
        out.push({
          id: r.id,
          title: name,
          subtitle: `${r.designation || ""} ${r.contact ? "· " + r.contact : ""}`.trim(),
          tag: "Mechanic",
          tagColor: "bg-purple-500/20 text-purple-400",
          href: `/mechanics`,
          icon: "mechanic",
        });
      });

      (saleRes.data || []).forEach((r) => {
        out.push({
          id: r.id,
          title: `Sale ${r.sale_code}`,
          subtitle: r.remarks || `Rs.${r.total_amount?.toFixed(2)}`,
          tag: "Direct Sale",
          tagColor: "bg-pink-500/20 text-pink-400",
          href: `/direct-sales/${r.id}/view`,
          icon: "sale",
        });
      });

      (locRes.data || []).forEach((r) => {
        const path = locPath({ zone: r.zone, rack: r.rack, bin: r.bin, box: r.box });
        out.push({
          id: `loc-${r.id}`,
          title: path,
          subtitle: [r.code, r.label].filter(Boolean).join(" · ") || "—",
          tag: "Location",
          tagColor: "bg-green-500/20 text-green-400",
          href: `/inventory/locate?loc=${encodeURIComponent(path)}`,
          icon: "location",
        });
      });

      (spotRes.data || []).forEach((r) => {
        out.push({
          id: `spot-${r.id}`,
          title: r.rack,
          subtitle: "Job Spot",
          tag: "Spot",
          tagColor: "bg-orange-500/20 text-orange-400",
          href: `/jobs?spot=${r.id}`,
          icon: "spot",
        });
      });

      setResults(out);
    } catch (e) {
      logger.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => runSearch(val), 300);
  };

  const handleSelect = (href: string) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(href);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return {
    query,
    results,
    loading,
    open,
    setOpen,
    wrapRef,
    handleChange,
    handleSelect,
    clearSearch,
  };
}
