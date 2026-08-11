"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Printer, Filter, ChevronDown, ChevronUp,
  Loader2, AlertCircle, BookOpen, ArrowLeft,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const inr = (n: number, abs = true) =>
  "₹" + (abs ? Math.abs(n) : n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso; }
};

const STATUS_LABEL: Record<string | number, string> = {
  0: "Pending", 1: "In Progress", 2: "Done", 3: "Paid", 4: "Cancelled", 5: "Delivered",
  payment: "Payment", direct_sale: "Direct Sale", loan: "Loan", brought_fwd: "Brought Forward",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type LedgerRow = {
  date: string;
  desc: string;
  ref: string;
  status: string | number | null;
  remark: string;
  debit: number;
  credit: number;
  discount: number;
  effectiveCr: number;
  balance: number;
  isBroughtFwd: boolean;
};

type LedgerData = {
  client: { id: number; name: string; contact: string; email: string; opening_balance: number };
  firm: { name: string; address: string; contact: string; email: string };
  due: number;
  totals: { repairs: number; sales: number; loans: number; payments: number; discount: number };
  rows: LedgerRow[];
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function MyLedgerPage() {
  const router = useRouter();
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const fetchLedger = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (f) params.set("from", f);
      if (t) params.set("to", t);
      const qs = params.toString();
      const res = await fetch(`/api/client/ledger${qs ? `?${qs}` : ""}`);
      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) throw new Error("ledger failed");
      const j = await res.json();
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load nahi hua");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchLedger("", ""); }, [fetchLedger]);

  const applyFilter = () => {
    if (from && to && from > to) { alert("'From' date 'To' date se pehle hona chahiye!"); return; }
    setAppliedFrom(from); setAppliedTo(to);
    fetchLedger(from, to);
    setFilterOpen(false);
  };

  const clearFilter = () => { setFrom(""); setTo(""); setAppliedFrom(""); setAppliedTo(""); fetchLedger("", ""); };

  const quickDate = (type: "7d" | "30d" | "thisMonth" | "lastMonth") => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    let f = "", t = fmt(today);
    if (type === "7d") { const d = new Date(); d.setDate(d.getDate() - 7); f = fmt(d); }
    if (type === "30d") { const d = new Date(); d.setDate(d.getDate() - 30); f = fmt(d); }
    if (type === "thisMonth") { f = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`; t = fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)); }
    if (type === "lastMonth") { const fm = new Date(today.getFullYear(), today.getMonth() - 1, 1); const lm = new Date(today.getFullYear(), today.getMonth(), 0); f = fmt(fm); t = fmt(lm); }
    setFrom(f); setTo(t);
  };

  const isFiltered = !!(appliedFrom || appliedTo);

  // ── Print popup (clean white statement, no app layout) ──────────────────
  const handlePrint = () => {
    const el = document.getElementById("ledger-statement");
    if (!el) return;
    const cleanName = (data?.client.name || "client").replace(/[^a-zA-Z0-9]/g, "_");
    const win = window.open("", `Statement_${cleanName}`, "width=900,height=700,scrollbars=yes");
    if (!win) { alert("Popup blocked! Browser settings mein popup allow karo."); return; }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Statement_${cleanName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #333; background: #fff; padding: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { padding: 6px 5px; border: 1px solid #ddd; }
    thead tr { background: #001f3f !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tfoot tr { background: #f0f0f0; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr:nth-child(even) { background: #fafafa; }
    @page { margin: 0.8cm; size: A4 portrait; }
    @media print {
      table { page-break-inside: auto; }
      tr    { page-break-inside: avoid; }
      thead tr { background: #001f3f !important; color: #fff !important; }
    }
  </style>
</head>
<body>
${el.innerHTML}
</body>
</html>`);
    win.document.close();
    win.focus();
    win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
    setTimeout(() => { if (win && !win.closed) { win.print(); win.onafterprint = () => win.close(); } }, 800);
  };

  const openingBal = data?.client.opening_balance || 0;
  const due = data?.due ?? 0;
  const finalBalance = data && data.rows.length > 0 ? data.rows[data.rows.length - 1].balance : openingBal;
  const periodDebit = (data?.rows || []).filter(r => !r.isBroughtFwd).reduce((s, r) => s + r.debit, 0);
  const periodCredit = (data?.rows || []).filter(r => !r.isBroughtFwd).reduce((s, r) => s + r.credit, 0);
  const periodDiscount = (data?.rows || []).filter(r => !r.isBroughtFwd).reduce((s, r) => s + r.discount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/my-account" className="p-2 rounded-xl bg-[#111520] border border-[#21293d] text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center flex-shrink-0">
            <BookOpen size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-white leading-tight">Meri Ledger</h1>
            <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5">Mera pura hisaab — repairs, sales, payments aur running balance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterOpen(v => !v)}
            className={`flex-1 sm:flex-none items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all border whitespace-nowrap ${filterOpen || isFiltered ? "bg-blue-600 border-blue-600 text-white" : "bg-[#111520] border-[#21293d] text-slate-400 hover:text-white"}`}
          >
            <Filter size={13} /> Filters {isFiltered && "•"} {filterOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !data}
            className="flex-1 sm:flex-none items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-br from-indigo-500 to-purple-700 text-white disabled:opacity-50 whitespace-nowrap"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-3 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-white color-scheme-dark outline-none focus:border-blue-500/60" />
            </div>
            <span className="text-slate-600 font-bold text-sm pb-2.5">to</span>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} className="w-full px-3 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-white color-scheme-dark outline-none focus:border-blue-500/60" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {([{ label: "7 Days", t: "7d" }, { label: "30 Days", t: "30d" }, { label: "This Month", t: "thisMonth" }, { label: "Last Month", t: "lastMonth" }] as const).map(q => (
              <button key={q.t} onClick={() => quickDate(q.t)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#111520] border border-[#21293d] text-slate-400 hover:text-white transition-colors">{q.label}</button>
            ))}
            <div className="flex-1" />
            <button onClick={clearFilter} className="px-3.5 py-2 rounded-lg text-[11px] font-bold bg-[#21293d] text-slate-300 hover:text-white transition-colors">Clear All</button>
            <button onClick={applyFilter} className="px-5 py-2 rounded-lg text-[11px] font-bold bg-blue-600 text-white">Apply</button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl p-4 border ${due > 0 ? "bg-red-500/10 border-red-500/30" : "bg-[#161b27] border-[#21293d]"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{due > 0 ? "Due Amount" : due < 0 ? "Advance" : "Balance"}</p>
          <p className={`text-2xl font-black mt-1 ${due > 0 ? "text-red-400" : due < 0 ? "text-emerald-400" : "text-white"}`}>{inr(due)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Repairs</p>
          <p className="text-2xl font-black mt-1 text-white">{inr(data?.totals.repairs ?? 0)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sales</p>
          <p className="text-2xl font-black mt-1 text-white">{inr(data?.totals.sales ?? 0)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payments (inc. discount)</p>
          <p className="text-2xl font-black mt-1 text-emerald-400">{inr(data?.totals.payments ?? 0)}</p>
        </div>
      </div>

      {/* Statement */}
      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-600">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : !data ? null : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          <div id="ledger-statement" style={{ padding: 20, fontFamily: "Arial, sans-serif", fontSize: 13, color: "#333" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.2rem", color: "#001f3f", textTransform: "uppercase", letterSpacing: 1 }}>{data.firm.name}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{data.firm.address}</div>
                {data.firm.contact && <div style={{ fontSize: 11, color: "#666" }}>📞 {data.firm.contact}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: "1.5rem", letterSpacing: 2, color: "#555" }}>STATEMENT</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Generated: {fmtDate(new Date().toISOString())}</div>
                {isFiltered && (
                  <div style={{ fontSize: 10, color: "#6c757d", marginTop: 2 }}>
                    Period: {appliedFrom ? fmtDate(appliedFrom + "T00:00") : "All"} — {appliedTo ? fmtDate(appliedTo + "T00:00") : "All"}
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: "2px solid #001f3f", margin: "10px 0" }} />

            {/* Client */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: "#6c757d", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Account Holder</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#001f3f", marginTop: 2 }}>{data.client.name}</div>
                {data.client.contact && <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>{data.client.contact}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#6c757d", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Balance</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: due > 0 ? "#c0392b" : due < 0 ? "#27ae60" : "#333", marginTop: 2 }}>
                  {due > 0 ? `${inr(due)} Due` : due < 0 ? `${inr(due)} Advance` : "₹0.00 Clear"}
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 11, color: "#333" }}>
              <thead>
                <tr style={{ background: "#001f3f", color: "#fff" }}>
                  <th style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "left" }}>Description</th>
                  <th style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "left" }}>Ref / Status</th>
                  <th style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>Debit</th>
                  <th style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>Credit</th>
                  <th style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>Disc.</th>
                  <th style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: "14px 5px", textAlign: "center", color: "#888" }}>Koi entry nahi mili</td></tr>
                ) : data.rows.map((r, i) => (
                  <tr key={i} style={r.isBroughtFwd ? { background: "#eee" } : i % 2 ? { background: "#fafafa" } : undefined}>
                    <td style={{ padding: "6px 5px", border: "1px solid #ddd", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                    <td style={{ padding: "6px 5px", border: "1px solid #ddd" }}>
                      {r.desc}
                      {r.remark && <div style={{ fontSize: 9, color: "#888" }}>{r.remark}</div>}
                    </td>
                    <td style={{ padding: "6px 5px", border: "1px solid #ddd", whiteSpace: "nowrap" }}>
                      {r.ref !== "—" && <span style={{ fontWeight: 700 }}>{r.ref}</span>}
                      {r.status != null && <span style={{ color: "#888" }}> {STATUS_LABEL[r.status] || r.status}</span>}
                    </td>
                    <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>{r.debit ? inr(r.debit) : "—"}</td>
                    <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>{r.credit ? inr(r.credit) : "—"}</td>
                    <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>{r.discount ? inr(r.discount) : "—"}</td>
                    <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right", fontWeight: 700, color: r.balance > 0 ? "#c0392b" : r.balance < 0 ? "#27ae60" : "#333" }}>{inr(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0f0f0", fontWeight: "bold" }}>
                  <td colSpan={3} style={{ padding: "6px 5px", border: "1px solid #ddd" }}>Total ({appliedFrom || appliedTo ? "period" : "all-time"})</td>
                  <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>{inr(periodDebit)}</td>
                  <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>{inr(periodCredit)}</td>
                  <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>{inr(periodDiscount)}</td>
                  <td style={{ padding: "6px 5px", border: "1px solid #ddd", textAlign: "right" }}>{inr(finalBalance)}</td>
                </tr>
              </tfoot>
            </table>
            </div>

            <div style={{ fontSize: 10, color: "#6c757d", marginTop: 10 }}>
              Balance = Opening + Repairs + Direct Sales + Loans − Payments (incl. discount). {data.totals.loans > 0 ? `Loan total: ${inr(data.totals.loans)}. ` : ""}{data.totals.discount > 0 ? `Total discount: ${inr(data.totals.discount)}.` : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
