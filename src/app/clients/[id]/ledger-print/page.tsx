"use client";
import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function toISTDateStr(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

const inr = (n: number) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type LedgerRow = {
  date:    string;  // ISO
  ref:     string;
  type:    "Job" | "Sale" | "Payment";
  debit:   number;  // billed  (client owes)
  credit:  number;  // payment (client paid)
  balance: number;  // running
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// BUG FIX: params is Promise<> in Next.js 15 — must use `use(params)` to unwrap
// ─────────────────────────────────────────────────────────────────────────────
export default function LedgerPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const searchParams   = useSearchParams();

  const clientId = parseInt(resolvedParams.id);
  const fromDate = searchParams.get("from");   // "YYYY-MM-DD"
  const toDate   = searchParams.get("to");     // "YYYY-MM-DD"

  const [client,  setClient]  = useState<any>(null);
  const [rows,    setRows]    = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [firmInfo, setFirmInfo] = useState({ name: "V-Technologies", address: "Jabalpur, MP" });

  // ── FETCH ALL LEDGER DATA ──────────────────────────────────────────────
  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      try {
        // BUG FIX: table = client_list (not "clients")
        const { data: cd } = await supabase
          .from("client_list")
          .select("firstname, middlename, lastname, contact, address, opening_balance")
          .eq("id", clientId)
          .eq("delete_flag", 0)
          .single();
        setClient(cd);

        // Firm info
        const { data: sysRows } = await supabase
          .from("system_info")
          .select("meta_field, meta_value")
          .in("meta_field", ["name", "address"]);
        if (sysRows) {
          const map: Record<string, string> = {};
          sysRows.forEach(r => { map[r.meta_field] = r.meta_value; });
          setFirmInfo({ name: map.name || "V-Technologies", address: map.address || "Jabalpur, MP" });
        }

        // BUG FIX IST timezone: use +05:30 offsets for Supabase timestamp range filters
        const from = fromDate ? `${fromDate}T00:00:00+05:30` : null;
        const to   = toDate   ? `${toDate}T23:59:59+05:30`   : null;

        // ── 1. Repair jobs ─────────────────────────────────────────────
        let jobQuery = supabase
          .from("transaction_list")
          .select("id, code, item, amount, status, date_created, date_completed")
          .eq("client_name", String(clientId))
          .in("status", [2, 3, 5]);    // Repaired, Paid, Delivered
        if (from) jobQuery = jobQuery.gte("date_created", from);
        if (to)   jobQuery = jobQuery.lte("date_created", to);
        const { data: jobs } = await jobQuery;

        // ── 2. Direct sales ────────────────────────────────────────────
        let saleQuery = supabase
          .from("direct_sales")
          .select("id, sale_code, total_amount, date_created")
          .eq("client_id", clientId);
        if (from) saleQuery = saleQuery.gte("date_created", from);
        if (to)   saleQuery = saleQuery.lte("date_created", to);
        const { data: sales } = await saleQuery;

        // ── 3. Payments ────────────────────────────────────────────────
        let payQuery = supabase
          .from("client_payments")
          .select("id, amount, discount, net_amount, payment_date, payment_mode, bill_no, remarks")
          .eq("client_id", clientId)
          .is("loan_id", null);
        if (from) payQuery = payQuery.gte("payment_date", from);
        if (to)   payQuery = payQuery.lte("payment_date", to);
        const { data: payments } = await payQuery;

        // ── BUILD LEDGER ROWS ──────────────────────────────────────────
        const allRows: LedgerRow[] = [];

        (jobs || []).forEach(j => allRows.push({
          date:    j.date_created,
          ref:     j.code || `JOB-${j.id}`,
          type:    "Job",
          debit:   j.amount || 0,
          credit:  0,
          balance: 0,
        }));

        (sales || []).forEach(s => allRows.push({
          date:    s.date_created,
          ref:     s.sale_code,
          type:    "Sale",
          debit:   s.total_amount || 0,
          credit:  0,
          balance: 0,
        }));

        (payments || []).forEach(p => allRows.push({
          date:    p.payment_date,
          ref:     p.bill_no || `PAY-${p.id}`,
          type:    "Payment",
          debit:   0,
          // net_amount is GENERATED in DB (amount - discount); use it if available
          credit:  p.net_amount ?? (p.amount - (p.discount || 0)),
          balance: 0,
        }));

        // Sort by date ascending
        allRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Running balance (opening_balance + debits - credits)
        let running = (cd?.opening_balance || 0);
        allRows.forEach(r => {
          running += r.debit - r.credit;
          r.balance = running;
        });

        setRows(allRows);
      } catch (err: any) {
        console.error("ledger fetch:", err?.message ?? JSON.stringify(err));
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, [clientId, fromDate, toDate]);

  // BUG FIX: auto-print ONLY after data is loaded (was printing immediately on mount)
  useEffect(() => {
    if (!loading && client) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, client]);

  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p>Loading ledger…</p>
    </div>
  );

  const clientName = client
    ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
    : `Client #${clientId}`;

  const finalBalance = rows.length > 0
    ? rows[rows.length - 1].balance
    : (client?.opening_balance || 0);

  return (
    <div style={{ padding: "24px", maxWidth: "860px", margin: "0 auto", fontFamily: "Arial, sans-serif", fontSize: "13px", color: "#111" }}>

      {/* Print button — hidden in print */}
      <div style={{ marginBottom: "16px", textAlign: "right" }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 20px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
        >
          Print
        </button>
      </div>

      {/* Firm + Client Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "2px solid #111", paddingBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: "900", textTransform: "uppercase" }}>{firmInfo.name}</div>
          <div style={{ fontSize: "11px", color: "#555" }}>{firmInfo.address}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "16px", fontWeight: "800" }}>Client Ledger</div>
          <div style={{ fontSize: "11px", color: "#555" }}>
            {fromDate && toDate
              ? `${fmtDate(fromDate + "T00:00:00")} – ${fmtDate(toDate + "T00:00:00")}`
              : "All Time"}
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div style={{ marginBottom: "14px", padding: "10px 14px", background: "#f5f5f5", borderRadius: "6px" }}>
        <strong>{clientName}</strong>
        {client?.contact && <span style={{ marginLeft: "16px", color: "#555" }}>📞 {client.contact}</span>}
        {client?.address && <span style={{ marginLeft: "16px", color: "#555" }}>{client.address}</span>}
        <div style={{ marginTop: "4px", fontSize: "11px", color: "#777" }}>
          Opening Balance: <strong>{inr(client?.opening_balance || 0)}</strong>
        </div>
      </div>

      {/* Ledger Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ background: "#111", color: "#fff" }}>
            {["Date", "Ref #", "Type", "Debit (Billed)", "Credit (Paid)", "Balance"].map(h => (
              <th key={h} style={{ padding: "8px 10px", textAlign: h.includes("Debit") || h.includes("Credit") || h.includes("Balance") ? "right" : "left", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#999" }}>
                Is period mein koi transactions nahi mili
              </td>
            </tr>
          ) : rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <td style={{ padding: "7px 10px" }}>{fmtDate(r.date)}</td>
              <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "11px" }}>{r.ref}</td>
              <td style={{ padding: "7px 10px" }}>
                <span style={{
                  padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold",
                  background: r.type === "Payment" ? "#d1fae5" : r.type === "Job" ? "#dbeafe" : "#f3e8ff",
                  color:      r.type === "Payment" ? "#065f46" : r.type === "Job" ? "#1e40af" : "#6b21a8",
                }}>
                  {r.type}
                </span>
              </td>
              <td style={{ padding: "7px 10px", textAlign: "right", color: r.debit  > 0 ? "#dc2626" : "#999" }}>
                {r.debit  > 0 ? inr(r.debit)  : "—"}
              </td>
              <td style={{ padding: "7px 10px", textAlign: "right", color: r.credit > 0 ? "#059669" : "#999" }}>
                {r.credit > 0 ? inr(r.credit) : "—"}
              </td>
              <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: "bold", color: r.balance > 0 ? "#dc2626" : "#059669" }}>
                {inr(Math.abs(r.balance))} {r.balance > 0 ? "Dr" : "Cr"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#111", color: "#fff", fontWeight: "bold" }}>
            <td colSpan={3} style={{ padding: "10px 10px", fontSize: "12px" }}>Closing Balance</td>
            <td style={{ padding: "10px 10px", textAlign: "right" }}>
              {inr(rows.reduce((s, r) => s + r.debit, 0))}
            </td>
            <td style={{ padding: "10px 10px", textAlign: "right" }}>
              {inr(rows.reduce((s, r) => s + r.credit, 0))}
            </td>
            <td style={{ padding: "10px 10px", textAlign: "right", fontSize: "14px" }}>
              {inr(Math.abs(finalBalance))} {finalBalance > 0 ? "Dr" : "Cr"}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{ marginTop: "24px", borderTop: "1px solid #ddd", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#999" }}>
        <span>Generated: {fmtDate(new Date().toISOString())}</span>
        <span>{firmInfo.name}</span>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>
    </div>
  );
}