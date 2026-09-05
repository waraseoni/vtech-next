"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Package,
  Box,
  Loader2,
  RefreshCw,
  Settings2,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  printBoxLabels,
  itemsLayout,
  DEFAULT_BOX_PRINT_OPTIONS,
  type BoxLabelData,
  type BoxPrintOptions,
} from "@/lib/boxPrint";
import type { LocationParts } from "@/lib/locations";

/* ─── types ─────────────────────────────────────────────────────────────── */

type BoxOption = {
  id: number;
  name: string;
  path: string;
  binId: number | null;
};

type BoxRow = BoxLabelData & {
  qty: number;
  printQty: number;
  selected?: boolean;
};

type LocRow = {
  id: number;
  box_id: number | null;
  zone: string | null;
  rack: string | null;
  bin: string | null;
  box: string | null;
};

type ProductLoc = {
  location_id: number;
  product_id: number;
  product_list?: { name?: string } | null;
};

/* ─── helpers ───────────────────────────────────────────────────────────── */

const toParts = (r: {
  zone?: string | null;
  rack?: string | null;
  bin?: string | null;
  box?: string | null;
}): Partial<LocationParts> => ({
  zone: r.zone ?? undefined,
  rack: r.rack ?? undefined,
  bin: r.bin ?? undefined,
  box: r.box ?? undefined,
});

/* ─── page ──────────────────────────────────────────────────────────────── */

