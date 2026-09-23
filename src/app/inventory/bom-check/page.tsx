"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase, getCachedUser } from "@/lib/supabase";
import { fetchStockByProducts } from "@/lib/inventoryStock";
import { itemsToLines, type BomTemplate } from "@/lib/bomTemplates";
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
  Save,
  Bookmark,
  Pencil,
  Trash2,
  X,
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

/** All products that plausibly match the keyword (≥ MIN_MATCH_SCORE), highest score first. */
const MIN_MATCH_SCORE = 60;
function matchAlternates(query: string, products: Product[], excludeId: number | undefined): Product[] {
  return products
    .map((p) => ({ p, s: scoreMatch(query, p) }))
    .filter((x) => x.s >= MIN_MATCH_SCORE && x.p.id !== excludeId)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
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
  alternates: AlternateMatch[];
};

type AlternateMatch = {
  product: Product;
  score: number;
  available: number;
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
    chip: "bg-muted/15 text-muted-2 dark:text-muted border-muted/30",
    dot: "bg-muted",
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

  // ── Saved templates (Phase 3) — states + load hook (hooks sab guard se pehle) ──
  const [templates, setTemplates] = useState<BomTemplate[]>([]);
  const [tmplModal, setTmplModal] = useState<{ mode: "save" | "edit"; id?: number } | null>(null);
  const [tmplName, setTmplName] = useState("");
  const [tmplDesc, setTmplDesc] = useState("");
  const [tmplBusy, setTmplBusy] = useState(false);
  const [tmplMsg, setTmplMsg] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/bom-templates", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { templates?: BomTemplate[] };
      if (!res.ok) return;
      setTemplates(data.templates ?? []);
    } catch {
      /* ignore — template section khali rehta hai */
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

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
  // Returns the loaded products so callers can use the FRESH array immediately
  // (state updates are async and would otherwise fall behind the current render).
  const loadCatalog = async (): Promise<Product[]> => {
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
      return prods;
    } finally {
      setLoadingCatalog(false);
    }
  };

  // ── Saved templates (Phase 3) — handlers (guard ke baad, plain functions) ──
  const openSaveModal = () => {
    setTmplName("");
    setTmplDesc("");
    setTmplMsg(null);
    setTmplModal({ mode: "save" });
  };

  const editTemplate = (t: BomTemplate) => {
    setTmplName(t.name);
    setTmplDesc(t.description || "");
    setTmplMsg(null);
    setTmplModal({ mode: "edit", id: t.id });
  };

  const loadTemplate = (t: BomTemplate) => {
    if (!t.items || t.items.length === 0) return;
    setInput(itemsToLines(t.items));
    setLines(null);
    setAnalysis(null);
    setError(null);
    setTmplMsg(null);
  };

  /** Current textarea ko items me convert karo (best product match attach). */
  const buildSaveItems = async (): Promise<
    { product_id: number | null; name: string; qty: number }[]
  > => {
    const prodCatalog: Product[] = catalog.length > 0 ? catalog : await loadCatalog();
    const parsed = input
      .split("\n")
      .map(parseBOMLine)
      .filter((x): x is { name: string; qty: number } => x !== null);
    return parsed.map((p) => {
      const best = bestMatch(p.name, prodCatalog);
      return { product_id: best?.id ?? null, name: best?.name ?? p.name, qty: p.qty };
    });
  };

  const submitTemplate = async () => {
    if (!tmplName.trim()) {
      setTmplMsg("Template ka naam chahiye.");
      return;
    }
    const items = await buildSaveItems();
    if (items.length === 0) {
      setTmplMsg("Textarea me koi component line nahi hai.");
      return;
    }
    setTmplBusy(true);
    setTmplMsg(null);
    try {
      const editing = tmplModal?.mode === "edit" && tmplModal.id;
      const res = await fetch(editing ? `/api/bom-templates/${editing}` : "/api/bom-templates", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tmplName, description: tmplDesc, items }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; template?: BomTemplate };
      if (!res.ok) {
        setTmplMsg(data.error || "Template save nahi hua.");
        return;
      }
      setTmplModal(null);
      await loadTemplates();
    } catch {
      setTmplMsg("Server error — dobara try karo.");
    } finally {
      setTmplBusy(false);
    }
  };

  const deleteTemplate = async (t: BomTemplate) => {
    if (!confirm(`Template '${t.name}' delete karein?`)) return;
    setTmplMsg(null);
    try {
      const res = await fetch(`/api/bom-templates/${t.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setTmplMsg(data.error || "Template delete nahi hua.");
        return;
      }
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    } catch {
      setTmplMsg("Server error — dobara try karo.");
    }
  };

  // ── Run check ─────────────────────────────────────────────────────────────
  const runCheck = async () => {
    if (!input.trim()) return;
    setError(null);
    setAnalysis(null);
    // Use the FRESH catalog — `catalog` state may not have updated within this
    // same render/closure (async state update), causing first-run misses.
    const prodCatalog: Product[] = catalog.length > 0 ? catalog : await loadCatalog();
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
      const best = bestMatch(p.name, prodCatalog);
      if (best) productIds.add(best.id);
      matchAlternates(p.name, prodCatalog, best?.id).forEach((a) => productIds.add(a.id));
      return { parsedName: p.name, qty: p.qty, best };
    });

    let stockMap = new Map<number, { available: number }>();
    try {
      stockMap = await fetchStockByProducts([...productIds]);
    } catch (e) {
      // Stock read fail → surface it instead of silently marking in-stock items
      // as out of stock (available=0). This was masking real data as "0".
      setError(
        e instanceof Error
          ? `Stock count nahi mila: ${e.message}`
          : "Stock count nahi mila. Dobara try karein."
      );
    }

    const built: BomLine[] = matched.map((m, i) => {
      const product = m.best;
      const alternates = matchAlternates(m.parsedName, prodCatalog, product?.id).map((p) => ({
        product: p,
        score: scoreMatch(m.parsedName, p),
        available: stockMap.get(p.id)?.available ?? 0,
      }));
      if (!product) {
        return {
          key: `${i}-${m.parsedName}`,
          rawName: m.parsedName,
          qty: m.qty,
          status: "notfound",
          available: 0,
          deficit: m.qty,
          alternates,
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
        alternates,
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
    <div className="min-h-screen bg-white dark:bg-app font-sans pb-16">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-white dark:bg-app border-b border-app-2 dark:border-app">
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
                  <Link href="/inventory" className="text-xs text-muted hover:text-app dark:hover:text-app-2 transition-colors">
                    Inventory
                  </Link>
                  <span className="text-muted dark:text-app text-xs">/</span>
                  <span className="text-xs text-app dark:text-app-2">BOM Check</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-app dark:text-white tracking-tight mt-0.5">
                  BOM Checker
                </h1>
                <p className="text-muted dark:text-muted text-sm mt-0.5">
                  Component list paste karein — live stock + AI Hinglish summary.
                </p>
              </div>
            </div>
            <button
              onClick={() => { void loadCatalog(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-[#2a3348] text-muted-2 dark:text-app-2 text-sm font-semibold transition-colors"
            >
              <RefreshCw size={15} /> Reload Catalog
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-5 gap-6">
        {/* ── Input ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-panel-2 border border-app-2 dark:border-app rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className="text-muted dark:text-muted" />
              <h2 className="text-sm font-black text-app dark:text-white tracking-tight">BOM input</h2>
            </div>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name (optional)"
              className="mb-3 w-full bg-white dark:bg-app border border-app-2 dark:border-app rounded-xl px-3 py-2.5 text-sm text-app dark:text-white placeholder:text-muted dark:placeholder:text-muted-2 focus:outline-none focus:border-cyan-500/60"
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"NE555 Timer IC - 2\n4x IRF540N MOSFET\n10k Resistor (10)\nBC547 Transistor 5"}
              rows={10}
              className="w-full bg-white dark:bg-app border border-app-2 dark:border-app rounded-xl px-3 py-2.5 text-sm text-app dark:text-white placeholder:text-muted dark:placeholder:text-muted-2 focus:outline-none focus:border-cyan-500/60 resize-y"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={openSaveModal}
                disabled={!input.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-panel-2 hover:bg-panel-2 dark:bg-app dark:hover:bg-panel-2 border border-app-2 dark:border-app text-xs font-bold text-muted-2 dark:text-app-2 hover:border-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Abhi likha hua BOM template ke roop me save karo"
              >
                <Save size={13} /> Save as Template
              </button>
              {tmplMsg && (
                <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  {tmplMsg}
                </span>
              )}
            </div>
            <button
              onClick={() => void runCheck()}
              disabled={loadingCatalog || !input.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingCatalog ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Check Stock
            </button>

            <div className="mt-5 pt-4 border-t border-app-2 dark:border-app">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted dark:text-muted-2 mb-2">
                Sample BOMs
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_BILLS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setInput(s.lines)}
                    className="px-3 py-1.5 rounded-xl bg-panel-2 dark:bg-app border border-app-2 dark:border-app text-xs text-muted-2 dark:text-app-2 hover:border-cyan-500/40 hover:text-app dark:hover:text-white transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-app-2 dark:border-app">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted dark:text-muted-2">
                  <Bookmark size={12} />
                  Saved Templates
                </div>
                <button
                  onClick={() => void loadTemplates()}
                  title="Refresh"
                  className="text-muted dark:text-muted-2 hover:text-app dark:hover:text-app-2 transition-colors"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              {templates.length === 0 ? (
                <p className="text-xs text-muted dark:text-muted-2">
                  Koi saved template nahi — save karke re-use karo.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1.5 rounded-xl bg-panel-2 dark:bg-app border border-app-2 dark:border-app px-2.5 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => loadTemplate(t)}
                          title="Textarea me load karo"
                          className="block w-full text-left text-xs font-bold text-app dark:text-app-2 truncate hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors"
                        >
                          {t.name}
                        </button>
                        {t.description && (
                          <p className="truncate text-[10px] text-muted dark:text-muted-2">
                            {t.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => editTemplate(t)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-muted dark:text-muted hover:text-app dark:hover:text-white hover:bg-panel-2 dark:hover:bg-panel-2 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => void deleteTemplate(t)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-muted dark:text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-panel-2 dark:hover:bg-panel-2 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="lg:col-span-3 space-y-4">
          {!lines ? (
            <div className="bg-white dark:bg-panel-2 border border-dashed border-app-2 dark:border-app rounded-2xl p-12 text-center">
              <ClipboardList size={32} className="text-muted dark:text-app mx-auto mb-3" />
              <p className="text-muted dark:text-muted text-sm">
                Component list paste karein aur Check Stock dabayein.
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-panel-2 border border-app-2 dark:border-app rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted dark:text-muted">
                    Total parts
                  </div>
                  <div className="text-2xl font-black text-app dark:text-white mt-1">{lines.length}</div>
                </div>
                <div className="bg-white dark:bg-panel-2 border border-app-2 dark:border-app rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted dark:text-muted">
                    Available
                  </div>
                  <div className="text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-1">{availCount}</div>
                </div>
                <div className="bg-white dark:bg-panel-2 border border-app-2 dark:border-app rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted dark:text-muted">
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
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted dark:text-muted">
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
              <div className="bg-white dark:bg-panel-2 border border-app-2 dark:border-app rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-app-2 dark:border-app flex items-center gap-2">
                  <Layers size={15} className="text-muted dark:text-muted" />
                  <h2 className="text-sm font-black text-app dark:text-white tracking-tight">Line details</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-panel-2 text-[10px] font-black uppercase tracking-widest text-muted dark:text-muted-2 text-left">
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
                          <tr key={l.key} className="border-t border-app-2 dark:border-app-2 hover:bg-slate-50 dark:hover:bg-app/40">
                            <td className="px-4 py-3 align-top">
                              <div className="text-app dark:text-white font-semibold">{l.rawName}</div>
                              {sups.length > 0 && (
                                <div className="text-[10px] text-muted dark:text-muted-2 mt-1">
                                  Suppliers: {sups.map((s) => s.name).join(", ")}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {l.product ? (
                                <div>
                                  <div className="text-app dark:text-app-2">{l.product.name}</div>
                                  <div className="text-[10px] text-muted dark:text-muted-2">id {l.product.id}</div>
                                  {l.alternates.length > 0 && (
                                    <div className="mt-2 border-t border-app-2 dark:border-app-2 pt-1.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted dark:text-muted">
                                        Other matches ({l.alternates.length})
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {l.alternates.map((alt) => (
                                          <div
                                            key={alt.product.id}
                                            className="flex items-baseline justify-between gap-2 text-[11px]"
                                          >
                                            <span className="text-muted-2 dark:text-app-2">
                                              {alt.product.name}
                                              <span className="text-muted dark:text-muted"> #{alt.product.id}</span>
                                            </span>
                                            <span
                                              className={`font-bold whitespace-nowrap ${
                                                alt.available > 0
                                                  ? "text-emerald-600 dark:text-emerald-400"
                                                  : "text-rose-600 dark:text-rose-400"
                                              }`}
                                            >
                                              have {alt.available}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted dark:text-muted-2">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-app dark:text-white font-semibold">{l.qty}</td>
                            <td className="px-4 py-3 text-center font-black text-app dark:text-app-2">
                              {l.available}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {l.available < l.qty ? (
                                <span className="text-rose-600 dark:text-rose-400 font-black">-{l.deficit}</span>
                              ) : (
                                <span className="text-muted dark:text-muted-2">0</span>
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
              <div className="bg-white dark:bg-panel-2 border border-app-2 dark:border-app rounded-2xl p-5">
                {analysis ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-cyan-500 dark:text-cyan-400" />
                      <h2 className="text-sm font-black text-app dark:text-white tracking-tight">AI Analysis</h2>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-app dark:text-app-2 leading-relaxed">
                      {analysis}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => void runAnalysis()}
                    disabled={analyzing || !hasIssues}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-panel-2 dark:bg-app border border-app-2 dark:border-app text-cyan-700 dark:text-cyan-300 hover:border-cyan-500/40 hover:text-app dark:hover:text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {analyzing ? "Analyzing..." : hasIssues ? "Check with AI" : "Sab stock available hai"}
                  </button>
                )}

                {!analysis && !hasIssues && lines.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted dark:text-muted-2 text-center">
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

      {/* ── Template save/edit modal (Phase 3) ── */}
      {tmplModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-panel-2 border border-app-2 dark:border-app rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-app dark:text-white tracking-tight">
                {tmplModal.mode === "edit" ? "Edit Template" : "Save as Template"}
              </h3>
              <button
                onClick={() => setTmplModal(null)}
                disabled={tmplBusy}
                className="p-1.5 rounded-lg text-muted hover:text-app dark:hover:text-white hover:bg-panel-2 dark:hover:bg-panel-2 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <input
              value={tmplName}
              onChange={(e) => setTmplName(e.target.value)}
              placeholder="Template naam (e.g. Motor Driver BOM)"
              className="w-full bg-white dark:bg-app border border-app-2 dark:border-app rounded-xl px-3 py-2.5 text-sm text-app dark:text-white placeholder:text-muted dark:placeholder:text-muted-2 focus:outline-none focus:border-cyan-500/60"
            />
            <textarea
              value={tmplDesc}
              onChange={(e) => setTmplDesc(e.target.value)}
              rows={2}
              placeholder="Note (optional)"
              className="w-full bg-white dark:bg-app border border-app-2 dark:border-app rounded-xl px-3 py-2.5 text-sm text-app dark:text-white placeholder:text-muted dark:placeholder:text-muted-2 focus:outline-none focus:border-cyan-500/60 resize-y"
            />
            {tmplMsg && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{tmplMsg}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setTmplModal(null)}
                disabled={tmplBusy}
                className="px-4 py-2 rounded-xl bg-panel-2 dark:bg-app border border-app-2 dark:border-app text-xs font-bold text-muted-2 dark:text-app-2 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitTemplate()}
                disabled={tmplBusy || !tmplName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {tmplBusy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}