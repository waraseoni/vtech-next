"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, getCachedUser } from "@/lib/supabase";
import { fetchStockByProducts } from "@/lib/inventoryStock";
import PageLoader from "@/components/PageLoader";
import {
  ClipboardList,
  ListChecks,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  Search,
} from "lucide-react";

// ── BOM input parsing (spec §2.2) ───────────────────────────────────────────
// Supported per line:
//   "NE555 Timer IC - 2"         → name, qty 2
//   "4x IRF540N MOSFET"          → qty 4, name
//   "10k Resistor (10)"          → name, qty 10
//   "BC547 Transistor 5"         → name, qty 5
function parseBOMLine(raw: string): { name: string; qty: number } | null {
  const line = raw.trim();
  if (!line) return null;

  // trailing "- N" or trailing "N" (digits) or "(N)"
  let body = line;
  let qty = 1;

  const dash = line.match(/^\s*(.*?)\s*[-–:]\s*(\d+)\s*$/);
  const paren = line.match(/^\s*(.*?)\s*\((\d+)\)\s*$/);
  const trail = line.match(/^\s*(.*?)\s+(\d+)\s*$/);
  const leadX = line.match(/^\s*(\d+)\s*[xX]\s*(.*?)\s*$/);

  if (dash) {
    body = dash[1];
    qty = parseInt(dash[2], 10);
  } else if (paren) {
    body = paren[1];
    qty = parseInt(paren[2], 10);
  } else if (trail && !/^\d+$/.test(line)) {
    body = trail[1];
    qty = parseInt(trail[2], 10);
  } else if (leadX && leadX[2]) {
    body = leadX[2];
    qty = parseInt(leadX[1], 10);
  }

  const name = body.trim();
  if (!name) return null;
  return { name, qty: Math.max(1, qty) };
}

