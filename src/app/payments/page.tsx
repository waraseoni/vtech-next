"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Receipt,
  Trash2,
  Plus,
  Printer,
  X,
  IndianRupee,
} from "lucide-react";

type Client = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string | null;
  address: string | null;
};

type PaymentRow = {
  id: number;
  client_id: number;
  payment_date: string;
  amount: number;
  discount: number | null;
  payment_mode: string;
  remarks: string | null;
};

const card = "bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden";
const input =
  "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]";
const label = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";
const btn =
  "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]";
const btnNavy = `${btn} bg-blue-600 hover:bg-blue-500 text-white`;
const btnGhost = `${btn} bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 border border-[#21293d]`;
const btnDanger = `${btn} bg-red-600 hover:bg-red-500 text-white`;

function clientName(c?: Client | null) {
  if (!c) return "—";
  return [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
}
function money(n: number) {
  return `Rs.${Number(n || 0).toFixed(2)}`;
}
function padPy(id: number) {
  return `PY-${String(id).padStart(4, "0")}`;
}

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [filterClientId, setFilterClientId] = useState<"all" | string>("all");

  // Aggregates for due calc (PHP parity)
  const [repairRows, setRepairRows] = useState<Array<{ client_name: string | null; amount: number | null }>>([]);
  const [saleRows, setSaleRows] = useState<Array<{ client_id: number | null; total_amount: number | null }>>([]);
  const [settledRows, setSettledRows] = useState<Array<{ client_id: number; amount: number; discount: number | null }>>([]);

  // Receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<PaymentRow | null>(null);
  const [receiptClient, setReceiptClient] = useState<Client | null>(null);

  // New payment modal
  const [newOpen, setNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClientId, setNewClientId] = useState<string>("");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newAmount, setNewAmount] = useState<string>("");
  const [newDiscount, setNewDiscount] = useState<string>("0");
  const [newMode, setNewMode] = useState<string>("Cash");
  const [newRemarks, setNewRemarks] = useState<string>("");

  const clientById = useMemo(() => {
    const m = new Map<number, Client>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const billedRepairByClient = useMemo(() => {
    // PHP: status=5 only
    const m = new Map<number, number>();
    for (const r of repairRows) {
      const cid = Number(r.client_name);
      if (!cid || Number.isNaN(cid)) continue;
      m.set(cid, (m.get(cid) || 0) + Number(r.amount || 0));
    }
    return m;
  }, [repairRows]);

  const billedSalesByClient = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of saleRows) {
      const cid = Number(r.client_id);
      if (!cid || Number.isNaN(cid)) continue;
      m.set(cid, (m.get(cid) || 0) + Number(r.total_amount || 0));
    }
    return m;
  }, [saleRows]);

  const settledByClient = useMemo(() => {
    // PHP: SUM(amount + discount)
    const m = new Map<number, number>();
    for (const r of settledRows) {
      m.set(r.client_id, (m.get(r.client_id) || 0) + Number(r.amount || 0) + Number(r.discount || 0));
    }
    return m;
  }, [settledRows]);

  const filteredPayments = useMemo(() => {
    if (filterClientId === "all") return payments;
    const cid = Number(filterClientId);
    return payments.filter((p) => p.client_id === cid);
  }, [payments, filterClientId]);

  const openReceipt = async (paymentId: number) => {
    setReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptPayment(null);
    setReceiptClient(null);
    try {
      const { data: p, error: pe } = await supabase
        .from("client_payments")
        .select("id, client_id, payment_date, amount, discount, payment_mode, remarks")
        .eq("id", paymentId)
        .single();
      if (pe) throw pe;
      setReceiptPayment(p as PaymentRow);

      const { data: c, error: ce } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, address")
        .eq("id", (p as any).client_id)
        .single();
      if (ce) throw ce;
      setReceiptClient(c as Client);
    } catch (e: any) {
      setErr(e?.message || "Failed to load receipt");
      setReceiptOpen(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const deletePayment = async (paymentId: number) => {
    if (!confirm("Delete this payment permanently?")) return;
    const { error } = await supabase.from("client_payments").delete().eq("id", paymentId);
    if (error) {
      alert(error.message);
      return;
    }
    // refresh list quickly (local update)
    setPayments((p) => p.filter((x) => x.id !== paymentId));
    setSettledRows((s) => s.filter((x) => (x as any).id !== paymentId)); // best-effort; settledRows doesn't include id
  };

  const printReceipt = () => {
    const el = document.getElementById("receipt-print");
    if (!el) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 20px; }
            .muted { color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; }
            th { background: #f8fafc; text-align: left; }
            .right { text-align: right; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #e0f2fe; color: #075985; font-weight: 700; font-size: 12px; }
            .total { background: #0f172a; color: white; font-weight: 800; }
          </style>
        </head>
        <body>
          ${el.innerHTML}
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => {
      w.print();
      setTimeout(() => w.close(), 250);
    }, 400);
  };

  const saveNewPayment = async () => {
    const cid = Number(newClientId);
    const amt = Number(newAmount);
    const disc = Number(newDiscount || 0);
    if (!cid) return alert("Select client");
    if (!amt || amt <= 0) return alert("Enter valid amount");

    setSaving(true);
    try {
      const { error } = await supabase.from("client_payments").insert([
        {
          client_id: cid,
          amount: amt,
          discount: disc || 0,
          payment_mode: newMode,
          payment_date: `${newDate}T00:00:00+05:30`,
          remarks: newRemarks.trim() || null,
        },
      ]);
      if (error) throw error;
      setNewOpen(false);
      setNewClientId("");
      setNewAmount("");
      setNewDiscount("0");
      setNewMode("Cash");
      setNewRemarks("");
      // reload
      setLoading(true);
    } catch (e: any) {
      alert(e?.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!loading) return;
      setErr("");
      try {
        const [{ data: cs, error: ce }, { data: ps, error: pe }] = await Promise.all([
          supabase
            .from("client_list")
            .select("id, firstname, middlename, lastname, contact, address")
            .eq("delete_flag", 0)
            .order("firstname", { ascending: true }),
          supabase
            .from("client_payments")
            .select("id, client_id, payment_date, amount, discount, payment_mode, remarks")
            .order("payment_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(500),
        ]);
        if (ce) throw ce;
        if (pe) throw pe;
        setClients((cs || []) as Client[]);
        const pList = (ps || []) as PaymentRow[];
        setPayments(pList);

        const ids = Array.from(new Set(pList.map((p) => p.client_id)));
        const idsStr = ids.map(String);

        if (ids.length === 0) {
          setRepairRows([]);
          setSaleRows([]);
          setSettledRows([]);
          setLoading(false);
          return;
        }

        // PHP parity: repair billed uses transaction_list status=5, client_name stores client_id as TEXT
        const [rep, sales, settled] = await Promise.all([
          supabase
            .from("transaction_list")
            .select("client_name, amount")
            .eq("status", 5)
            .in("client_name", idsStr),
          supabase
            .from("direct_sales")
            .select("client_id, total_amount")
            .in("client_id", ids),
          supabase
            .from("client_payments")
            .select("client_id, amount, discount")
            .in("client_id", ids),
        ]);
        if (rep.error) throw rep.error;
        if (sales.error) throw sales.error;
        if (settled.error) throw settled.error;

        setRepairRows((rep.data || []) as any);
        setSaleRows((sales.data || []) as any);
        setSettledRows((settled.data || []) as any);
      } catch (e: any) {
        setErr(e?.message || "Failed to load payments");
      } finally {
        setLoading(false);
      }
    })();
  }, [loading]);

  return (
    <AdminPage title="Payments" subtitle="PHP parity: Client payments + receipt + due">
      <div className="flex flex-col gap-4">
        <div className={`${card} p-4 flex flex-col md:flex-row md:items-end gap-3 md:justify-between`}>
          <div className="flex-1 min-w-0">
            <div className={label}>Filter by Client</div>
            <select
              className={input}
              value={filterClientId}
              onChange={(e) => setFilterClientId(e.target.value as any)}
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {clientName(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className={btnNavy} onClick={() => setNewOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Plus size={14} /> Record New Payment
              </span>
            </button>
            <button className={btnGhost} onClick={() => setLoading(true)} title="Refresh">
              Refresh
            </button>
          </div>
        </div>

        {err && <div className={`${card} p-4 text-red-400 text-sm`}>{err}</div>}

        {loading ? (
          <div className={`${card} p-10 flex items-center justify-center gap-2 text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]`}>
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : (
          <div className={card}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-4 py-3">Payment ID</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Client</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-right px-4 py-3">Discount</th>
                    <th className="text-left px-4 py-3">Mode</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {filteredPayments.map((p) => {
                    const c = clientById.get(p.client_id);
                    const totalRepair = billedRepairByClient.get(p.client_id) || 0;
                    const totalSales = billedSalesByClient.get(p.client_id) || 0;
                    const totalBill = totalRepair + totalSales;
                    const totalSettled = settledByClient.get(p.client_id) || 0;
                    const due = totalBill - totalSettled;
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <button
                            className="text-blue-400 font-black hover:text-blue-300 transition-colors"
                            onClick={() => openReceipt(p.id)}
                          >
                            {padPy(p.id)}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {String(p.payment_date).slice(0, 10)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="leading-tight">
                            <div className="text-slate-200 font-black">
                              {clientName(c)}
                            </div>
                            <div className="text-slate-600 text-xs">
                              Total Bill: {money(totalBill)} · Balance Due:{" "}
                              <span className="text-red-300 font-black">{money(due)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-200 font-bold">
                          {money(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-300 font-black">
                          {money(p.discount || 0)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-black">
                            {p.payment_mode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button className={btnGhost} onClick={() => openReceipt(p.id)}>
                              <span className="inline-flex items-center gap-2">
                                <Receipt size={14} /> Receipt
                              </span>
                            </button>
                            <button className={btnDanger} onClick={() => deletePayment(p.id)}>
                              <span className="inline-flex items-center gap-2">
                                <Trash2 size={14} /> Delete
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-600" colSpan={7}>
                        No payments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Receipt Modal */}
        {receiptOpen && (
          <div className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#0d1117] border border-[#21293d] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#21293d] flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-black">
                  <IndianRupee size={18} /> Payment Receipt
                </div>
                <button className={btnGhost} onClick={() => setReceiptOpen(false)}>
                  <span className="inline-flex items-center gap-2"><X size={14} /> Close</span>
                </button>
              </div>

              {receiptLoading ? (
                <div className="p-10 flex items-center justify-center gap-2 text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
                  <Loader2 size={16} className="animate-spin" /> Loading...
                </div>
              ) : receiptPayment && receiptClient ? (
                <>
                  <div className="p-5">
                    <div id="receipt-print">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-slate-900 font-black text-lg">V-Technologies</div>
                          <div className="muted">Payment Receipt</div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-900 font-black text-xl">{padPy(receiptPayment.id)}</div>
                          <div className="muted">
                            Date: {String(receiptPayment.payment_date).slice(0, 10)}
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 12 }} />

                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="muted">Received From:</div>
                          <div className="text-slate-900 font-black">{clientName(receiptClient)}</div>
                          <div className="muted">{receiptClient.contact || ""}</div>
                          <div className="muted">{receiptClient.address || ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="muted">Payment Mode:</div>
                          <span className="badge">{receiptPayment.payment_mode}</span>
                        </div>
                      </div>

                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th className="right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Payment Received</td>
                            <td className="right"><b>{money(receiptPayment.amount)}</b></td>
                          </tr>
                          {Number(receiptPayment.discount || 0) > 0 && (
                            <tr>
                              <td><i>Discount Applied</i></td>
                              <td className="right" style={{ color: "#b91c1c" }}>
                                - {money(receiptPayment.discount || 0)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th className="total">Total Settled Amount</th>
                            <th className="right total">
                              {money(Number(receiptPayment.amount || 0) + Number(receiptPayment.discount || 0))}
                            </th>
                          </tr>
                        </tfoot>
                      </table>

                      <div style={{ height: 14 }} />
                      <div className="muted" style={{ textAlign: "center" }}>
                        This is a computer-generated receipt.
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-[#21293d] flex items-center justify-end gap-2">
                    <button className={btnGhost} onClick={printReceipt}>
                      <span className="inline-flex items-center gap-2"><Printer size={14} /> Print</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6 text-slate-600">No data.</div>
              )}
            </div>
          </div>
        )}

        {/* New Payment Modal */}
        {newOpen && (
          <div className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#0d1117] border border-[#21293d] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#21293d] flex items-center justify-between">
                <div className="text-white font-black">Record New Payment</div>
                <button className={btnGhost} onClick={() => setNewOpen(false)} disabled={saving}>
                  <span className="inline-flex items-center gap-2"><X size={14} /> Close</span>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className={label}>Client</div>
                  <select className={input} value={newClientId} onChange={(e) => setNewClientId(e.target.value)}>
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {clientName(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className={label}>Payment Date</div>
                    <input className={input} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  </div>
                  <div>
                    <div className={label}>Payment Mode</div>
                    <select className={input} value={newMode} onChange={(e) => setNewMode(e.target.value)}>
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank">Bank</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className={label}>Amount</div>
                    <input className={input} type="number" step="any" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <div className={label}>Discount</div>
                    <input className={input} type="number" step="any" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <div className={label}>Remarks</div>
                  <input className={input} value={newRemarks} onChange={(e) => setNewRemarks(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-[#21293d] flex items-center justify-end gap-2">
                <button className={btnGhost} onClick={() => setNewOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button className={btnNavy} onClick={saveNewPayment} disabled={saving}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving</span>
                  ) : (
                    "Save Payment"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}

