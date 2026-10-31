"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
} from "lucide-react";

import SearchableSelect from "@/components/SearchableSelect";
import WaPreviewModal from "@/components/WaPreviewModal";
import { supabase } from "@/lib/supabase";
import { fetchStockByProducts } from "@/lib/inventoryStock";
import { openWhatsApp } from "@/lib/whatsapp";
import { todayIST } from "@/lib/dateUtils";
import {
  buildEstimateWhatsAppMessage,
  clearEstimateDraft,
  computeEstimateTotals,
  createDefaultEstimateForm,
  lineAmount,
  loadEstimateDraft,
  newLineId,
  saveEstimateDraft,
  type EstimateForm,
  type EstimateLine,
  type EstimatePrintPayload,
} from "@/lib/estimate";
import EstimateLines from "./EstimateLines";
import EstimateTotals from "./EstimateTotals";

type ClientRow = {
  id: number;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  contact: string | null;
  email: string | null;
  address: string | null;
};

type ProductRow = { id: number; name: string; price: number | null };
type ServiceRow = { id: number; name: string; price: number | null };

const labelCls = "block text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-1.5";
const inputCls =
  "w-full bg-panel-2 border border-app rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-muted-2";

const inr = (n: number) => `₹${n.toFixed(2)}`;

const fullName = (c: ClientRow) =>
  [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim() || "Client";

export default function EstimateBuilder() {
  const [form, setForm] = useState<EstimateForm | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [stock, setStock] = useState<Map<number, number>>(new Map());
  const [shop, setShop] = useState({ name: "V-Tech", mobile: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    setToast({ text, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Draft restore (mount only). Form null until then — random ref SSR mismatch se bachne ke liye.
  useEffect(() => {
    const draft = loadEstimateDraft();
    setForm(draft ?? createDefaultEstimateForm(todayIST()));
    if (draft) notify("Draft restored");
  }, [notify]);

  // Master data — read-only (R1/R2/R3: koi write nahi).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [
          { data: cData, error: cErr },
          { data: pData, error: pErr },
          { data: sData, error: sErr },
          { data: info },
        ] = await Promise.all([
          supabase
            .from("client_list")
            .select("id, firstname, middlename, lastname, contact, email, address")
            .eq("delete_flag", 0)
            .order("firstname"),
          supabase
            .from("product_list")
            .select("id, name, price")
            .eq("delete_flag", 0)
            .eq("status", 1)
            .order("name"),
          supabase
            .from("service_list")
            .select("id, name, price")
            .eq("delete_flag", 0)
            .eq("status", 1)
            .order("name"),
          supabase
            .from("system_info")
            .select("meta_field, meta_value")
            .in("meta_field", ["name", "contact"]),
        ]);
        if (cErr) throw cErr;
        if (pErr) throw pErr;
        if (sErr) throw sErr;

        let stockMap = new Map<number, number>();
        try {
          const rows = await fetchStockByProducts((pData || []).map((p) => p.id));
          stockMap = new Map(Array.from(rows, ([id, row]) => [id, row.available]));
        } catch {
          /* stock display optional — RPC fail par warning hide */
        }

        if (!alive) return;
        setClients((cData || []) as ClientRow[]);
        setProducts((pData || []) as ProductRow[]);
        setServices((sData || []) as ServiceRow[]);
        setStock(stockMap);
        const infoMap: Record<string, string> = {};
        (info || []).forEach((r) => {
          if (r.meta_value != null) infoMap[r.meta_field] = String(r.meta_value);
        });
        setShop({ name: infoMap.name || "V-Tech", mobile: infoMap.contact || "" });
        setLoadError(null);
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Master data load fail");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Autosave (500ms debounce). Pristine form → draft clear, so "New" stays cleared.
  useEffect(() => {
    if (!form) return;
    const t = setTimeout(() => {
      const pristine =
        form.lines.length === 0 &&
        !form.client &&
        form.discountValue === 0 &&
        !form.remarks.trim() &&
        !form.gstEnabled;
      if (pristine) clearEstimateDraft();
      else saveEstimateDraft(form);
    }, 500);
    return () => clearTimeout(t);
  }, [form]);

  const totals = useMemo(
    () =>
      computeEstimateTotals(form?.lines ?? [], {
        gstEnabled: form?.gstEnabled ?? false,
        gstRate: form?.gstRate ?? 18,
        discountType: form?.discountType ?? "amount",
        discountValue: form?.discountValue ?? 0,
      }),
    [form]
  );

  const patchForm = useCallback((patch: Partial<EstimateForm>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
  }, []);

  const addLine = useCallback((line: EstimateLine) => {
    setForm((f) => (f ? { ...f, lines: [...f.lines, line] } : f));
  }, []);

  const updateLine = useCallback((id: string, patch: Partial<EstimateLine>) => {
    setForm((f) =>
      f ? { ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : f
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setForm((f) => (f ? { ...f, lines: f.lines.filter((l) => l.id !== id) } : f));
  }, []);

  const moveLine = useCallback((id: string, dir: -1 | 1) => {
    setForm((f) => {
      if (!f) return f;
      const i = f.lines.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= f.lines.length) return f;
      const lines = [...f.lines];
      [lines[i], lines[j]] = [lines[j], lines[i]];
      return { ...f, lines };
    });
  }, []);

  const pickProduct = useCallback(
    (idStr: string) => {
      const p = products.find((x) => String(x.id) === idStr);
      if (!p) return;
      setForm((f) => {
        if (!f) return f;
        const existing = f.lines.find((l) => l.kind === "inventory" && l.product_id === p.id);
        if (existing) {
          return {
            ...f,
            lines: f.lines.map((l) => (l.id === existing.id ? { ...l, qty: l.qty + 1 } : l)),
          };
        }
        return {
          ...f,
          lines: [
            ...f.lines,
            {
              id: newLineId(),
              kind: "inventory",
              product_id: p.id,
              service_id: null,
              name: p.name,
              hsn: null,
              qty: 1,
              rate: Math.max(0, Number(p.price) || 0),
            },
          ],
        };
      });
    },
    [products]
  );

  const pickService = useCallback(
    (idStr: string) => {
      const s = services.find((x) => String(x.id) === idStr);
      if (!s) return;
      addLine({
        id: newLineId(),
        kind: "service",
        product_id: null,
        service_id: s.id,
        name: s.name,
        hsn: null,
        qty: 1,
        rate: Math.max(0, Number(s.price) || 0),
      });
    },
    [services, addLine]
  );

  const pickClient = useCallback(
    (idStr: string) => {
      if (!idStr) {
        patchForm({ client: null });
        return;
      }
      const c = clients.find((x) => String(x.id) === idStr);
      if (!c) return;
      patchForm({
        client: {
          id: c.id,
          name: fullName(c),
          contact: c.contact || "",
          email: c.email || "",
          address: c.address || "",
        },
      });
    },
    [clients, patchForm]
  );

  const buildPayload = useCallback((): EstimatePrintPayload | null => {
    if (!form) return null;
    if (form.lines.some((l) => !l.name.trim() && lineAmount(l) > 0)) {
      notify("Har item ka naam likho", "err");
      return null;
    }
    const lines = form.lines
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name.trim(), hsn: l.hsn, qty: l.qty, rate: l.rate }));
    if (lines.length === 0) {
      notify("Kam se kam ek item ka naam likho", "err");
      return null;
    }
    return {
      reference: form.reference,
      date: form.date,
      validTill: form.validTill,
      client: form.client
        ? {
            name: form.client.name,
            mobile: form.client.contact,
            email: form.client.email,
            address: form.client.address,
          }
        : null,
      lines,
      gstEnabled: form.gstEnabled,
      gstRate: form.gstRate,
      discountType: form.discountType,
      discountValue: form.discountValue,
      remarks: form.remarks,
      printOptions: form.printOptions,
    };
  }, [form, notify]);

  const handlePrint = useCallback(() => {
    const payload = buildPayload();
    if (!payload) return;
    // Hidden form POST → response ke CSP/security headers naye tab par lagte hain.
    const f = document.createElement("form");
    f.method = "POST";
    f.action = "/api/print-estimate";
    f.target = "_blank";
    f.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);
    f.appendChild(input);
    document.body.appendChild(f);
    f.submit();
    setTimeout(() => f.remove(), 0);
  }, [buildPayload]);

  const handleWhatsApp = useCallback(() => {
    if (!form?.client?.contact) {
      notify("Pehle client select karo (WhatsApp number ke saath)", "err");
      return;
    }
    const msg = buildEstimateWhatsAppMessage(
      { name: shop.name, mobile: shop.mobile },
      form,
      totals
    );
    setWaMessage(msg);
    setWaOpen(true);
  }, [form, shop, totals, notify]);

  const handleNew = useCallback(() => {
    if (!window.confirm("Draft clear ho jayega. Naya estimate banayein?")) return;
    clearEstimateDraft();
    setForm(createDefaultEstimateForm(todayIST()));
    notify("Naya estimate ready");
  }, [notify]);

  if (!form) {
    return (
      <div className="bg-panel rounded-2xl border border-app p-10 flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin text-muted" />
        <span className="text-muted text-xs font-bold">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[130] px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-bold ${
            toast.tone === "err"
              ? "bg-red-950/90 border-red-500/40 text-red-200"
              : "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
          }`}
        >
          {toast.tone === "err" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          {toast.text}
        </div>
      )}

      {loadError && (
        <div className="bg-amber-500/10 border border-amber-600/35 dark:border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-200">
          Master data load fail: {loadError} — page refresh karke dobara try karo.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {/* Header / actions */}
          <div className="bg-panel rounded-2xl border border-app p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                  Estimate
                </p>
                <p className="text-[11px] text-muted-2 mt-0.5">
                  Sirf print/share — koi record save nahi hota
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition-colors"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="inline-flex items-center gap-1.5 bg-emerald-600/15 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/25 px-3.5 py-2 rounded-xl text-xs font-black transition-colors"
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleNew}
                  className="inline-flex items-center gap-1.5 bg-slate-700/30 text-muted border border-app hover:text-white px-3.5 py-2 rounded-xl text-xs font-black transition-colors"
                >
                  <RefreshCw size={14} /> New
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Ref. no.</label>
                <input
                  value={form.reference}
                  maxLength={60}
                  onChange={(e) => patchForm({ reference: e.target.value })}
                  className={inputCls}
                  placeholder="YYYYMMDD-XXX"
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => patchForm({ date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Valid till</label>
                <input
                  type="date"
                  value={form.validTill}
                  onChange={(e) => patchForm({ validTill: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Client */}
          <div className="bg-panel rounded-2xl border border-app p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-3">
              Client
            </p>
            <SearchableSelect
              value={form.client?.id ?? null}
              options={clients.map((c) => ({
                id: c.id,
                label: fullName(c),
                sub: c.contact || undefined,
              }))}
              onSelect={pickClient}
              placeholder="— Client select karo —"
              searchPlaceholder="Client ka naam ya number type karo…"
              emptyText="Koi client nahi mila"
              clearLabel="Client hatao"
            />
            {form.client && (
              <div className="mt-3 rounded-xl bg-panel-2 border border-app px-3 py-2.5 space-y-0.5">
                <p className="text-sm font-bold text-white">{form.client.name}</p>
                {form.client.contact && (
                  <p className="text-[11px] text-app-2">{form.client.contact}</p>
                )}
                {form.client.address && (
                  <p className="text-[11px] text-muted-2">{form.client.address}</p>
                )}
              </div>
            )}
          </div>

          {/* Add items */}
          <div className="bg-panel rounded-2xl border border-app p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                Items add karo
              </p>
              {loading && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-2">
                  <Loader2 size={11} className="animate-spin" /> Loading list…
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Inventory item</label>
                <SearchableSelect
                  value={null}
                  options={products.map((p) => ({
                    id: p.id,
                    label: p.name,
                    sub: `${inr(Math.max(0, Number(p.price) || 0))} — ${
                      stock.get(p.id) !== undefined ? `Stock: ${stock.get(p.id)}` : "Stock: —"
                    }`,
                  }))}
                  onSelect={pickProduct}
                  placeholder="— Product search karke add karo —"
                  searchPlaceholder="Product ka naam type karo…"
                  emptyText="Koi product nahi mila"
                />
              </div>
              <div>
                <label className={labelCls}>Service</label>
                <SearchableSelect
                  value={null}
                  options={services.map((s) => ({
                    id: s.id,
                    label: s.name,
                    sub: inr(Math.max(0, Number(s.price) || 0)),
                  }))}
                  onSelect={pickService}
                  placeholder="— Service search karke add karo —"
                  searchPlaceholder="Service ka naam type karo…"
                  emptyText="Koi service nahi mili"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() =>
                  addLine({
                    id: newLineId(),
                    kind: "custom_part",
                    product_id: null,
                    service_id: null,
                    name: "",
                    hsn: null,
                    qty: 1,
                    rate: 0,
                  })
                }
                className="w-full text-xs bg-slate-600/10 text-muted border border-dashed border-muted/40 px-3 py-2.5 rounded-xl hover:text-amber-300 hover:border-amber-500/40 transition-all inline-flex items-center justify-center gap-1.5"
              >
                <Plus size={13} /> Custom part add karo
              </button>
              <button
                type="button"
                onClick={() =>
                  addLine({
                    id: newLineId(),
                    kind: "custom_service",
                    product_id: null,
                    service_id: null,
                    name: "",
                    hsn: null,
                    qty: 1,
                    rate: 0,
                  })
                }
                className="w-full text-xs bg-slate-600/10 text-muted border border-dashed border-muted/40 px-3 py-2.5 rounded-xl hover:text-emerald-300 hover:border-emerald-500/40 transition-all inline-flex items-center justify-center gap-1.5"
              >
                <Plus size={13} /> Custom service add karo
              </button>
            </div>
          </div>

          {/* Lines */}
          <div className="bg-panel rounded-2xl border border-app p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Items</p>
              <span className="text-[10px] font-bold text-emerald-400">
                Subtotal: {inr(totals.subtotal)}
              </span>
            </div>
            <EstimateLines
              lines={form.lines}
              stock={stock}
              onChange={updateLine}
              onRemove={removeLine}
              onMove={moveLine}
            />
          </div>

          {/* Remarks */}
          <div className="bg-panel rounded-2xl border border-app p-5">
            <label className={labelCls}>Remarks / terms (optional)</label>
            <textarea
              value={form.remarks}
              onChange={(e) => patchForm({ remarks: e.target.value })}
              rows={3}
              maxLength={1000}
              placeholder="Validity, warranty, delivery ya payment terms…"
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <EstimateTotals form={form} totals={totals} onChange={patchForm} />

          <div className="bg-panel rounded-2xl border border-app p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              Print options
            </p>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-bold text-white">Document title print karein</span>
              <input
                type="checkbox"
                checked={form.printOptions.showTitle}
                onChange={(e) =>
                  patchForm({
                    printOptions: { ...form.printOptions, showTitle: e.target.checked },
                  })
                }
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </label>
            {form.printOptions.showTitle && (
              <input
                value={form.printOptions.title}
                maxLength={60}
                onChange={(e) =>
                  patchForm({
                    printOptions: { ...form.printOptions, title: e.target.value },
                  })
                }
                className={inputCls}
                placeholder="ESTIMATE / QUOTATION"
              />
            )}
            <label className="flex items-center justify-between gap-3 cursor-pointer border-t border-app pt-3">
              <span className="text-xs font-bold text-white">Disclaimer print karein</span>
              <input
                type="checkbox"
                checked={form.printOptions.showDisclaimer}
                onChange={(e) =>
                  patchForm({
                    printOptions: { ...form.printOptions, showDisclaimer: e.target.checked },
                  })
                }
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </label>
            {form.printOptions.showDisclaimer && (
              <textarea
                value={form.printOptions.disclaimer}
                maxLength={300}
                rows={3}
                onChange={(e) =>
                  patchForm({
                    printOptions: { ...form.printOptions, disclaimer: e.target.value },
                  })
                }
                className={`${inputCls} resize-y`}
              />
            )}
            <p className="text-[10px] text-muted-2 leading-relaxed border-t border-app pt-3">
              Dono off (default) par printed copy par koi estimate indication, watermark ya
              disclaimer nahi aata.
            </p>
          </div>
        </div>
      </div>

      {waOpen && form.client && (
        <WaPreviewModal
          title="WhatsApp Estimate"
          note={`Client: ${form.client.name} · ${form.client.contact}`}
          message={waMessage}
          onMessageChange={setWaMessage}
          onSend={(finalText) => {
            openWhatsApp(form.client?.contact || "", finalText);
            setWaOpen(false);
          }}
          onClose={() => setWaOpen(false)}
          sendLabel="WhatsApp kholo"
        />
      )}
    </div>
  );
}
