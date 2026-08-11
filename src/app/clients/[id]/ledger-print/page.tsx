"use client";
import React, { useEffect, useState, use, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Printer, X, Filter, ChevronDown, ChevronUp,
  Calendar,
  AlertTriangle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// IST TIMEZONE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso; }
}

function fmtDateShort(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso; }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const inr = (n: number, abs = true) =>
  "₹" + (abs ? Math.abs(n) : n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG — matching PHP status_arr
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string | number, { label: string; color: string; bg: string }> = {
  0: { label: "Pending",          color: "#f39c12", bg: "#fff8e1" },
  1: { label: "In Progress",      color: "#007bff", bg: "#e3f2fd" },
  2: { label: "Done",             color: "#6f42c1", bg: "#f3e5f5" },
  3: { label: "Paid",             color: "#28a745", bg: "#e8f5e9" },
  4: { label: "Cancelled",        color: "#dc3545", bg: "#ffebee" },
  5: { label: "Delivered",        color: "#19692c", bg: "#e8f5e9" },
  payment:     { label: "Payment",          color: "#fff", bg: "#17a2b8" },
  direct_sale: { label: "Direct Sale",      color: "#fff", bg: "#ff6b6b" },
  loan:        { label: "Loan",             color: "#fff", bg: "#9b59b6" },
  brought_fwd: { label: "Brought Forward",  color: "#fff", bg: "#6c757d" },
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type StatusKey = keyof typeof STATUS_CONFIG;

type LedgerRow = {
  date:          string;
  desc:          string;
  ref:           string;
  statusKey:     StatusKey | null;
  remark:        string;
  debit:         number;
  credit:        number;
  discount:      number;
  effectiveCr:   number;  // credit + discount
  balance:       number;  // running
  deliveredDate?: string;
  isBroughtFwd:  boolean;
};

type FirmInfo  = { name: string; address: string; contact: string; email: string };
type ClientInfo = {
  firstname: string; middlename: string; lastname: string;
  contact: string; address: string; email: string; opening_balance: number;
};
type Totals = {
  repairs: number; sales: number; loans: number;
  payments: number; discount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS FILTER OPTIONS (matching PHP status_arr)
// ─────────────────────────────────────────────────────────────────────────────
const FILTER_OPTIONS: { key: string | number; label: string }[] = [
  { key: 0, label: "Pending" },
  { key: 1, label: "In Progress" },
  { key: 2, label: "Done" },
  { key: 3, label: "Paid" },
  { key: 4, label: "Cancelled" },
  { key: 5, label: "Delivered" },
  { key: "payment",     label: "Payments" },
  { key: "direct_sale", label: "Direct Sale" },
  { key: "loan",        label: "Loan Disbursement" },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LedgerPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const searchParams   = useSearchParams();
  const router         = useRouter();

  const clientId = parseInt(resolvedParams.id);
  const fromDate = searchParams.get("from") || "";
  const toDate   = searchParams.get("to")   || "";
  const rawStatusParam = searchParams.get("status") || "";
  const activeStatuses: (string | number)[] = useMemo(
    () => rawStatusParam
      ? rawStatusParam.split(",").map(s => (isNaN(Number(s)) ? s : Number(s)))
      : [],
    [rawStatusParam]
  );

  // ── STATE ─────────────────────────────────────────────────────────────
  const [client,   setClient]   = useState<ClientInfo | null>(null);
  const [firmInfo, setFirmInfo] = useState<FirmInfo>({ name: "V-Technologies", address: "Jabalpur, MP", contact: "", email: "" });
  const [rows,     setRows]     = useState<LedgerRow[]>([]);
  const [totals,   setTotals]   = useState<Totals>({ repairs: 0, sales: 0, loans: 0, payments: 0, discount: 0 });
  const [loading,  setLoading]  = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  // Local filter state (before applying)
  const [localFrom,   setLocalFrom]   = useState(fromDate);
  const [localTo,     setLocalTo]     = useState(toDate);
  const [localStatus, setLocalStatus] = useState<(string|number)[]>(activeStatuses);

  // ── FETCH ─────────────────────────────────────────────────────────────
  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      // ── Client info ──────────────────────────────────────────────────
      const { data: cd } = await supabase
        .from("client_list")
        .select("firstname, middlename, lastname, contact, address, email, opening_balance")
        .eq("id", clientId).eq("delete_flag", 0).single();
      if (cd) setClient(cd);

      // ── Firm info ─────────────────────────────────────────────────────
      const { data: sys } = await supabase
        .from("system_info").select("meta_field, meta_value")
        .in("meta_field", ["name", "address", "contact", "email"]);
      if (sys) {
        const m: Record<string, string> = {};
        sys.forEach(r => { m[r.meta_field] = r.meta_value; });
        setFirmInfo({
          name: m.name || "V-Technologies", address: m.address || "Jabalpur, MP",
          contact: m.contact || "", email: m.email || "",
        });
      }

      // ── IST date filters ─────────────────────────────────────────────
      const from = fromDate ? `${fromDate}T00:00:00+05:30` : null;
      const to   = toDate   ? `${toDate}T23:59:59+05:30`   : null;

      // Determine what to show (matching PHP logic)
      const repairStatuses: number[] = [];
      let showPayments = activeStatuses.length === 0;
      let showSales    = activeStatuses.length === 0;
      let showLoans    = activeStatuses.length === 0;
      let showAllRepairs = activeStatuses.length === 0;

      if (activeStatuses.length > 0) {
        activeStatuses.forEach(s => {
          if (s === "payment")     showPayments = true;
          else if (s === "direct_sale") showSales = true;
          else if (s === "loan")   showLoans = true;
          else if (typeof s === "number") repairStatuses.push(s);
        });
        if (repairStatuses.length > 0) showAllRepairs = false;
        else if (!showPayments && !showSales && !showLoans) showAllRepairs = false;
      }

      // ── ALL-TIME totals (for current outstanding — never filtered) ───
      const [
        { data: allJobs },
        { data: allSales },
        { data: allLoans },
        { data: allPays },
      ] = await Promise.all([
        supabase.from("transaction_list").select("amount").eq("client_name", String(clientId)),
        supabase.from("direct_sales").select("total_amount").eq("client_id", clientId),
        supabase.from("client_loans").select("total_payable").eq("client_id", clientId),
        supabase.from("client_payments").select("amount, discount").eq("client_id", clientId),
      ]);

      const totalRepairs  = (allJobs  || []).reduce((s, r) => s + (r.amount || 0), 0);
      const totalSales    = (allSales || []).reduce((s, r) => s + (r.total_amount || 0), 0);
      const totalLoans    = (allLoans || []).reduce((s, r) => s + (r.total_payable || 0), 0);
      // CORRECT: settled = cash received + discount given (both clear the balance)
      // e.g. bill=1500, paid=1300, discount=200 → settled=1500 → balance=0
      const totalPaid     = (allPays  || []).reduce((s, p) => s + (p.amount || 0), 0);
      const totalDisc     = (allPays  || []).reduce((s, p) => s + (p.discount || 0), 0);
      const totalSettled  = totalPaid + totalDisc;  // total that clears the balance
      setTotals({ repairs: totalRepairs, sales: totalSales, loans: totalLoans, payments: totalSettled, discount: totalDisc });

      // ── Brought-forward (before date range) ──────────────────────────
      let broughtFwd = (cd?.opening_balance || 0);
      if (from) {
        const [
          { data: preJ }, { data: preS }, { data: preL }, { data: preP }
        ] = await Promise.all([
          supabase.from("transaction_list").select("amount").eq("client_name", String(clientId)).lt("date_created", from),
          supabase.from("direct_sales").select("total_amount").eq("client_id", clientId).lt("date_created", from),
          supabase.from("client_loans").select("total_payable").eq("client_id", clientId).lt("loan_date", from),
          supabase.from("client_payments").select("amount, discount").eq("client_id", clientId).lt("payment_date", from),
        ]);
        const preRepairs = (preJ || []).reduce((s, r) => s + (r.amount || 0), 0);
        const preSales   = (preS || []).reduce((s, r) => s + (r.total_amount || 0), 0);
        const preLoans   = (preL || []).reduce((s, r) => s + (r.total_payable || 0), 0);
        const prePay     = (preP || []).reduce((s, p) => s + (p.amount || 0) + (p.discount || 0), 0);
        broughtFwd = (cd?.opening_balance || 0) + preRepairs + preSales + preLoans - prePay;
      }

      // ── Filtered data ─────────────────────────────────────────────────
      const ledger: LedgerRow[] = [];

      // Brought forward row
      if (from) {
        ledger.push({
          date: fromDate, desc: "Balance Brought Forward", ref: "—",
          statusKey: "brought_fwd", remark: "Previous balance",
          debit: broughtFwd > 0 ? broughtFwd : 0,
          credit: broughtFwd < 0 ? Math.abs(broughtFwd) : 0,
          discount: 0, effectiveCr: broughtFwd < 0 ? Math.abs(broughtFwd) : 0,
          balance: 0, isBroughtFwd: true,
        });
      }

      // Repair jobs
      if (showAllRepairs || repairStatuses.length > 0) {
        let q = supabase
          .from("transaction_list")
          .select("id, job_id, item, amount, status, remark, date_created, date_completed")
          .eq("client_name", String(clientId));
        if (!showAllRepairs && repairStatuses.length > 0) q = q.in("status", repairStatuses);
        if (from) q = q.gte("date_created", from);
        if (to)   q = q.lte("date_created", to);
        const { data: jobs } = await q;
        (jobs || []).forEach(j => ledger.push({
          date: j.date_created, desc: `Job: ${j.item || "—"}`,
          ref: j.job_id || `JOB-${j.id}`, statusKey: j.status,
          remark: j.remark || "", debit: j.amount || 0,
          credit: 0, discount: 0, effectiveCr: 0, balance: 0,
          deliveredDate: j.status === 5 ? j.date_completed : undefined,
          isBroughtFwd: false,
        }));
      }

      // Direct sales
      if (showSales) {
        let q = supabase.from("direct_sales")
          .select("id, sale_code, total_amount, remarks, date_created")
          .eq("client_id", clientId);
        if (from) q = q.gte("date_created", from);
        if (to)   q = q.lte("date_created", to);
        const { data: sales } = await q;
        (sales || []).forEach(s => ledger.push({
          date: s.date_created, desc: "Direct Sale", ref: s.sale_code,
          statusKey: "direct_sale", remark: s.remarks || "",
          debit: s.total_amount || 0, credit: 0, discount: 0, effectiveCr: 0,
          balance: 0, isBroughtFwd: false,
        }));
      }

      // Loans
      if (showLoans) {
        let q = supabase.from("client_loans")
          .select("id, total_payable, remarks, loan_date")
          .eq("client_id", clientId);
        if (from) q = q.gte("loan_date", from);
        if (to)   q = q.lte("loan_date", to);
        const { data: loans } = await q;
        (loans || []).forEach(l => ledger.push({
          date: l.loan_date, desc: "Loan Disbursement",
          ref: `LN-${String(l.id).padStart(5, "0")}`, statusKey: "loan",
          remark: l.remarks || "", debit: l.total_payable || 0,
          credit: 0, discount: 0, effectiveCr: 0, balance: 0, isBroughtFwd: false,
        }));
      }

      // Payments
      if (showPayments) {
        let q = supabase.from("client_payments")
          .select("id, amount, discount, net_amount, payment_date, payment_mode, bill_no, remarks")
          .eq("client_id", clientId).is("loan_id", null);
        if (from) q = q.gte("payment_date", from);
        if (to)   q = q.lte("payment_date", to);
        const { data: pays } = await q;
        (pays || []).forEach(p => {
          const disc  = p.discount  || 0;
          const amt   = p.amount    || 0;
          // CORRECT: effectiveCr = cash paid + discount given
          // DB net_amount = amount - discount — DO NOT use it (wrong formula)
          // e.g. paid=1300, discount=200 → effectiveCr=1500 → clears bill of 1500
          const effCr = amt + disc;
          ledger.push({
            date: p.payment_date, desc: "Payment Received",
            ref: p.bill_no ? `BILL-${p.bill_no}` : `PAY-${p.id}`,
            statusKey: "payment", remark: p.remarks || p.payment_mode || "",
            debit: 0, credit: amt, discount: disc, effectiveCr: effCr,
            balance: 0, isBroughtFwd: false,
          });
        });
      }

      // Sort by date
      ledger.sort((a, b) => {
        if (a.isBroughtFwd) return -1;
        if (b.isBroughtFwd) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      // Running balance
      let running = from ? broughtFwd : (cd?.opening_balance || 0);
      ledger.forEach(r => {
        if (!r.isBroughtFwd) {
          running += r.debit - r.effectiveCr;
          r.balance = running;
        } else {
          r.balance = broughtFwd;
        }
      });

      setRows(ledger);
    } catch (err) {
      console.error("ledger fetch:", err instanceof Error ? err.message : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }, [clientId, fromDate, toDate, activeStatuses]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  // Auto-print removed — only manual Print button triggers print
  // (auto-print + button = double print bug)

  // ── Apply filter ───────────────────────────────────────────────────────
  const applyFilter = () => {
    if (localFrom && localTo && localFrom > localTo) {
      alert("'From' date, 'To' date se pehle hona chahiye!");
      return;
    }
    const statusStr = localStatus.join(",");
    const parts: string[] = [`id=${resolvedParams.id}`];
    if (localFrom) parts.push(`from=${localFrom}`);
    if (localTo)   parts.push(`to=${localTo}`);
    if (statusStr) parts.push(`status=${statusStr}`);
    router.push(`/clients/${resolvedParams.id}/ledger-print?${parts.join("&")}`);
    setFilterOpen(false);
  };

  const clearFilter = () => {
    setLocalFrom(""); setLocalTo(""); setLocalStatus([]);
    router.push(`/clients/${resolvedParams.id}/ledger-print`);
    setFilterOpen(false);
  };

  const quickDate = (type: "7d" | "30d" | "thisMonth" | "lastMonth") => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    let f = "", t = fmt(today);
    if (type === "7d")  { const d = new Date(); d.setDate(d.getDate()-7); f = fmt(d); }
    if (type === "30d") { const d = new Date(); d.setDate(d.getDate()-30); f = fmt(d); }
    if (type === "thisMonth") { f = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`; t = fmt(new Date(today.getFullYear(), today.getMonth()+1, 0)); }
    if (type === "lastMonth") {
      const fm = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const lm = new Date(today.getFullYear(), today.getMonth(), 0);
      f = fmt(fm); t = fmt(lm);
    }
    setLocalFrom(f); setLocalTo(t);
  };

  const toggleStatus = (k: string | number) => {
    setLocalStatus(prev =>
      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    );
  };

  // ── COMPUTED ──────────────────────────────────────────────────────────
  const clientName = client
    ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
    : `Client #${clientId}`;

  const openingBal  = client?.opening_balance || 0;
  // totals.payments = totalSettled = SUM(cash + discount) — correct
  const currentOutstanding = openingBal + totals.repairs + totals.sales + totals.loans - totals.payments;

  const balanceType =
    currentOutstanding > 0.005 ? "debit"
    : currentOutstanding < -0.005 ? "credit"
    : "zero";

  const finalBalance = rows.length > 0
    ? rows[rows.length - 1].balance
    : openingBal;

  const periodDebit    = rows.filter(r => !r.isBroughtFwd).reduce((s, r) => s + r.debit, 0);
  const periodCredit   = rows.filter(r => !r.isBroughtFwd).reduce((s, r) => s + r.credit, 0);
  const periodDiscount = rows.filter(r => !r.isBroughtFwd).reduce((s, r) => s + r.discount, 0);

  const isFiltered = !!(fromDate || toDate || activeStatuses.length > 0);

  // ── PRINT HANDLER ─────────────────────────────────────────────────────
  // Opens a clean popup window with ONLY the ledger content — no Next.js layout
  // interference, no double-page, no blank page issues.
  const handlePrint = () => {
    const el = document.getElementById("ledger-statement");
    if (!el) return;

    const cleanName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
    const win = window.open("", `Statement_${cleanName}`,
      "width=900,height=700,scrollbars=yes"
    );
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
    // Wait for content to render before printing
    win.onload = () => {
      win.print();
      win.onafterprint = () => win.close();
    };
    // Fallback if onload already fired
    setTimeout(() => {
      if (win && !win.closed) {
        win.print();
        win.onafterprint = () => win.close();
      }
    }, 800);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Arial,sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:"3px solid #001f3f", borderTop:"3px solid transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
        <p style={{ color:"#666", fontSize:13 }}>Loading ledger…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="ledger-outer-wrap" style={{ background:"#f4f6f9", minHeight:"100vh", fontFamily:"Arial,sans-serif", fontSize:13, color:"#333" }}>

      {/* ── FILTER PANEL (screen only) ────────────────────────────────── */}
      <div className="no-print" style={{ background:"#fff", borderBottom:"1px solid #ddd", padding:"12px 20px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            {/* Left: Title + back */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button
                onClick={() => router.push(`/clients/${resolvedParams.id}/view`)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:"#f0f0f0", border:"1px solid #ccc", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600 }}
              >
                <X size={14} /> Close
              </button>
              <span style={{ fontWeight:700, fontSize:15 }}>Client Ledger</span>
            </div>

            {/* Right: Filter toggle + Print */}
            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={() => setFilterOpen(v => !v)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", background: isFiltered ? "#001f3f" : "#f0f0f0", color: isFiltered ? "#fff" : "#333", border:"1px solid #ccc", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600 }}
              >
                <Filter size={13} />
                Filters {isFiltered && "(On)"}
                {filterOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
              </button>
              <button
                onClick={handlePrint}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 18px", background:"linear-gradient(135deg,#667eea,#764ba2)", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(102,126,234,0.4)" }}
              >
                <Printer size={14} /> Print Statement
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {filterOpen && (
            <div style={{ marginTop:12, padding:16, background:"#f8f9fa", border:"1px solid #dee2e6", borderRadius:8 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {/* Date range */}
                <div>
                  <div style={{ fontWeight:700, fontSize:12, marginBottom:8, color:"#495057" }}>
                    <Calendar size={13} style={{ verticalAlign:"middle", marginRight:4 }}/>
                    Date Range
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <input type="date" value={localFrom} onChange={e => setLocalFrom(e.target.value)}
                      style={{ flex:1, padding:"6px 10px", border:"1px solid #ccc", borderRadius:6, fontSize:12, colorScheme:"light" }} />
                    <span style={{ color:"#6c757d", fontWeight:700 }}>to</span>
                    <input type="date" value={localTo} onChange={e => setLocalTo(e.target.value)}
                      min={localFrom}
                      style={{ flex:1, padding:"6px 10px", border:"1px solid #ccc", borderRadius:6, fontSize:12, colorScheme:"light" }} />
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {([
                      { label:"7 Days", t:"7d" }, { label:"30 Days", t:"30d" },
                      { label:"This Month", t:"thisMonth" }, { label:"Last Month", t:"lastMonth" },
                    ] as const).map(q => (
                      <button key={q.t} onClick={() => quickDate(q.t)}
                        style={{ padding:"3px 8px", fontSize:11, background:"#fff", border:"1px solid #007bff", color:"#007bff", borderRadius:4, cursor:"pointer" }}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status filter */}
                <div>
                  <div style={{ fontWeight:700, fontSize:12, marginBottom:8, color:"#495057" }}>
                    Filter by Status / Type
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {FILTER_OPTIONS.map(opt => {
                      const cfg = STATUS_CONFIG[opt.key];
                      const active = localStatus.includes(opt.key);
                      return (
                        <button key={String(opt.key)} onClick={() => toggleStatus(opt.key)}
                          style={{
                            padding:"3px 10px", fontSize:11, borderRadius:4, cursor:"pointer",
                            fontWeight: active ? 700 : 400,
                            border: `1px solid ${cfg?.bg || "#ccc"}`,
                            background: active ? (cfg?.bg || "#eee") : "#fff",
                            color: active
                              ? (["payment","direct_sale","loan","brought_fwd"].includes(String(opt.key)) ? "#fff" : "#333")
                              : "#555",
                          }}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {localStatus.length > 0 && (
                    <p style={{ fontSize:10, color:"#6c757d", marginTop:6 }}>
                      Leave empty to show all types
                    </p>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display:"flex", gap:8, marginTop:12, justifyContent:"flex-end" }}>
                <button onClick={clearFilter}
                  style={{ padding:"7px 16px", background:"#6c757d", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                  Clear All
                </button>
                <button onClick={applyFilter}
                  style={{ padding:"7px 20px", background:"#001f3f", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 }}>
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── STATEMENT CONTAINER ───────────────────────────────────────── */}
      <div id="ledger-statement" style={{ maxWidth:1100, margin:"16px auto", background:"#fff", padding:20, borderRadius:6, boxShadow:"0 0 20px rgba(0,0,0,0.1)", border:"1px solid #ddd" }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontWeight:900, fontSize:"1.2rem", color:"#001f3f", textTransform:"uppercase", letterSpacing:1 }}>
              {firmInfo.name}
            </div>
            <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{firmInfo.address}</div>
            {firmInfo.contact && <div style={{ fontSize:11, color:"#666" }}>📞 {firmInfo.contact}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontWeight:900, fontSize:"1.5rem", letterSpacing:2, color:"#555" }}>STATEMENT</div>
            <div style={{ fontSize:11, color:"#666", marginTop:2 }}>
              Generated: {fmtDate(new Date().toISOString())}
            </div>
            {isFiltered && (
              <div style={{ fontSize:10, color:"#6c757d", marginTop:2 }}>
                Period: {fromDate ? fmtDateShort(fromDate+"T00:00") : "All"} — {toDate ? fmtDateShort(toDate+"T00:00") : "All"}
                {activeStatuses.length > 0 && (
                  <><br />Status: {activeStatuses.map(s => STATUS_CONFIG[s]?.label || s).join(", ")}</>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop:"2px solid #001f3f", margin:"10px 0" }} />

        {/* ── CLIENT + BALANCE ─────────────────────────────────────────── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:10, color:"#6c757d", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Account Holder</div>
            <div style={{ fontWeight:900, fontSize:"1.1rem", marginTop:2 }}>{clientName}</div>
            {client?.contact && <div style={{ fontSize:11, color:"#555", marginTop:2 }}>📞 {client.contact}</div>}
            {client?.address && <div style={{ fontSize:11, color:"#555", marginTop:1 }}>📍 {client.address}</div>}
          </div>

          {/* Balance box */}
          <div style={{
            padding:"12px 18px", borderRadius:8, minWidth:200, textAlign:"right",
            background: balanceType === "debit" ? "linear-gradient(135deg,#ffebee,#ffcdd2)"
              : balanceType === "credit" ? "linear-gradient(135deg,#e8f5e9,#c8e6c9)"
              : "linear-gradient(135deg,#f5f5f5,#e0e0e0)",
            border: balanceType === "debit" ? "1px solid #ffcdd2"
              : balanceType === "credit" ? "1px solid #c8e6c9"
              : "1px solid #e0e0e0",
          }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#555" }}>
              {balanceType === "debit" ? "AMOUNT RECEIVABLE FROM CLIENT"
               : balanceType === "credit" ? "AMOUNT PAYABLE TO CLIENT"
               : "FULLY SETTLED"}
            </div>
            <div style={{ fontSize:"1.6rem", fontWeight:900, marginTop:4,
              color: balanceType === "debit" ? "#c62828" : balanceType === "credit" ? "#2e7d32" : "#616161" }}>
              {inr(Math.abs(currentOutstanding))}
            </div>
            <div style={{ fontSize:9, color:"#777", marginTop:2 }}>
              {balanceType === "debit" ? "Debit balance — amount to receive"
               : balanceType === "credit" ? "Credit balance — amount to pay"
               : "Account fully settled ✓"}
            </div>
          </div>
        </div>

        {/* ── PERIOD SUMMARY (when filtered) ───────────────────────────── */}
        {isFiltered && (
          <div style={{ background:"#f0f4f8", border:"1px solid #d0dce8", borderRadius:6, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:11, color:"#001f3f", marginBottom:6 }}>
              📅 Display Period Summary
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {[
                { label: "Brought Forward", val: rows.find(r=>r.isBroughtFwd)?.balance ?? 0, color:"#555" },
                { label: "Period Debits",   val: periodDebit,   color:"#c62828" },
                { label: "Period Credits",  val: periodCredit,  color:"#2e7d32" },
                { label: "Period Discount", val: periodDiscount, color:"#0277bd" },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize:9, color:"#6c757d", fontWeight:600 }}>{item.label}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:item.color }}>{inr(item.val)}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:8, fontSize:10, color:"#e67e22", fontStyle:"italic" }}>
              ⚠ Display filter applied. Current outstanding (top right) calculated from ALL transactions.
            </div>
          </div>
        )}

        {/* ── OVERALL SUMMARY ───────────────────────────────────────────── */}
        <div style={{ background:"#f8f9fa", border:"1px solid #dee2e6", borderRadius:6, padding:"10px 14px", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:11, color:"#001f3f", marginBottom:6 }}>
            📊 Overall Account Summary (All Time)
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {[
              { label:"Opening Balance", val: openingBal },
              { label:"Total Repairs",   val: totals.repairs },
              { label:"Total Direct Sales", val: totals.sales },
              { label:"Total Loans",     val: totals.loans },
              { label:"Total Payments",  val: totals.payments + totals.discount },
              { label:"Total Discount Given",  val: totals.discount },
            ].map(item => (
              <div key={item.label} style={{ fontSize:10 }}>
                <span style={{ color:"#6c757d" }}>{item.label}:</span>{" "}
                <strong>{inr(item.val)}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* ── LEDGER TABLE ─────────────────────────────────────────────── */}
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, border:"1px solid #444" }}>
            <thead>
              <tr style={{ background:"#001f3f", color:"#fff" }}>
                {["#","Date","Description","Ref ID","Status","Remark","Debit (Dr)","Credit (Cr)","Balance"].map((h,i) => (
                  <th key={h} style={{
                    padding:"8px 6px", fontSize:10, fontWeight:700, textTransform:"uppercase",
                    textAlign: i >= 6 ? "right" : i === 0 ? "center" : "left",
                    border:"1px solid #444", letterSpacing:0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding:24, textAlign:"center", color:"#999", background:"#fafafa" }}>
                    <AlertTriangle size={20} style={{ verticalAlign:"middle", marginRight:8, color:"#f39c12" }} />
                    No records found with current filters
                  </td>
                </tr>
              ) : rows.map((r, i) => {
                const cfg = r.statusKey !== null ? STATUS_CONFIG[r.statusKey] : null;
                const isPaymentType = r.statusKey === "payment" || r.statusKey === "brought_fwd";
                const rowBg = r.isBroughtFwd ? "#f0f4ff"
                  : r.debit > 0 ? "#fff9f9"
                  : r.effectiveCr > 0 ? "#f9fff9"
                  : "#fff";
                const balColor = r.balance > 0.005 ? "#c62828" : r.balance < -0.005 ? "#2e7d32" : "#616161";

                return (
                  <tr key={i} style={{ background:rowBg, borderBottom:"1px solid #e0e0e0" }}>
                    <td style={{ padding:"6px 5px", textAlign:"center", color:"#999", border:"1px solid #ddd" }}>
                      {r.isBroughtFwd ? "—" : i}
                    </td>
                    <td style={{ padding:"6px 5px", whiteSpace:"nowrap", border:"1px solid #ddd", fontSize:11 }}>
                      {fmtDateShort(r.date)}
                    </td>
                    <td style={{ padding:"6px 5px", fontWeight:600, border:"1px solid #ddd" }}>
                      {r.desc}
                    </td>
                    <td style={{ padding:"6px 5px", textAlign:"center", fontFamily:"monospace", fontSize:10, border:"1px solid #ddd" }}>
                      {r.ref}
                    </td>
                    <td style={{ padding:"6px 5px", textAlign:"center", border:"1px solid #ddd" }}>
                      {cfg ? (
                        <span style={{
                          display:"inline-block", padding:"2px 7px", borderRadius:3,
                          fontSize:9, fontWeight:700, textTransform:"uppercase",
                          minWidth:65, textAlign:"center", lineHeight:1.3,
                          background: isPaymentType ? cfg.bg : cfg.bg,
                          color: isPaymentType ? cfg.color : (cfg.color === "#fff" ? "#fff" : "#333"),
                          border:`1px solid ${isPaymentType ? cfg.bg : "transparent"}`,
                        }}>
                          {cfg.label}
                        </span>
                      ) : "—"}
                      {r.deliveredDate && (
                        <div style={{ fontSize:8, color:"#28a745", fontWeight:600, marginTop:2 }}>
                          ✓ {fmtDateShort(r.deliveredDate)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding:"6px 5px", color:"#6c757d", fontStyle:"italic", border:"1px solid #ddd", maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                      title={r.remark}>
                      {r.remark ? (r.remark.length > 18 ? r.remark.slice(0,18)+"…" : r.remark) : "—"}
                    </td>
                    <td style={{ padding:"6px 5px", textAlign:"right", color: r.debit>0 ? "#c62828" : "#bbb", fontWeight: r.debit>0 ? 700 : 400, border:"1px solid #ddd" }}>
                      {r.debit > 0 ? inr(r.debit) : "—"}
                    </td>
                    <td style={{ padding:"6px 5px", textAlign:"right", border:"1px solid #ddd" }}>
                      {r.effectiveCr > 0 || r.discount > 0 ? (
                        <div>
                          <div style={{ color:"#2e7d32", fontWeight:700 }}>{inr(r.effectiveCr)}</div>
                          {r.discount > 0 && (
                            <div style={{ fontSize:9, color:"#0277bd", fontStyle:"italic" }}>
                              ({inr(r.credit)} + {inr(r.discount)} disc)
                            </div>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td style={{ padding:"6px 5px", textAlign:"right", fontWeight:700, fontSize:11, color:balColor, border:"1px solid #ddd" }}>
                      {inr(Math.abs(r.balance))}
                      <span style={{ fontSize:9, marginLeft:2 }}>{r.balance > 0.005 ? "Dr" : r.balance < -0.005 ? "Cr" : ""}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:"#f0f0f0", fontWeight:700 }}>
                <th colSpan={6} style={{ padding:"8px 10px", textAlign:"right", fontSize:11 }}>Period Totals:</th>
                <th style={{ padding:"8px 6px", textAlign:"right", color:"#c62828", fontSize:11, border:"1px solid #ccc" }}>{inr(periodDebit)}</th>
                <th style={{ padding:"8px 6px", textAlign:"right", color:"#2e7d32", fontSize:11, border:"1px solid #ccc" }}>
                  {/* Show total settled = cash + discount */}
                  <div>{inr(periodCredit + periodDiscount)}</div>
                  {periodDiscount > 0 && (
                    <div style={{ fontSize:9, color:"#0277bd", fontStyle:"italic" }}>
                      Cash: {inr(periodCredit)} + Disc: {inr(periodDiscount)}
                    </div>
                  )}
                </th>
                <th style={{ padding:"8px 6px", textAlign:"right", border:"1px solid #ccc" }}>—</th>
              </tr>
              <tr style={{ background:"#001f3f", color:"#fff", fontWeight:700 }}>
                <th colSpan={8} style={{ padding:"10px", textAlign:"right", fontSize:12 }}>
                  CLOSING BALANCE:
                </th>
                <th style={{ padding:"10px 8px", textAlign:"right", fontSize:"1.1rem",
                  color: finalBalance > 0.005 ? "#ffcdd2" : finalBalance < -0.005 ? "#c8e6c9" : "#e0e0e0" }}>
                  {inr(Math.abs(finalBalance))}
                  <span style={{ fontSize:10, marginLeft:4 }}>
                    {finalBalance > 0.005 ? "Dr" : finalBalance < -0.005 ? "Cr" : "Settled"}
                  </span>
                </th>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── SIGNATURES ───────────────────────────────────────────────── */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:36, paddingTop:12 }}>
          <div style={{ width:200, textAlign:"center" }}>
            <div style={{ borderTop:"1.5px solid #333", paddingTop:6, fontSize:11, color:"#555", fontWeight:600 }}>
              Customer Signature
            </div>
          </div>
          <div style={{ width:200, textAlign:"center" }}>
            <div style={{ borderTop:"1.5px solid #333", paddingTop:6, fontSize:11, color:"#555", fontWeight:600 }}>
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <div style={{ marginTop:20, borderTop:"1px solid #eee", paddingTop:10, display:"flex", justifyContent:"space-between", fontSize:10, color:"#aaa" }}>
          <span>Generated: {fmtDate(new Date().toISOString())} — {firmInfo.name}</span>
          <span>{fromDate && toDate ? `${fmtDateShort(fromDate+"T00:00")} – ${fmtDateShort(toDate+"T00:00")}` : "All Time"}</span>
        </div>
      </div>

      {/* ── PRINT STYLES — fallback for Ctrl+P (button uses popup window) ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #ledger-statement {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
          }
          table { page-break-inside: auto; }
          tr    { page-break-inside: avoid; }
          thead tr, tfoot tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0.8cm; size: A4 portrait; }
        }
      `}</style>
    </div>
  );
}