export default function BoxLabelsPage() {
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [boxOptions, setBoxOptions] = useState<BoxOption[]>([]);
  const [partsMap, setPartsMap] = useState<Record<string, Partial<LocationParts> | null>>({});
  const [loadingBoxes, setLoadingBoxes] = useState(true);

  // collapsible box content dropdowns — Set of indices currently open
  const [openDropdowns, setOpenDropdowns] = useState<Set<number>>(new Set());

  // Search query for filtering boxes in list
  const [searchQuery, setSearchQuery] = useState("");

  // Sheet / Drawer Preview toggles
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(true);
  const [previewTab, setPreviewTab] = useState<"sheet" | "single">("sheet");

  // existing box selector — selected box id ("" = manual)
  const [selectedBoxId, setSelectedBoxId] = useState<string>("");
  const [pendingLoad, setPendingLoad] = useState(false);

  // print settings
  const [options, setOptions] = useState<BoxPrintOptions>({
    ...DEFAULT_BOX_PRINT_OPTIONS,
  });
  const [showSettings, setShowSettings] = useState(false);

  const loadExistingBoxes = useCallback(async () => {
    setLoadingBoxes(true);
    try {
      const [manageRes, locRes] = await Promise.all([
        fetch("/api/locations/manage?tab=full"),
        fetch("/api/locations"),
      ]);
      const manageJson = await manageRes.json();
      const locJson = await locRes.json();

      const boxesRaw = (manageJson.boxes || []) as Array<{
        id: number;
        name: string;
        bin_id: number | null;
        location_bins?: {
          name?: string;
          location_racks?: { name?: string; location_zones?: { name?: string } | null } | null;
        } | null;
      }>;

      const options: BoxOption[] = boxesRaw.map((b) => {
        const zone = b.location_bins?.location_racks?.location_zones?.name || "";
        const rack = b.location_bins?.location_racks?.name || "";
        const bin = b.location_bins?.name || "";
        const path = [zone, rack, bin, b.name].filter(Boolean).join(" ▸ ");
        return { id: b.id, name: b.name, path, binId: b.bin_id ?? null };
      });
      setBoxOptions(options);

      // Build boxId → parts from `locations` rows (denormalized path strings).
      const locRows = (locJson.locations || []) as LocRow[];
      const partsByBox: Record<number, Partial<LocationParts> | null> = {};
      for (const loc of locRows) {
        if (!loc.box_id) continue;
        if (!partsByBox[loc.box_id]) partsByBox[loc.box_id] = toParts(loc);
      }

      const plMap = new Map<number, string[]>();
      (locJson.productLocations || ([] as ProductLoc[])).forEach((pl: ProductLoc) => {
        const boxId = locRows.find((l) => l.id === pl.location_id)?.box_id;
        if (boxId == null) return;
        const name = pl.product_list?.name;
        if (!name) return;
        const arr = plMap.get(boxId) || [];
        if (!arr.includes(name)) arr.push(name);
        plMap.set(boxId, arr);
      });

      // Populate boxesList with all existing boxes so user can select + print.
      const existing: BoxRow[] = options.map((o) => ({
        boxId: o.name,
        locationPath: o.path,
        items: (plMap.get(o.id) || []).map((n) => ({ name: n })),
        qty: 1,
        printQty: 1,
        selected: false,
      }));
      setBoxes(existing);
      setPartsMap(Object.fromEntries(options.map((o) => [o.name, partsByBox[o.id] || null])));
    } catch (err) {
      alert("Box load fail: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingBoxes(false);
    }
  }, []);

  useEffect(() => {
    loadExistingBoxes();
  }, [loadExistingBoxes]);

  // Deep-link: ?box=<encoded path> ya ?id=<boxId> se koi box select karo.
  useEffect(() => {
    if (loadingBoxes || pendingLoad) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const pathParam = params.get("box");
    if (idParam) {
      setSelectedBoxId(idParam);
      window.history.replaceState(null, "", "/inventory/box-labels");
      return;
    }
    if (pathParam) {
      const path = decodeURIComponent(pathParam);
      const match = boxOptions.find((o) => o.path === path || o.name === path);
      if (match) {
        setSelectedBoxId(String(match.id));
        window.history.replaceState(null, "", "/inventory/box-labels");
      }
    }
  }, [loadingBoxes, pendingLoad, boxOptions]);

  /* ── box add / edit (manual fallback) ─────────────────────────────────── */

  const addBox = () => {
    setBoxes((prev) => [
      {
        boxId: `BOX-${String(prev.length + 1).padStart(2, "0")}`,
        locationPath: "",
        items: [],
        qty: 1,
        printQty: 1,
        selected: true,
      },
      ...prev,
    ]);
  };

  const removeBox = (idx: number) => {
    setBoxes((prev) => prev.filter((_, i) => i !== idx));
  };

  const linkBoxToExisting = (idx: number, boxName: string) => {
    if (!boxName) return;
    const opt = boxOptions.find((o) => o.name === boxName || o.path === boxName);
    if (!opt) return;
    const existing = boxes.find((b) => b.boxId === opt.name);
    setBoxes((prev) =>
      prev.map((b, i) =>
        i === idx
          ? {
              ...b,
              boxId: opt.name,
              locationPath: opt.path,
              items: existing ? existing.items.map((x) => ({ name: x.name })) : [],
            }
          : b
      )
    );
    setPartsMap((m) => ({ ...m, [opt.name]: m[opt.name] != null ? m[opt.name] : null }));
  };

  const updateBoxId = (idx: number, val: string) => {
    setBoxes((prev) => prev.map((b, i) => (i === idx ? { ...b, boxId: val } : b)));
  };

  const updateLocation = (idx: number, val: string) => {
    setBoxes((prev) => prev.map((b, i) => (i === idx ? { ...b, locationPath: val } : b)));
  };

  const updatePrintQty = (idx: number, qty: number) => {
    const safeQty = Math.max(1, Math.min(999, qty || 1));
    setBoxes((prev) => prev.map((b, i) => (i === idx ? { ...b, printQty: safeQty } : b)));
  };

  const toggleSelectBox = (idx: number) => {
    setBoxes((prev) => prev.map((b, i) => (i === idx ? { ...b, selected: !b.selected } : b)));
  };

  const toggleSelectAll = (select: boolean) => {
    setBoxes((prev) => prev.map((b) => ({ ...b, selected: select })));
  };

  const toggleDropdown = (idx: number) => {
    setOpenDropdowns((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const addItem = (idx: number) => {
    setBoxes((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, items: [...b.items, { name: "" }] } : b))
    );
    // ensure dropdown opens when adding an item
    setOpenDropdowns((prev) => new Set(prev).add(idx));
  };

  const removeItem = (boxIdx: number, itemIdx: number) => {
    setBoxes((prev) =>
      prev.map((b, i) =>
        i === boxIdx ? { ...b, items: b.items.filter((_, j) => j !== itemIdx) } : b
      )
    );
  };

  const updateItem = (boxIdx: number, itemIdx: number, val: string) => {
    setBoxes((prev) =>
      prev.map((b, i) =>
        i === boxIdx
          ? { ...b, items: b.items.map((it, j) => (j === itemIdx ? { ...it, name: val } : it)) }
          : b
      )
    );
  };

  /* ── load a selected existing box into the editable list ──────────────── */

  const handleSelectBox = (idStr: string) => {
    setSelectedBoxId(idStr);
    if (!idStr) return;
    setPendingLoad(true);
    const opt = boxOptions.find((o) => o.id === Number(idStr));
    if (!opt) {
      setPendingLoad(false);
      return;
    }
    // ensure this box is marked selected and scrolled or added
    setBoxes((prev) => {
      const exists = prev.find((b) => b.boxId === opt.name);
      if (exists) {
        return prev.map((b) => (b.boxId === opt.name ? { ...b, selected: true } : b));
      }
      return [
        {
          boxId: opt.name,
          locationPath: opt.path,
          items: [],
          qty: 1,
          printQty: 1,
          selected: true,
        },
        ...prev,
      ];
    });
    setPendingLoad(false);
  };

  // Determine which boxes are currently active for print & preview
  const selectedBoxes = useMemo(() => {
    const explicitlySelected = boxes.filter((b) => b.selected);
    if (explicitlySelected.length > 0) return explicitlySelected;
    // If no box is explicitly selected, fall back to all valid boxes
    return boxes.filter((b) => b.boxId.trim());
  }, [boxes]);

  // Expanded print list based on printQty
  const printItemsList = useMemo(() => {
    const list: BoxRow[] = [];
    selectedBoxes.forEach((b) => {
      const count = Math.max(1, b.printQty || 1);
      for (let i = 0; i < count; i++) {
        list.push(b);
      }
    });
    return list;
  }, [selectedBoxes]);

  const handlePrint = useCallback(() => {
    if (!selectedBoxes.length) {
      alert("Koi box select nahi hai.");
      return;
    }
    printBoxLabels(selectedBoxes, options, partsMap);
  }, [selectedBoxes, partsMap, options]);

  const selectedBox = boxOptions.find((o) => o.id === Number(selectedBoxId)) || null;

  // Filtered boxes for left search list
  const filteredBoxes = useMemo(() => {
    if (!searchQuery.trim()) return boxes;
    const q = searchQuery.toLowerCase();
    return boxes.filter(
      (b) =>
        b.boxId.toLowerCase().includes(q) ||
        (b.locationPath && b.locationPath.toLowerCase().includes(q)) ||
        b.items.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [boxes, searchQuery]);

  const totalLabelsToPrint = printItemsList.length;
  const labelsPerPage = options.cols * options.rows;
  const totalPages = Math.ceil(totalLabelsToPrint / (labelsPerPage || 1)) || 1;

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-200">
      {/* Top sticky header */}
      <div className="sticky top-0 z-30 bg-[#161b27] border-b border-[#21293d] px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="bg-[#21293d] hover:bg-[#2a3550] text-slate-300 rounded-lg p-2 transition-colors no-underline"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <Package size={18} className="text-blue-400" />
            <div>
              <h1 className="text-sm font-black text-white leading-tight">Box Labels Printing</h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Total {boxes.length} box(es)</span>
                <span>•</span>
                <span className="text-blue-400 font-bold">
                  {selectedBoxes.length} box selected ({totalLabelsToPrint} print labels, {totalPages} page(s))
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadExistingBoxes}
            disabled={loadingBoxes}
            className="border-none rounded-lg px-3 py-2 font-bold text-xs cursor-pointer hover:bg-[#2a3550] disabled:opacity-60 flex items-center gap-1.5 bg-[#21293d] text-slate-300"
            title="Refresh boxes list"
          >
            <RefreshCw size={13} className={loadingBoxes ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={addBox}
            className="border-none rounded-lg px-3 py-2 font-bold text-xs cursor-pointer hover:bg-emerald-500 flex items-center gap-1.5 bg-emerald-600 !text-white"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add Custom Box</span>
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`border-none rounded-lg px-3 py-2 font-bold text-xs cursor-pointer hover:bg-[#2a3550] flex items-center gap-1.5 ${
              showSettings ? "bg-blue-600 !text-white" : "bg-[#21293d] text-slate-300"
            }`}
          >
            <Settings2 size={13} />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={() => setShowPreviewDrawer((v) => !v)}
            className={`border-none rounded-lg px-3 py-2 font-bold text-xs cursor-pointer flex items-center gap-1.5 ${
              showPreviewDrawer
                ? "bg-purple-600 hover:bg-purple-500 !text-white"
                : "bg-[#21293d] hover:bg-[#2a3550] text-purple-300"
            }`}
            title="Toggle Live Preview Drawer"
          >
            {showPreviewDrawer ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showPreviewDrawer ? "Hide Preview" : "Show Preview"}</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={selectedBoxes.length === 0}
            className="!text-white border-none rounded-lg px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 bg-blue-600 shadow-md shadow-blue-600/30"
          >
            <Printer size={13} />
            <span>Print ({totalLabelsToPrint})</span>
          </button>
        </div>
      </div>

      {/* Main container with Left content & Sticky Right Preview */}
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COLUMN: Controls & Box List */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* Settings Panel (collapsible) */}
          {showSettings && (
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#21293d]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-blue-400" />
                  <h2 className="text-xs font-black text-white uppercase tracking-wider">
                    Print & Sheet Settings
                  </h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Label W (mm)
                  </label>
                  <input
                    type="number"
                    value={options.widthMm}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, widthMm: Number(e.target.value) || 80 }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Label H (mm)
                  </label>
                  <input
                    type="number"
                    value={options.heightMm}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, heightMm: Number(e.target.value) || 40 }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Sheet Cols
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={options.cols}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        cols: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Sheet Rows
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={options.rows}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        rows: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Max Font (pt)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={20}
                    value={options.maxFont}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        maxFont: Math.max(5, Math.min(20, Number(e.target.value) || 11)),
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Contents area settings */}
              <div className="mt-4 pt-3 border-t border-[#21293d] grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Content Columns (0 = auto)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={options.contentCols}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        contentCols: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Max Lines per Item (0 = auto / 2)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={options.contentRows}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        contentRows: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                    Content Font (pt, 0 = auto)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={options.fontSizePt}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        fontSizePt: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Existing Box Quick Jump & Search / Selection toolbar */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="w-full sm:flex-1 relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter boxes by name, location, or item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <select
                  value={selectedBoxId}
                  onChange={(e) => handleSelectBox(e.target.value)}
                  disabled={loadingBoxes}
                  className="flex-1 sm:w-64 bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingBoxes ? "Loading boxes..." : "— Jump & select existing box —"}
                  </option>
                  {boxOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.path || o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick action bar for selecting boxes */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#21293d] text-slate-400">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSelectAll(true)}
                  className="hover:text-white flex items-center gap-1 text-[11px] font-semibold bg-[#21293d] px-2 py-1 rounded"
                >
                  <CheckSquare size={12} className="text-blue-400" /> Select All
                </button>
                <button
                  onClick={() => toggleSelectAll(false)}
                  className="hover:text-white flex items-center gap-1 text-[11px] font-semibold bg-[#21293d] px-2 py-1 rounded"
                >
                  <Square size={12} /> Deselect All
                </button>
              </div>
              <span className="text-[11px]">
                Showing {filteredBoxes.length} of {boxes.length} boxes
              </span>
            </div>
          </div>

          {/* Box List Cards */}
          <div className="space-y-3">
            {loadingBoxes && (
              <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                Boxes load ho rahe hain...
              </div>
            )}

            {!loadingBoxes && filteredBoxes.length === 0 && (
              <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-8 text-center text-slate-400 text-xs">
                Koi box match nahi hua. Aap upar &quot;Add Custom Box&quot; se naya bana sakte hain.
              </div>
            )}

            {filteredBoxes.map((box) => {
              // Find the original index in the main boxes array
              const originalIdx = boxes.findIndex((b) => b === box);
              const isOpen = openDropdowns.has(originalIdx);
              const isSelected = !!box.selected;

              return (
                <div
                  key={originalIdx}
                  className={`bg-[#161b27] border transition-all rounded-xl overflow-hidden ${
                    isSelected
                      ? "border-blue-500/60 bg-[#161f33]/70 shadow-md shadow-blue-500/5"
                      : "border-[#21293d] hover:border-slate-700"
                  }`}
                >
                  {/* Card Header Row: Checkbox, Box ID, Location, Copies/PrintQty, and Dropdown toggle */}
                  <div className="p-3.5 flex flex-wrap sm:flex-nowrap items-center gap-3">
                    {/* Checkbox to include/exclude */}
                    <button
                      type="button"
                      onClick={() => toggleSelectBox(originalIdx)}
                      className="cursor-pointer text-slate-400 hover:text-white p-0.5"
                      title={isSelected ? "Deselect box" : "Select box for printing"}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-blue-400 fill-blue-500/20" />
                      ) : (
                        <Square size={18} className="text-slate-500" />
                      )}
                    </button>

                    {/* Box Title & Badges */}
                    <div className="flex-1 min-w-[200px] flex items-center gap-2">
                      <input
                        type="text"
                        value={box.boxId}
                        onChange={(e) => updateBoxId(originalIdx, e.target.value)}
                        placeholder="Box ID (e.g. BOX-01)"
                        className="w-32 sm:w-36 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-1.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={box.locationPath || ""}
                        onChange={(e) => updateLocation(originalIdx, e.target.value)}
                        placeholder="Location (Zone ▸ Rack ▸ Bin)"
                        className="flex-1 min-w-[140px] bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Print Copies Control */}
                    <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg px-2 py-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Print Copies:
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={box.printQty || 1}
                        onChange={(e) =>
                          updatePrintQty(originalIdx, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-12 bg-transparent text-center font-bold text-xs text-white outline-none focus:text-blue-400"
                      />
                    </div>

                    {/* Expand/Collapse Items Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => toggleDropdown(originalIdx)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isOpen
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "bg-[#21293d] hover:bg-[#2a3550] text-slate-300"
                      }`}
                    >
                      <Package size={13} />
                      <span>{box.items.length} Items</span>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {/* Delete Box button */}
                    <button
                      onClick={() => removeBox(originalIdx)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove this box"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* COLLAPSIBLE / DROPDOWN ITEMS SECTION */}
                  {isOpen && (
                    <div className="border-t border-[#21293d] bg-[#0d1117]/60 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                          <Package size={13} className="text-blue-400" />
                          Contents / Items List in {box.boxId || "this box"}
                        </div>
                        {/* Optional link to existing box selector */}
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-slate-500">Sync with:</label>
                          <select
                            value=""
                            onChange={(e) => linkBoxToExisting(originalIdx, e.target.value)}
                            className="bg-[#161b27] border border-[#21293d] rounded px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-blue-500"
                          >
                            <option value="">— Link existing box —</option>
                            {boxOptions.map((o) => (
                              <option key={o.id} value={o.name}>
                                {o.name} ({o.path})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Items Grid/List */}
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {box.items.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-2">
                            Is box me abhi koi item nahi hai. Niche &quot;+ Add Item&quot; dabayein.
                          </div>
                        ) : (
                          box.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 w-5 text-right font-mono">
                                {itemIdx + 1}.
                              </span>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  updateItem(originalIdx, itemIdx, e.target.value)
                                }
                                placeholder="Item / Product Name"
                                className="flex-1 bg-[#161b27] border border-[#21293d] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500"
                              />
                              <button
                                onClick={() => removeItem(originalIdx, itemIdx)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                title="Delete item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <button
                        onClick={() => addItem(originalIdx)}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 pt-1"
                      >
                        <Plus size={13} /> Add Item to Box
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: STICKY LIVE PREVIEW AREA */}
        {showPreviewDrawer && (
          <div className="w-full lg:w-[460px] lg:sticky lg:top-20 shrink-0 space-y-3">
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#21293d]">
                <div className="flex items-center gap-2">
                  <Eye size={15} className="text-purple-400" />
                  <h2 className="text-xs font-black text-white uppercase tracking-wider">
                    Live Print Preview
                  </h2>
                </div>
                {/* Switch between A4 Sheet Grid & Single Label preview */}
                <div className="flex items-center bg-[#0d1117] p-0.5 rounded-lg border border-[#21293d]">
                  <button
                    onClick={() => setPreviewTab("sheet")}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                      previewTab === "sheet"
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    A4 Sheet ({options.cols}×{options.rows})
                  </button>
                  <button
                    onClick={() => setPreviewTab("single")}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                      previewTab === "single"
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Label Detail
                  </button>
                </div>
              </div>

              {/* Status summary */}
              <div className="text-[11px] text-slate-400 mb-3 flex items-center justify-between">
                <span>
                  Showing {printItemsList.length} total label(s)
                </span>
                <span className="font-semibold text-purple-400">
                  {totalPages} Page(s) • {options.widthMm}×{options.heightMm}mm
                </span>
              </div>

              {/* Preview Canvas */}
              <div className="flex justify-center bg-[#0d1117] p-3 rounded-xl border border-[#21293d] overflow-x-auto max-h-[72vh] overflow-y-auto">
                {previewTab === "sheet" ? (
                  <SheetPreview options={options} boxesToPrint={printItemsList} />
                ) : (
                  <div className="bg-white rounded-xl p-3 inline-block border border-slate-300 shadow-sm">
                    <TemplatePreviewCard
                      box={
                        selectedBoxes[0] ||
                        boxes[0] || {
                          boxId: "BOX-01",
                          locationPath: "Zone ▸ Rack ▸ Bin",
                          items: [{ name: "Sample Item" }],
                        }
                      }
                      options={options}
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-[#21293d] flex items-center justify-between">
                <span className="text-[10px] text-slate-500">
                  {selectedBoxes.length} box(es) selected for print
                </span>
                <button
                  onClick={handlePrint}
                  disabled={selectedBoxes.length === 0}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 !text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Print Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── inline template preview card (Single Label) ────────────────────────── */
function TemplatePreviewCard({
  box,
  options,
}: {
  box: BoxLabelData;
  options: BoxPrintOptions;
}) {
  const cellBorder = "1px solid #cbd5e1";
  const cellRadius = 7;
  const n = box.items.length;
  const { cols, fonts, capacity } = itemsLayout(n, options, box.items.map((i) => i.name));
  const visibleItems = box.items.slice(0, capacity);
  const fontPt = (fonts[0] || 8) as number;
  const fontPx = fontPt * 1.333;
  const W = options.widthMm * 3.78;
  const H = options.heightMm * 3.78;
  const rightColWidth = Math.min(H * 0.72, 28) * 3.78;

  return (
    <div
      style={{
        width: W,
        height: H,
        border: "1px solid #94a3b8",
        borderRadius: 11,
        padding: "5px 6px",
        display: "flex",
        alignItems: "stretch",
        gap: 5,
        overflow: "hidden",
        fontFamily: "Arial, Helvetica, sans-serif",
        background: "#fff",
      }}
    >
      {/* Left — content box */}
      <div
        style={{
          flex: 1,
          border: cellBorder,
          borderRadius: cellRadius,
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          padding: "4px 7px",
          gap: 2,
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 6.5,
            fontWeight: 900,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            lineHeight: 1,
          }}
        >
          Contents
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: n > 0 ? `repeat(${cols}, 1fr)` : undefined,
            gridAutoRows: "1fr",
            columnGap: 5,
            rowGap: 2,
            flex: 1,
            minHeight: 0,
            alignContent: "start",
            overflow: "hidden",
          }}
        >
          {visibleItems.length > 0 ? (
            visibleItems.map((it, i) => (
              <div
                key={i}
                style={{
                  fontSize: fontPx,
                  fontWeight: 800,
                  color: "#1f2937",
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {it.name || "—"}
              </div>
            ))
          ) : (
            <div
              style={{ fontSize: fontPx, fontWeight: 800, color: "#9ca3af", fontStyle: "italic" }}
            >
              — khali —
            </div>
          )}
        </div>
      </div>

      {/* Right — Box ID, QR, Location */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          width: rightColWidth,
        }}
      >
        {/* Box ID */}
        <div
          style={{
            background: "#0d1117",
            border: "1px solid #0d1117",
            borderRadius: cellRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "3px 5px",
            overflow: "hidden",
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 900, color: "#8a94a6", letterSpacing: "0.1em" }}>
            BOX
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {box.boxId || "BOX-XX"}
          </span>
        </div>

        {/* QR */}
        <div
          style={{
            flex: 1,
            border: cellBorder,
            borderRadius: cellRadius,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 3,
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "1",
              background: "#0d1117",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.05em" }}>
              QR
            </span>
          </div>
        </div>

        {/* Location — Multi-line word-wrap taaki kate nahi */}
        <div
          style={{
            border: cellBorder,
            borderRadius: cellRadius,
            background: "#f8fafc",
            fontSize: 5.5,
            fontWeight: 700,
            color: "#334155",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            textAlign: "center",
            lineHeight: 1.15,
            wordBreak: "break-word",
            whiteSpace: "normal",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            padding: "2px 4px",
            maxHeight: 22,
          }}
          title={box.locationPath || "Location"}
        >
          {box.locationPath || "Location"}
        </div>
      </div>
    </div>
  );
}

/* ── A4 sheet layout preview — displays realistic mini labels ── */
function SheetPreview({
  options,
  boxesToPrint = [],
}: {
  options: BoxPrintOptions;
  boxesToPrint?: BoxRow[];
}) {
  const A4_W = 210;
  const A4_H = 297;
  const MARGIN = 10;
  const usableW = A4_W - MARGIN * 2;
  const usableH = A4_H - MARGIN * 2;
  const gapMm = options.gapMm;

  // Fit sheet to ~380px width
  const targetW = 380;
  const scale = targetW / A4_W;
  const sheetW = A4_W * scale;
  const sheetH = A4_H * scale;

  const cellW = (usableW - (options.cols - 1) * gapMm) / options.cols;
  const cellH = (usableH - (options.rows - 1) * gapMm) / options.rows;
  const cellPxW = cellW * scale;
  const cellPxH = cellH * scale;

  const totalSlots = options.cols * options.rows;
  const cells = [];

  for (let slot = 0; slot < totalSlots; slot++) {
    const item = boxesToPrint[slot];
    if (item) {
      // Calculate realistic item layout for mini cell
      const n = item.items.length;
      const { cols, fonts, capacity } = itemsLayout(n, options, item.items.map((i) => i.name));
      const visibleItems = item.items.slice(0, capacity);
      const miniFontScale = cellPxH / (options.heightMm * 3.78);
      const fontPt = (fonts[0] || 8) as number;

      cells.push(
        <div
          key={slot}
          style={{
            width: cellPxW,
            height: cellPxH,
            border: "1px solid #94a3b8",
            borderRadius: 3,
            background: "#ffffff",
            display: "flex",
            alignItems: "stretch",
            gap: 2,
            padding: "2px 3px",
            overflow: "hidden",
            boxSizing: "border-box",
            fontFamily: "Arial, sans-serif",
          }}
          title={`${item.boxId}: ${item.locationPath || "No Location"} (${item.items.length} items)`}
        >
          {/* Left mini contents grid */}
          <div
            style={{
              flex: 1,
              border: "1px solid #e2e8f0",
              borderRadius: 2,
              background: "#f8fafc",
              padding: "1.5px 2px",
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 4,
                fontWeight: 900,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                lineHeight: 1,
                marginBottom: 1,
              }}
            >
              Contents
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: n > 0 ? `repeat(${cols}, 1fr)` : undefined,
                gridAutoRows: "1fr",
                columnGap: 2,
                rowGap: 1,
                flex: 1,
                minHeight: 0,
                alignContent: "start",
                overflow: "hidden",
              }}
            >
              {visibleItems.length > 0 ? (
                visibleItems.slice(0, 10).map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: Math.max(3, fontPt * 1.333 * miniFontScale),
                      fontWeight: 800,
                      color: "#1e293b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    {it.name}
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 4, color: "#cbd5e1", fontStyle: "italic" }}>— khali —</span>
              )}
            </div>
          </div>

          {/* Right mini column: BOX ID + QR placeholder + Location */}
          <div
            style={{
              width: Math.min(cellPxH * 0.72, 40),
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {/* Box ID */}
            <div
              style={{
                background: "#0d1117",
                borderRadius: 2,
                padding: "1px 2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                overflow: "hidden",
              }}
            >
              <span style={{ fontSize: 3.5, fontWeight: 900, color: "#94a3b8" }}>BOX</span>
              <span
                style={{
                  fontSize: 5,
                  fontWeight: 900,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.boxId}
              </span>
            </div>

            {/* QR box */}
            <div
              style={{
                flex: 1,
                border: "1px solid #e2e8f0",
                borderRadius: 2,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 0,
                padding: 1,
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  background: "#0d1117",
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#fff", fontSize: 4, fontWeight: 700 }}>QR</span>
              </div>
            </div>

            {/* Location (with multi-line wrap) */}
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 2,
                background: "#f8fafc",
                fontSize: 3.5,
                fontWeight: 700,
                color: "#334155",
                textAlign: "center",
                lineHeight: 1.1,
                wordBreak: "break-word",
                whiteSpace: "normal",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                padding: "1px 1.5px",
                maxHeight: 12,
              }}
              title={item.locationPath || "Location"}
            >
              {item.locationPath ? item.locationPath.split(" ▸ ").slice(-2).join(" ▸ ") : "—"}
            </div>
          </div>
        </div>
      );
    } else {
      cells.push(
        <div
          key={slot}
          style={{
            width: cellPxW,
            height: cellPxH,
            border: "1px dashed #e2e8f0",
            borderRadius: 3,
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 5.5, fontWeight: 700, color: "#cbd5e1" }}>Empty</span>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        style={{
          width: sheetW,
          height: sheetH,
          border: "2px solid #cbd5e1",
          borderRadius: 6,
          background: "#fff",
          padding: MARGIN * scale,
          display: "grid",
          gridTemplateColumns: `repeat(${options.cols}, ${cellPxW}px)`,
          gridAutoRows: `${cellPxH}px`,
          gap: gapMm * scale,
          justifyContent: "center",
          alignContent: "center",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
        }}
      >
        {cells}
      </div>
      {boxesToPrint.length > totalSlots && (
        <p className="text-[10px] text-purple-400 mt-2 font-medium">
          + {boxesToPrint.length - totalSlots} aur label(s) agle page(s) par print honge
        </p>
      )}
    </div>
  );
}
