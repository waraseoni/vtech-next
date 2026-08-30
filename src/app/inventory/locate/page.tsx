"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { stockStatusStyle, alertThreshold, type StockStatusStyle } from "@/lib/inventory";
import {
  locPath,
  encodeLocationToken,
  decodeLocationToken,
  EMPTY_LOCATION,
  type LocationParts,
} from "@/lib/locations";
import BarcodeCameraScanner from "@/app/components/BarcodeCameraScanner";
import Image from "next/image";
import {
  MapPin,
  Search,
  QrCode,
  Printer,
  Copy,
  Check,
  Camera,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  AlertTriangle,
  Boxes,
  X,
  ScanLine,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";

// ─── Types ────────────────────────────────────────────────────────────────────
type LocGroup = {
  parts: LocationParts;
  path: string;
  qty: number;
  rows: number;
  lastDate: string;
  poCodes: string[];
};

type ProductLoc = {
  id: number;
  name: string;
  description: string;
  barcode: string | null;
  image_path: string | null;
  alert_quantity: number;
  available: number;
  total_in: number;
  groups: LocGroup[];
  unlocatedQty: number;
  unlocatedPoCodes: string[];
};

type TreeNode = {
  key: string;
  level: number;
  label: string;
  path: string;
  parts: LocationParts;
  count: number;
  units: number;
  /** Is exact node par directly assign products (leaf: boxes). */
  ownProducts: { id: number; name: string; qty: number }[];
  /** Puri subtree (apne + children recursively) ka de-duplicated aggregate. */
  allProducts: { id: number; name: string; qty: number }[];
  children: Map<string, TreeNode>;
};

function mergeProducts(
  base: Map<number, { id: number; name: string; qty: number }>,
  list: { id: number; name: string; qty: number }[] | undefined
) {
  for (const p of list || []) {
    const cur = base.get(p.id);
    if (cur) cur.qty += p.qty;
    else base.set(p.id, { id: p.id, name: p.name, qty: p.qty });
  }
}

// ─── Build location tree from product groups ─────────────────────────────────
const SEGS = ["zone", "rack", "bin", "box"] as const;

function buildTree(prods: ProductLoc[]): TreeNode {
  const root: TreeNode = {
    key: "",
    level: -1,
    label: "",
    path: "",
    parts: { ...EMPTY_LOCATION },
    count: 0,
    units: 0,
    ownProducts: [],
    allProducts: [],
    children: new Map(),
  };

  /** Parent ke andar (nested location hierarchy) node get/create. */
  const upsert = (
    parent: TreeNode,
    level: number,
    parts: LocationParts
  ): TreeNode => {
    const key = SEGS.slice(0, level + 1).join("|") + ":" + locPath(parts);
    let node = parent.children.get(key);
    if (!node) {
      node = {
        key,
        level,
        label: parts[SEGS[level]],
        path: locPath(parts),
        parts: { ...parts },
        count: 0,
        units: 0,
        ownProducts: [],
        allProducts: [],
        children: new Map(),
      };
      parent.children.set(key, node);
    }
    return node;
  };

  const addOwn = (
    node: TreeNode,
    prod: { id: number; name: string },
    qty: number
  ) => {
    const existing = node.ownProducts.find((x) => x.id === prod.id);
    if (existing) existing.qty += qty;
    else node.ownProducts.push({ id: prod.id, name: prod.name, qty });
  };

  for (const p of prods) {
    for (const g of p.groups) {
      let current = root;
      const occupied: TreeNode[] = [];
      for (let lvl = 0; lvl < SEGS.length; lvl++) {
        const name = g.parts[SEGS[lvl]];
        if (!name) break;
        const segParts = { ...EMPTY_LOCATION };
        for (let k = 0; k <= lvl; k++) segParts[SEGS[k]] = g.parts[SEGS[k]];
        current = upsert(current, lvl, segParts);
        current.count++;
        current.units += g.qty;
        occupied.push(current);
      }
      // Exact box-level assignment, ya partway (zone/rack/bin-only) assignment —
      // us deepest node ke ownProducts me daalo taaki us level ka list mile.
      if (current !== root) addOwn(current, p, g.qty);
    }
  }

  // Post-order: har node ka subtree aggregate (de-duplicated, qty summed).
  const computeAll = (node: TreeNode) => {
    const agg = new Map<number, { id: number; name: string; qty: number }>();
    mergeProducts(agg, node.ownProducts);
    for (const child of node.children.values()) {
      computeAll(child);
      mergeProducts(agg, child.allProducts);
    }
    node.allProducts = [...agg.values()];
  };
  computeAll(root);

  return root;
}

function sumUnits(list: { id: number; name: string; qty: number }[]) {
  return list.reduce((s, x) => s + x.qty, 0);
}

// ─── QR helpers ───────────────────────────────────────────────────────────────
async function qrDataUrl(text: string, size = 260): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111827", light: "#ffffff" },
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LocatePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prods, setProds] = useState<ProductLoc[]>([]);
  const [tab, setTab] = useState<"products" | "tree" | "unplaced">("products");
  const [q, setQ] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeLoc, setActiveLoc] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState<LocationParts | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [focusId, setFocusId] = useState<number | null>(null);
  const resultRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: pl } = await supabase
        .from("product_list")
        .select("id, name, description, image_path, barcode, alert_quantity")
        .eq("delete_flag", 0)
        .order("name");
      if (!pl) {
        setProds([]);
        return;
      }
      const ids = pl.map((p) => p.id);

      // `product_locations`/`locations` RLS-gated hain → anon-client khali []
      // deta hai. Service-role server route se read hota hai.
      let plLocsData: Record<string, unknown> = {};
      try {
        const res = await fetch(`/api/locations/by-product?ids=${ids.join(",")}`);
        if (res.ok) plLocsData = (await res.json()) as Record<string, unknown>;
      } catch {
        plLocsData = {};
      }
      const prodLocMap = new Map<
        number,
        { zone: string; rack: string; bin: string; box: string }[]
      >();
      Object.entries(plLocsData).forEach(([pid, locs]) => {
        const arr = Array.isArray(locs)
          ? (locs as { zone?: string | null; rack?: string | null; bin?: string | null; box?: string | null }[])
          : [];
        const mapped = (arr || []).map((loc) => ({
          zone: loc?.zone || "",
          rack: loc?.rack || "",
          bin: loc?.bin || "",
          box: loc?.box || "",
        }));
        if (mapped.length > 0) prodLocMap.set(Number(pid), mapped);
      });

      const [stockRes, jobRes, saleRes] = await Promise.all([
        supabase
          .from("inventory_list")
          .select("product_id, quantity, stock_date, purchase_order_id")
          .in("product_id", ids),
        supabase
          .from("transaction_products")
          .select("product_id, qty, transaction_id")
          .in("product_id", ids),
        supabase.from("direct_sale_items").select("product_id, qty").in("product_id", ids),
      ]);

      // Fetch PO codes
      const allPoIds = [
        ...new Set((stockRes.data || []).map((r) => r.purchase_order_id).filter(Boolean)),
      ];
      const poCodeMap = new Map<number, string>();
      if (allPoIds.length) {
        const { data: poRows } = await supabase
          .from("purchase_orders")
          .select("id, po_code")
          .in("id", allPoIds);
        (poRows || []).forEach((r) => poCodeMap.set(r.id, r.po_code));
      }

      const txnIds = [...new Set((jobRes.data || []).map((i) => i.transaction_id))];
      let valid = new Set<number>();
      if (txnIds.length) {
        const { data: txns } = await supabase
          .from("transaction_list")
          .select("id")
          .in("id", txnIds)
          .neq("status", 4);
        valid = new Set((txns || []).map((t) => t.id));
      }
      const soldJob = new Map<number, number>();
      (jobRes.data || []).forEach((r) => {
        if (valid.has(r.transaction_id))
          soldJob.set(r.product_id, (soldJob.get(r.product_id) || 0) + (r.qty || 0));
      });
      const soldSale = new Map<number, number>();
      (saleRes.data || []).forEach((r) =>
        soldSale.set(r.product_id, (soldSale.get(r.product_id) || 0) + (r.qty || 0))
      );

      const byId = new Map<number, ProductLoc>();
      for (const p of pl) {
        const locs = prodLocMap.get(p.id) || [];
        const groups: LocGroup[] = locs
          .map((loc) => {
            const parts = { zone: loc.zone, rack: loc.rack, bin: loc.bin, box: loc.box };
            const path = locPath(parts);
            return path ? { parts, path, qty: 0, rows: 0, lastDate: "", poCodes: [] } : null;
          })
          .filter(Boolean) as LocGroup[];
        byId.set(p.id, {
          id: p.id,
          name: p.name,
          description: p.description || "",
          barcode: p.barcode || null,
          image_path: p.image_path || null,
          alert_quantity: p.alert_quantity || 5,
          available: 0,
          total_in: 0,
          groups,
          unlocatedQty: 0,
          unlocatedPoCodes: [],
        });
      }

      (stockRes.data || []).forEach((r) => {
        const prod = byId.get(r.product_id);
        if (!prod) return;
        const qty = r.quantity || 0;
        prod.total_in += qty;
        const poCode = r.purchase_order_id ? poCodeMap.get(r.purchase_order_id) : undefined;
        if (prod.groups.length > 0) {
          const g = prod.groups[0];
          g.qty += qty;
          g.rows++;
          if (String(r.stock_date) > g.lastDate) g.lastDate = String(r.stock_date);
          if (poCode && !g.poCodes.includes(poCode)) g.poCodes.push(poCode);
        } else {
          prod.unlocatedQty += qty;
          if (poCode && !prod.unlocatedPoCodes.includes(poCode)) prod.unlocatedPoCodes.push(poCode);
        }
      });

      const result: ProductLoc[] = [];
      for (const p of pl) {
        const prod = byId.get(p.id)!;
        prod.available = prod.total_in - (soldJob.get(p.id) || 0) - (soldSale.get(p.id) || 0);
        prod.groups.sort((a, b) => b.qty - a.qty || a.path.localeCompare(b.path));
        result.push(prod);
      }
      setProds(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      located: prods.filter((p) => p.groups.length > 0).length,
      unplaced: prods.filter((p) => p.total_in > 0 && p.groups.length === 0).length,
      locations: new Set(prods.flatMap((p) => p.groups.map((g) => g.path))).size,
      noStock: prods.filter((p) => p.available <= 0).length,
    }),
    [prods]
  );

  const tree = useMemo(() => buildTree(prods), [prods]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return prods;
    return prods.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        (p.barcode || "").toLowerCase().includes(term) ||
        p.groups.some((g) => g.path.toLowerCase().includes(term))
    );
  }, [prods, q]);

  const unplaced = useMemo(
    () =>
      prods
        .filter((p) => p.total_in > 0 && p.groups.length === 0)
        .sort((a, b) => b.unlocatedQty - a.unlocatedQty),
    [prods]
  );

  // Auto-expand to a location path (QR scan / chip click)
  const revealLocation = useCallback(
    (path: string) => {
      setActiveLoc(path);
      setTab("tree");
      setExpanded((prev) => {
        const next = new Set(prev);
        // Nested tree ko root se walk karke saare ancestors expand karo.
        const segs = path.split(" ▸ ");
        const segParts = { ...EMPTY_LOCATION };
        let cur: TreeNode = tree;
        for (let lvl = 0; lvl < segs.length && lvl < SEGS.length; lvl++) {
          segParts[SEGS[lvl]] = segs[lvl];
          const key = SEGS.slice(0, lvl + 1).join("|") + ":" + locPath(segParts);
          const child = cur.children.get(key);
          if (!child) break;
          next.add(child.key);
          cur = child;
        }
        return next;
      });
    },
    [tree]
  );

  // Deep-link support: /inventory/locate?loc=<path> (from inventory place chips)
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (loading || deepLinkDone.current) return;
    const raw = new URLSearchParams(window.location.search).get("loc");
    if (!raw) return;
    const path = decodeURIComponent(raw);
    if (!path) return;
    deepLinkDone.current = true;
    window.history.replaceState(null, "", "/inventory/locate");
    revealLocation(path);
    setScanMsg(`Location: ${path}`);
  }, [loading, revealLocation, setScanMsg]);

  // Handle manual input: location QR token OR product barcode/text
  const handleScanInput = async (raw: string) => {
    const s = (raw || "").trim();
    if (!s) return;
    setScanMsg(null);
    const loc = decodeLocationToken(s);
    if (loc) {
      setScanOpen(false);
      setQ("");
      revealLocation(locPath(loc));
      setScanMsg(`Location mila: ${locPath(loc)}`);
      return;
    }
    // barcode?
    const p = prods.find((x) => (x.barcode || "").toLowerCase() === s.toLowerCase());
    if (p) {
      setScanOpen(false);
      setTab("products");
      setQ(p.name);
      setFocusId(p.id);
      setTimeout(
        () => resultRefs.current.get(p.id)?.scrollIntoView({ behavior: "smooth", block: "center" }),
        100
      );
      setScanMsg(`Product: ${p.name}`);
      return;
    }
    // fallback: text search
    setScanOpen(false);
    setTab("products");
    setQ(s);
    setScanMsg('Product/location search: "' + s + '"');
  };

  // ── QR modal ───────────────────────────────────────────────────────────────
  const openQr = async (parts: LocationParts) => {
    setQrOpen(parts);
    setQrUrl(null);
    setCopied(false);
    setQrUrl(await qrDataUrl(encodeLocationToken(parts)));
  };

  const copyToken = async () => {
    if (!qrOpen) return;
    await navigator.clipboard.writeText(encodeLocationToken(qrOpen));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // ── Print shelf labels ─────────────────────────────────────────────────────
  const printAllLabels = async () => {
    setPrintOpen(false);
    const paths = [...new Set(prods.flatMap((p) => p.groups.map((g) => g.path)))].sort();
    const qrs: { path: string; url: string }[] = [];
    for (const path of paths) {
      const parts = prods.flatMap((p) => p.groups).find((g) => g.path === path)!.parts;
      qrs.push({ path, url: await qrDataUrl(encodeLocationToken(parts), 220) });
    }
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Shelf Location Labels</title><style>
      body{font-family:Arial,sans-serif;padding:18px;background:#fff;color:#111}
      h1{font-size:16px;margin:0 0 4px}
      p{margin:0 0 14px;color:#666;font-size:11px}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .card{border:1.5px dashed #94a3b8;border-radius:10px;padding:12px;text-align:center;page-break-inside:avoid}
      .card img{width:150px;height:150px;object-fit:contain}
      .path{font-size:12px;font-weight:700;margin-top:6px;word-break:break-word}
      .tag{font-size:9px;color:#64748b;margin-top:3px}
    </style></head><body>
      <h1>V-Tech — Shelf Location Labels</h1>
      <p>Print karke har shelf/box par chipkayein. Scan karo → Spare Finder me us location khulegi.</p>
      <div class="grid">
        ${qrs.map((x) => `<div class="card"><img src="${x.url}" /><div class="path">${x.path}</div><div class="tag">Scan QR to open location</div></div>`).join("")}
      </div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  const printOneLabel = async (parts: LocationParts) => {
    const path = locPath(parts);
    const url = await qrDataUrl(encodeLocationToken(parts), 320);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Shelf Label</title><style>
      body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:96vh;background:#fff}
      .card{border:2px dashed #94a3b8;border-radius:14px;padding:32px;text-align:center;width:340px}
      .card img{width:260px;height:260px}
      .path{font-size:16px;font-weight:800;margin-top:12px;word-break:break-word}
      .tag{font-size:10px;color:#64748b;margin-top:6px}
    </style></head><body><div class="card">
      <img src="${url}" />
      <div class="path">${path}</div>
      <div class="tag">V-TECH · Scan QR in Spare Finder</div>
    </div></body></html>`);
    w.document.close();
    w.print();
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return <PageLoader icon={MapPin} label="Locating Spares..." tone="emerald" />;
  }

  const st = (p: ProductLoc): StockStatusStyle => stockStatusStyle(p.available, p.alert_quantity);

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">
      {/* ── HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute -top-10 right-10 w-48 h-48 bg-teal-600/8 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                <MapPin size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                  Spare Finder
                </h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                  Shop me koi bhi spare kaha rakha hai — foran khojain
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => setPrintOpen(true)}
                disabled={stats.locations === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              >
                <Printer size={13} /> Shelf Labels
              </button>
              <Link
                href="/inventory"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <Boxes size={13} /> Inventory
              </Link>
              <Link
                href="/inventory/purchase-orders"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <FileText size={13} /> Purchase Orders
              </Link>
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              {
                label: "Located Products",
                value: stats.located,
                color: "text-emerald-400",
                border: "border-emerald-500/20",
                bg: "from-emerald-600/20 to-emerald-700/5",
                icon: MapPin,
              },
              {
                label: "Total Locations",
                value: stats.locations,
                color: "text-teal-400",
                border: "border-teal-500/20",
                bg: "from-teal-600/20 to-teal-700/5",
                icon: QrCode,
              },
              {
                label: "No Location Yet",
                value: stats.unplaced,
                color: "text-amber-400",
                border: "border-amber-500/20",
                bg: "from-amber-600/20 to-amber-700/5",
                icon: AlertTriangle,
              },
              {
                label: "Out of Stock",
                value: stats.noStock,
                color: "text-red-400",
                border: "border-red-500/20",
                bg: "from-red-600/20 to-red-700/5",
                icon: Package,
              },
            ].map(({ label, value, color, border, bg, icon: Icon }) => (
              <div
                key={label}
                className={`relative bg-gradient-to-br ${bg} border ${border} rounded-2xl px-4 py-3.5 overflow-hidden`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-xl font-black ${color}`}>{value}</div>
                    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">
                      {label}
                    </div>
                  </div>
                  <Icon size={16} className={`${color} opacity-50`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SCAN / SEARCH BAR ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
              size={15}
            />
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleScanInput(scanInput);
              }}
              placeholder="Product barcode scan karein, ya shelf QR — ya koi bhi name/naam likhein..."
              className="w-full pl-10 pr-4 py-3 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleScanInput(scanInput)}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm transition-all active:scale-95 flex items-center gap-2"
            >
              <Search size={14} /> Find
            </button>
            <button
              onClick={() => {
                setScanOpen((v) => !v);
                setScanMsg(null);
              }}
              className={`px-4 py-3 rounded-xl font-extrabold text-sm transition-all active:scale-95 flex items-center gap-2 border ${
                scanOpen
                  ? "bg-red-600/15 border-red-500/30 text-red-400"
                  : "bg-blue-600/15 border-blue-500/30 text-blue-300 hover:bg-blue-600/25"
              }`}
            >
              {scanOpen ? <Camera size={14} /> : <ScanLine size={14} />}
              {scanOpen ? "Stop" : "Scan"}
            </button>
          </div>
        </div>
        {scanMsg && (
          <p className="mt-2 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            {scanMsg}
          </p>
        )}
        {scanOpen && (
          <div className="mt-3">
            <BarcodeCameraScanner onScan={handleScanInput} />
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex gap-1.5 mb-4">
          {(
            [
              { key: "products", label: "Find Product", count: prods.length, color: "emerald" },
              { key: "tree", label: "By Location", count: stats.locations, color: "teal" },
              { key: "unplaced", label: "No Location", count: stats.unplaced, color: "amber" },
            ] as const
          ).map(({ key, label, count, color }) => {
            const active = tab === key;
            const styles: Record<string, string> = {
              emerald: active
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-emerald-500/40",
              teal: active
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-teal-500/40",
              amber: active
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-amber-500/40",
            };
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all ${styles[color]}`}
              >
                {label}
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-white/5"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════ TAB: FIND PRODUCT ══════════ */}
      {tab === "products" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3">
          {/* local quick filter */}
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700"
              size={14}
            />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setFocusId(null);
              }}
              placeholder="Name, description, barcode, ya location — filter karein..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
              <Package size={36} className="mx-auto text-slate-800 mb-3" />
              <p className="text-slate-600 font-bold text-sm">Koi product nahi mila</p>
            </div>
          )}

          {filtered.map((p) => {
            const s = st(p);
            const hasLoc = p.groups.length > 0;
            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) resultRefs.current.set(p.id, el);
                  else resultRefs.current.delete(p.id);
                }}
                className={`bg-[#161b27] border rounded-2xl overflow-hidden transition-all ${focusId === p.id ? "border-emerald-400 ring-1 ring-emerald-400/40" : "border-[#21293d]"}`}
              >
                <div
                  className={`h-0.5 w-full ${p.available <= 0 ? "bg-red-500" : p.available <= alertThreshold(p.alert_quantity) ? "bg-amber-400" : "bg-emerald-500"}`}
                />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border bg-[#111520] border-[#21293d]">
                        <Package size={18} className="text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/inventory/${p.id}`}
                          className="font-black text-white text-sm hover:text-emerald-400 transition-colors"
                        >
                          {p.name}
                        </Link>
                        <div className="text-[11px] text-slate-600 truncate max-w-[320px]">
                          {p.description}
                        </div>
                        {p.barcode && (
                          <div className="text-[9px] font-mono text-purple-500/70 mt-0.5 uppercase">
                            {p.barcode}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${s.bg} ${s.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.bar}`} /> {s.label}
                      </span>
                      <span className="text-lg font-black text-white">
                        {Math.max(0, p.available)}
                      </span>
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="mt-3">
                    {hasLoc ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.groups.map((g) => (
                          <button
                            key={g.path}
                            onClick={() => revealLocation(g.path)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/8 border border-emerald-500/25 rounded-lg text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/15 transition-all text-left group"
                            title={`${g.rows} stock entry(ies) · last ${g.lastDate || "—"}${g.poCodes.length ? ` · PO: ${g.poCodes.join(", ")}` : ""}`}
                          >
                            <MapPin size={11} className="text-emerald-500 flex-shrink-0" />
                            <span className="truncate max-w-[240px] sm:max-w-[320px]">
                              {g.path}
                            </span>
                            {g.poCodes.length > 0 && (
                              <span className="text-[9px] text-blue-400 font-bold px-1 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                                {g.poCodes[0]}
                              </span>
                            )}
                            <span className="text-[10px] text-emerald-400/70 font-black px-1.5 py-0.5 rounded-md bg-emerald-500/10">
                              {g.qty}
                            </span>
                          </button>
                        ))}
                        {p.unlocatedQty > 0 && (
                          <span className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/8 border border-amber-500/25 rounded-lg text-[11px] font-bold text-amber-400">
                            <AlertTriangle size={11} /> +{p.unlocatedQty} bina location
                          </span>
                        )}
                      </div>
                    ) : p.total_in > 0 ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/25 rounded-lg text-[11px] font-bold text-amber-400">
                        <AlertTriangle size={12} />
                        Stock hai ({p.total_in}) par location set nahi — add/edit stock me location
                        bharo
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-700">No stock</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ TAB: BY LOCATION ══════════ */}
      {tab === "tree" && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {stats.locations === 0 ? (
            <div className="py-16 text-center bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
              <QrCode size={36} className="mx-auto text-slate-800 mb-3" />
              <p className="text-slate-600 font-bold text-sm">Abhi koi location set nahi hai</p>
              <p className="text-slate-700 text-xs mt-1">
                Stock add/edit karte waqt Zone ▸ Rack ▸ Bin ▸ Box bharein
              </p>
            </div>
          ) : (
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 space-y-1">
              <RecursiveTree
                root={tree}
                expanded={expanded}
                setExpanded={setExpanded}
                activeLoc={activeLoc}
                setActiveLoc={(p) => setActiveLoc(p)}
                onQr={openQr}
              />
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: NO LOCATION ══════════ */}
      {tab === "unplaced" && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-2.5">
          {unplaced.length === 0 ? (
            <div className="py-16 text-center bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
              <Check size={32} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-emerald-400 font-bold text-sm">
                Sab products ki location set hai!
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-600 font-bold px-1">
                {unplaced.length} product{unplaced.length > 1 ? "s" : ""} me stock hai par location
                nahi — inhe location assign karo.
              </p>
              {unplaced.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 bg-[#161b27] border border-amber-500/20 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/inventory/${p.id}`}
                      className="text-sm font-black text-white hover:text-amber-400 transition-colors"
                    >
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-600">
                      <span className="font-bold text-amber-400">{p.unlocatedQty} unit stock</span>
                      {p.unlocatedPoCodes.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 font-bold">
                          <FileText size={9} /> {p.unlocatedPoCodes.slice(0, 2).join(", ")}
                          {p.unlocatedPoCodes.length > 2 && (
                            <span className="text-slate-600">
                              {" "}
                              +{p.unlocatedPoCodes.length - 2}
                            </span>
                          )}
                        </span>
                      )}
                      {p.barcode && (
                        <span className="font-mono text-[9px] text-purple-500/70">{p.barcode}</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/inventory/${p.id}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition-all flex-shrink-0"
                  >
                    <MapPin size={12} /> Set Location
                  </Link>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── QR MODAL ── */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setQrOpen(null)}
          />
          <div
            className="relative bg-[#161b27] border border-[#21293d] rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl"
            style={{ animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            <button
              onClick={() => setQrOpen(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-[#111520] hover:bg-white/5 text-slate-500 hover:text-slate-300 border border-[#21293d] transition-all"
            >
              <X size={15} />
            </button>
            <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mb-3">
              <QrCode size={20} className="text-emerald-400" />
            </div>
            <h3 className="text-white font-black">Shelf Location QR</h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1 break-words">
              {locPath(qrOpen)}
            </p>
            <div className="mt-4 bg-white rounded-2xl p-3 inline-block mx-auto">
              {qrUrl ? (
                <Image src={qrUrl} alt="QR" width={176} height={176} className="w-44 h-44" />
              ) : (
                <Loader2 size={40} className="animate-spin text-slate-500" />
              )}
            </div>
            <p className="text-[9px] text-slate-600 mt-3 font-bold uppercase tracking-widest">
              Label chipkao · Spare Finder me scan karo
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={copyToken}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl text-xs font-bold hover:border-emerald-500/40 transition-all"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{" "}
                {copied ? "Copied!" : "Copy Token"}
              </button>
              <button
                onClick={() => printOneLabel(qrOpen)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all"
              >
                <Printer size={13} /> Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHELF LABELS MODAL ── */}
      {printOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPrintOpen(false)}
          />
          <div
            className="relative bg-[#161b27] border border-[#21293d] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            style={{ animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            <button
              onClick={() => setPrintOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-[#111520] hover:bg-white/5 text-slate-500 hover:text-slate-300 border border-[#21293d] transition-all"
            >
              <X size={15} />
            </button>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mb-3">
              <Printer size={20} className="text-emerald-400" />
            </div>
            <h3 className="text-white font-black">Shelf Location Labels</h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
              {stats.locations} locations. Har label par QR hota hai — print karke shelf/box par
              chipkayein. Scan karne par Spare Finder me wo location khulegi.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setPrintOpen(false)}
                className="flex-1 py-3 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl text-sm font-bold hover:border-slate-500 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={printAllLabels}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2"
              >
                <Printer size={14} /> Print All ({stats.locations})
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}

// ─── Recursive location tree ────────────────────────────────────────────────
function RecursiveTree({
  root,
  expanded,
  setExpanded,
  activeLoc,
  setActiveLoc,
  onQr,
}: {
  root: TreeNode;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeLoc: string | null;
  setActiveLoc: (p: string) => void;
  onQr: (parts: LocationParts) => void;
}) {
  const nodes = useMemo(() => {
    const arr = [...root.children.values()];
    arr.sort((a, b) => a.label.localeCompare(b.label));
    return arr;
  }, [root]);

  return (
    <>
      {nodes.map((node) => {
        const isOpen = expanded.has(node.key);
        const hasChildren = node.children.size > 0;
        const isActive = activeLoc === node.path;
        return (
          <div key={node.key}>
            <div
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all cursor-pointer border ${
                isActive
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "hover:bg-white/[0.03] border-transparent"
              }`}
              style={{ marginLeft: node.level * 18 }}
              onClick={() => {
                if (hasChildren) {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.key)) next.delete(node.key);
                    else next.add(node.key);
                    return next;
                  });
                }
                setActiveLoc(node.path);
              }}
            >
              <div className="flex-shrink-0 text-emerald-500/80">
                {node.level === 0 ? (
                  <MapPin size={14} />
                ) : node.level === 1 ? (
                  <Boxes size={13} />
                ) : node.level === 2 ? (
                  <Package size={12} />
                ) : (
                  <QrCode size={12} />
                )}
              </div>
              {hasChildren ? (
                isOpen ? (
                  <ChevronDown size={13} className="text-slate-600 flex-shrink-0" />
                ) : (
                  <ChevronRight size={13} className="text-slate-600 flex-shrink-0" />
                )
              ) : (
                <span className="w-3.5 flex-shrink-0" />
              )}
              <div
                className={`flex-1 min-w-0 font-bold text-sm ${isActive ? "text-emerald-300" : "text-slate-300"}`}
              >
                {node.label}
              </div>
              <span className="text-[10px] text-slate-600 font-bold flex-shrink-0">
                {node.allProducts.length} prod · {sumUnits(node.allProducts)} unit
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQr(node.parts);
                }}
                className="p-1.5 bg-[#111520] border border-[#21293d] hover:border-emerald-500/40 text-slate-500 hover:text-emerald-400 rounded-lg transition-all flex-shrink-0"
                title="Shelf QR label"
              >
                <QrCode size={12} />
              </button>
            </div>

            {node.ownProducts.length > 0 && (
              <div className="space-y-1 py-1" style={{ marginLeft: node.level * 18 + 22 }}>
                {[...node.ownProducts]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((x) => (
                    <Link
                      key={x.id}
                      href={`/inventory/${x.id}`}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111520] border border-[#21293d] hover:border-emerald-500/30 transition-all group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-xs font-bold text-slate-300 group-hover:text-emerald-300 truncate">
                        {x.name}
                      </span>
                      <span className="text-[10px] font-black text-emerald-400 flex-shrink-0">
                        {x.qty} unit
                      </span>
                      <LinkIcon
                        size={10}
                        className="text-slate-700 group-hover:text-emerald-400 flex-shrink-0"
                      />
                    </Link>
                  ))}
              </div>
            )}

            {hasChildren && isOpen && (
              <RecursiveTree
                root={node}
                expanded={expanded}
                setExpanded={setExpanded}
                activeLoc={activeLoc}
                setActiveLoc={setActiveLoc}
                onQr={onQr}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