// ── Matching (spec §2.3) + scoring ──────────────────────────────────────────
type Product = {
  id: number;
  name: string;
  description: string;
  barcode: string | null;
  alert_quantity: number;
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function scoreMatch(query: string, p: Product): number {
  const q = normalize(query);
  const name = normalize(p.name);
  const desc = normalize(p.description || "");
  const barcode = normalize(p.barcode || "");

  if (name === q) return 100; // exact
  const isBarcode = /^[0-9]+$/.test(q);
  if (isBarcode && barcode === q) return 95; // barcode exact
  if (name.includes(q) || q.includes(name)) return 80; // substring name
  const firstToken = name.split(/\s+/)[0];
  if (firstToken && firstToken === q) return 85; // first-token
  if (desc.includes(q)) return 60; // description fallback
  return 0;
}

function bestMatch(query: string, products: Product[]): Product | null {
  let best: Product | null = null;
  let bestScore = 0;
  for (const p of products) {
    const s = scoreMatch(query, p);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}

// ── BOM line result + status classification (spec §2.4) ─────────────────────
type BomStatus = "available" | "low" | "insufficient" | "outofstock" | "notfound";

type BomLine = {
  key: string;
  rawName: string;
  qty: number;
  product?: Product;
  status: BomStatus;
  available: number;
  deficit: number;
};

const STATUS_META: Record<
  BomStatus,
  { label: string; chip: string; dot: string }
> = {
  available: {
    label: "Available",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  low: {
    label: "Low stock",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  insufficient: {
    label: "Insufficient",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dot: "bg-orange-500 dark:bg-orange-400",
  },
  outofstock: {
    label: "Out of stock",
    chip: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    dot: "bg-red-500 dark:bg-red-400",
  },
  notfound: {
    label: "Not in catalog",
    chip: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
    dot: "bg-slate-500",
  },
};

type Supplier = { id: number; name: string; contact: string };

// Sample BOM presets (spec §5 Phase 1 step 3)
const SAMPLE_BILLS = [
  {
    name: "555 Astable",
    lines: "NE555 Timer IC - 2\n1k Resistor (2)\n10k Resistor\n100nF Capacitor - 2\nLED - 1",
  },
  {
    name: "Arduino Sensor Node",
    lines: "Arduino Nano\nDHT11 Sensor - 2\n10k Resistor - 4\nBreadboard\nJumper Wires - 1",
  },
  {
    name: "Motor Driver",
    lines: "L298N Module\nIRF540N MOSFET - 4\n12V DC Motor - 2\n1N4007 Diode - 4\n100nF Capacitor - 4",
  },
];

export default function BomCheckPage() {
  const [roleChecked, setRoleChecked] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [input, setInput] = useState("");
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Map<number, Supplier[]>>(new Map());
  const [lines, setLines] = useState<BomLine[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Guard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    getCachedUser().then(({ data: { user } }) => {
      if (!user) {
        setRoleChecked(true);
        return;
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(() => setRoleChecked(true));
    });
  }, []);

  if (!roleChecked) {
    return <PageLoader icon={ClipboardList} label="Loading BOM Checker..." tone="cyan" />;
  }

  // ── Load catalog once ─────────────────────────────────────────────────────
  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const [{ data: pl }, { data: suppliersRows }, { data: spareLink }] = await Promise.all([
        supabase
          .from("product_list")
          .select("id, name, description, barcode, alert_quantity")
          .eq("delete_flag", 0)
          .eq("status", 1),
        supabase.from("suppliers").select("id, name, contact").eq("delete_flag", 0).eq("status", 1),
        supabase.from("spare_supplier").select("spare_id, supplier_id"),
      ]);
      const prods: Product[] = (pl || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        barcode: p.barcode ?? null,
        alert_quantity: p.alert_quantity ?? 0,
      }));
      setCatalog(prods);

      const suppById = new Map<number, Supplier>();
      (suppliersRows || []).forEach((s) => suppById.set(s.id, { id: s.id, name: s.name, contact: s.contact || "" }));
      const bySpare = new Map<number, Supplier[]>();
      (spareLink || []).forEach((l) => {
        const s = suppById.get(l.supplier_id as number);
        if (!s) return;
        const arr = bySpare.get(l.spare_id as number) || [];
        arr.push(s);
        bySpare.set(l.spare_id as number, arr);
      });
      setSuppliers(bySpare);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // ── Run check ─────────────────────────────────────────────────────────────
  const runCheck = async () => {
    if (!input.trim()) return;
    setError(null);
    setAnalysis(null);
    if (catalog.length === 0) await loadCatalog();
    const parsed = input
      .split("\n")
      .map(parseBOMLine)
      .filter((x): x is { name: string; qty: number } => x !== null);

    if (parsed.length === 0) {
      setError("Koi component line nahi mili. Har line pe ek component likhein.");
      return;
    }

    const productIds = new Set<number>();
    const matched: { parsedName: string; qty: number; best: Product | null }[] = parsed.map((p) => {
      const best = bestMatch(p.name, catalog);
      if (best) productIds.add(best.id);
      return { parsedName: p.name, qty: p.qty, best };
    });

    let stockMap = new Map<number, { available: number }>();
    try {
      stockMap = await fetchStockByProducts([...productIds]);
    } catch {
      // stock read fails → treat all matched as 0 available, still render
    }

    const built: BomLine[] = matched.map((m, i) => {
      const product = m.best;
      if (!product) {
        return {
          key: `${i}-${m.parsedName}`,
          rawName: m.parsedName,
          qty: m.qty,
          status: "notfound",
          available: 0,
          deficit: m.qty,
        };
      }
      const available = stockMap.get(product.id)?.available ?? 0;
      const needed = m.qty;
      let status: BomStatus;
      if (available <= 0) status = "outofstock";
      else if (available < needed) status = "insufficient";
      else if (available <= Math.max(1, product.alert_quantity)) status = "low";
      else status = "available";
      return {
        key: `${i}-${product.id}`,
        rawName: m.parsedName,
        qty: needed,
        product,
        status,
        available,
        deficit: Math.max(0, needed - available),
      };
    });

    setLines(built);
  };

  const goStatus = (): "go" | "hold" => {
    if (!lines || lines.length === 0) return "hold";
    return lines.every((l) => l.status === "available" || l.status === "low") ? "go" : "hold";
  };

  // ── AI summary via existing /api/chat (Phase 2) ───────────────────────────
  const runAnalysis = async () => {
    if (!lines) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const section = (label: string, list: BomLine[]) =>
        list.length
          ? `${label}:\n${list
              .map(
                (l) =>
                  `  - ${l.product?.name || l.rawName} | need ${l.qty} | have ${l.available}${
                    l.status === "insufficient" || l.status === "outofstock" ? ` | deficit ${l.deficit}` : ""
                  }`
              )
              .join("\n")}`
          : `${label}: none`;

      const prompt = [
        "You are an electronics workshop inventory assistant.",
        `Technician submitted a BOM for project: ${projectName || "unspecified"}.`,
        "",
        "BOM Results:",
        section("Available", lines.filter((l) => l.status === "available")),
        section("Low stock", lines.filter((l) => l.status === "low")),
        section("Insufficient", lines.filter((l) => l.status === "insufficient")),
        section("Out of stock", lines.filter((l) => l.status === "outofstock")),
        section("Not found", lines.filter((l) => l.status === "notfound")),
        "",
        "Answer in Hindi/Hinglish. 3-4 lines max:",
        "1) Kya project shuru kar sakte hain? (haan/nahi + ek reason)",
        "2) Urgent order kya karna hai?",
        "3) Missing parts ke common substitutes?",
      ].join("\n");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, type: "chat", messages: [] }),
      });
      const text = await res.text();
      let data: { response?: string; error?: string; details?: string } = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }
      if (!res.ok || !data.response) {
        setError(data.error ? `AI error: ${data.details || data.error}` : "AI summary nahi aa paya.");
      } else {
        setAnalysis(data.response);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const hasIssues = lines?.some((l) => l.status !== "available" && l.status !== "low") ?? false;
  const availCount = lines?.filter((l) => l.status === "available" || l.status === "low").length ?? 0;
  const issueCount = lines?.filter((l) => l.status === "outofstock" || l.status === "insufficient" || l.status === "notfound").length ?? 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117] font-sans pb-16">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-[#21293d]">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute -top-10 right-10 w-48 h-48 bg-emerald-600/8 rounded-full blur-2xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-emerald-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-500/30">
                  <ListChecks size={26} className="text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/inventory" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">
                    Inventory
                  </Link>
                  <span className="text-slate-400 dark:text-slate-700 text-xs">/</span>
                  <span className="text-xs text-slate-800 dark:text-slate-300">BOM Check</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                  BOM Checker
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                  Component list paste karein — live stock + AI Hinglish summary.
                </p>
              </div>
            </div>
            <button
              onClick={() => { void loadCatalog(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#21293d] dark:hover:bg-[#2a3348] text-slate-600 dark:text-slate-300 text-sm font-semibold transition-colors"
            >
              <RefreshCw size={15} /> Reload Catalog
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-5 gap-6">
        {/* ── Input ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className="text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">BOM input</h2>
            </div>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name (optional)"
              className="mb-3 w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"NE555 Timer IC - 2\n4x IRF540N MOSFET\n10k Resistor (10)\nBC547 Transistor 5"}
              rows={10}
              className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 resize-y"
            />
            <button
              onClick={() => void runCheck()}
              disabled={loadingCatalog || !input.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingCatalog ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Check Stock
            </button>

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#21293d]">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-600 mb-2">
                Sample BOMs
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_BILLS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setInput(s.lines)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] text-xs text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="lg:col-span-3 space-y-4">
          {!lines ? (
            <div className="bg-white dark:bg-[#161b25] border border-dashed border-slate-300 dark:border-[#21293d] rounded-2xl p-12 text-center">
              <ClipboardList size={32} className="text-slate-400 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Component list paste karein aur Check Stock dabayein.
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                    Total parts
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{lines.length}</div>
                </div>
                <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                    Available
                  </div>
                  <div className="text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-1">{availCount}</div>
                </div>
                <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                    Issues
                  </div>
                  <div className="text-2xl font-black text-rose-500 dark:text-rose-400 mt-1">{issueCount}</div>
                </div>
                <div
                  className={`rounded-2xl p-4 border ${
                    goStatus() === "go"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-rose-500/10 border-rose-500/30"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                    Can start
                  </div>
                  <div
                    className={`flex items-center gap-2 text-2xl font-black mt-1 ${
                      goStatus() === "go" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {goStatus() === "go" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    {goStatus() === "go" ? "Go" : "Hold"}
                  </div>
                </div>
              </div>

              {/* Line table */}
              <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-[#21293d] flex items-center gap-2">
                  <Layers size={15} className="text-slate-500 dark:text-slate-400" />
                  <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Line details</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#111520] text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-600 text-left">
                        <th className="px-4 py-2.5">Component</th>
                        <th className="px-4 py-2.5">Matched</th>
                        <th className="px-4 py-2.5 text-center">Need</th>
                        <th className="px-4 py-2.5 text-center">Have</th>
                        <th className="px-4 py-2.5 text-center">Deficit</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const meta = STATUS_META[l.status];
                        const sups = l.product ? (suppliers.get(l.product.id) || []) : [];
                        return (
                          <tr key={l.key} className="border-t border-slate-100 dark:border-[#1a2134] hover:bg-slate-50 dark:hover:bg-[#0d1117]/40">
                            <td className="px-4 py-3 align-top">
                              <div className="text-slate-900 dark:text-white font-semibold">{l.rawName}</div>
                              {sups.length > 0 && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-600 mt-1">
                                  Suppliers: {sups.map((s) => s.name).join(", ")}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {l.product ? (
                                <div>
                                  <div className="text-slate-700 dark:text-slate-200">{l.product.name}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-600">id {l.product.id}</div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 dark:text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-900 dark:text-white font-semibold">{l.qty}</td>
                            <td className="px-4 py-3 text-center font-black text-slate-700 dark:text-slate-200">
                              {l.available}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {l.available < l.qty ? (
                                <span className="text-rose-600 dark:text-rose-400 font-black">-{l.deficit}</span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-600">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                  meta.chip
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI summary */}
              <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-5">
                {analysis ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-cyan-500 dark:text-cyan-400" />
                      <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">AI Analysis</h2>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {analysis}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => void runAnalysis()}
                    disabled={analyzing || !hasIssues}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] text-cyan-700 dark:text-cyan-300 hover:border-cyan-500/40 hover:text-slate-900 dark:hover:text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {analyzing ? "Analyzing..." : hasIssues ? "Check with AI" : "Sab stock available hai"}
                  </button>
                )}

                {!analysis && !hasIssues && lines.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-600 text-center">
                    AI summary enabled sirf issues hone pe (kuch kharida/nahi mila) — sab theek ho to zaroorat nahi.
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 flex items-start gap-2 text-sm text-rose-600 dark:text-rose-300">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}