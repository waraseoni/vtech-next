"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { formatIST, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

type Client = { id: number; name: string };

type JobRow = {
  id: number;
  job_id: string | null;
  code: string | null;
  item: string | null;
  client_name: string;
  status: number;
  amount: number;
  date_created: string;
  date_completed: string | null;
};

type ProductLine = {
  transaction_id: number;
  product_name: string | null;
  qty: number | null;
  price: number | null;
};

type ServiceLine = {
  transaction_id: number;
  service_name: string | null;
  price: number | null;
};

type AggRow = {
  job: JobRow;
  sparesAmount: number;
  sparesQty: number;
  sparesCount: number;
  sparesLines: ProductLine[];
  servicesAmount: number;
  servicesCount: number;
  servicesLines: ServiceLine[];
  total: number;
};

const STATUS_LABEL: Record<number, string> = {
  0: "Pending",
  1: "In Progress",
  2: "Done",
  3: "Paid",
  4: "Cancelled",
  5: "Delivered",
};

const fmt = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("client_list")
    .select("id, firstname, middlename, lastname")
    .eq("delete_flag", 0)
    .order("firstname", { ascending: true });
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    name:
      [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim() || `Client #${c.id}`,
  }));
}

async function fetchReport(params: {
  clientId: string;
  from: string;
  to: string;
  status: string;
}): Promise<{ jobs: JobRow[]; products: ProductLine[]; services: ServiceLine[] }> {
  let q = supabase
    .from("transaction_list")
    .select("id, job_id, code, item, client_name, status, amount, date_created, date_completed")
    .eq("del_status", 0)
    .order("date_created", { ascending: false });

  if (params.clientId) q = q.eq("client_name", params.clientId);
  if (params.from) q = q.gte("date_created", `${params.from}T00:00:00+05:30`);
  if (params.to) q = q.lte("date_created", `${params.to}T23:59:59+05:30`);
  if (params.status && params.status !== "all") q = q.eq("status", Number(params.status));

  const { data: jobs, error: je } = await q.limit(2000);
  if (je) throw je;
  const jobRows = (jobs || []) as JobRow[];
  const ids = jobRows.map((j) => j.id);
  if (ids.length === 0) return { jobs: jobRows, products: [], services: [] };

  const prodChunks = chunk(ids, 200);
  const svcChunks = chunk(ids, 200);

  const [prodRes, svcRes] = await Promise.all([
    Promise.all(
      prodChunks.map((c) =>
        supabase
          .from("transaction_products")
          .select("transaction_id, product_name, qty, price")
          .in("transaction_id", c)
      )
    ),
    Promise.all(
      svcChunks.map((c) =>
        supabase
          .from("transaction_services")
          .select("transaction_id, service_name, price")
          .in("transaction_id", c)
      )
    ),
  ]);

  const products: ProductLine[] = [];
  for (const r of prodRes) {
    if (r.error) throw r.error;
    products.push(...((r.data || []) as ProductLine[]));
  }
  const services: ServiceLine[] = [];
  for (const r of svcRes) {
    if (r.error) throw r.error;
    services.push(...((r.data || []) as ServiceLine[]));
  }
  return { jobs: jobRows, products, services };
}

export default function ClientPartsServiceReportPage() {
  const [clientId, setClientId] = useState<string>("");
  const [clientQuery, setClientQuery] = useState<string>("");
  const [clientOpen, setClientOpen] = useState<boolean>(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [statusQuery, setStatusQuery] = useState<string>("");
  const [statusOpen, setStatusOpen] = useState<boolean>(false);
  const [applied, setApplied] = useState<{
    clientId: string;
    from: string;
    to: string;
    status: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients-list-min"],
    queryFn: fetchClients,
    staleTime: 60_000,
  });

  // default month range on first load
  useEffect(() => {
    if (!fromDate && !toDate) {
      setFromDate(startOfMonthIST());
      setToDate(endOfMonthIST());
    }
  }, [fromDate, toDate]);

  const params = applied || { clientId, from: fromDate, to: toDate, status };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["client-parts-service", params.clientId, params.from, params.to, params.status],
    queryFn: () => fetchReport(params),
    enabled: !!applied || true,
    staleTime: 15_000,
  });

  const agg: AggRow[] = useMemo(() => {
    if (!data) return [];
    const prodByJob = new Map<
      number,
      { amount: number; qty: number; count: number; lines: ProductLine[] }
    >();
    for (const p of data.products) {
      const cur = prodByJob.get(p.transaction_id) || { amount: 0, qty: 0, count: 0, lines: [] };
      const price = Number(p.price) || 0;
      const qty = Number(p.qty) || 0;
      cur.amount += price * qty;
      cur.qty += qty;
      cur.count += 1;
      cur.lines.push(p);
      prodByJob.set(p.transaction_id, cur);
    }
    const svcByJob = new Map<number, { amount: number; count: number; lines: ServiceLine[] }>();
    for (const s of data.services) {
      const cur = svcByJob.get(s.transaction_id) || { amount: 0, count: 0, lines: [] };
      cur.amount += Number(s.price) || 0;
      cur.count += 1;
      cur.lines.push(s);
      svcByJob.set(s.transaction_id, cur);
    }
    return data.jobs.map((j) => {
      const p = prodByJob.get(j.id) || { amount: 0, qty: 0, count: 0, lines: [] };
      const s = svcByJob.get(j.id) || { amount: 0, count: 0, lines: [] };
      return {
        job: j,
        sparesAmount: p.amount,
        sparesQty: p.qty,
        sparesCount: p.count,
        sparesLines: p.lines,
        servicesAmount: s.amount,
        servicesCount: s.count,
        servicesLines: s.lines,
        total: p.amount + s.amount,
      };
    });
  }, [data]);

  const totals = useMemo(() => {
    return agg.reduce(
      (acc, r) => {
        acc.jobs += 1;
        acc.spares += r.sparesAmount;
        acc.sparesQty += r.sparesQty;
        acc.services += r.servicesAmount;
        acc.grand += r.total;
        return acc;
      },
      { jobs: 0, spares: 0, sparesQty: 0, services: 0, grand: 0 }
    );
  }, [agg]);

  const handleApply = () => {
    setApplied({ clientId, from: fromDate, to: toDate, status });
  };

  const handleExport = () => {
    const header = [
      "Job ID",
      "Code",
      "Item",
      "Client",
      "Status",
      "Date",
      "Spares (₹)",
      "Spares Qty",
      "Services (₹)",
      "Service Count",
      "Total (₹)",
    ];
    const lines = [header.join(",")];
    for (const r of agg) {
      lines.push(
        [
          r.job.job_id || r.job.id,
          r.job.code || "",
          `"${(r.job.item || "").replace(/"/g, '""')}"`,
          r.job.client_name,
          STATUS_LABEL[r.job.status] || r.job.status,
          r.job.date_created?.slice(0, 10) || "",
          r.sparesAmount.toFixed(2),
          r.sparesQty,
          r.servicesAmount.toFixed(2),
          r.servicesCount,
          r.total.toFixed(2),
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `client-parts-service-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "5", label: "Delivered" },
    { value: "2", label: "Done" },
    { value: "0", label: "Pending" },
    { value: "1", label: "In Progress" },
    { value: "3", label: "Paid" },
  ];

  const selectedClient = clients.find((c) => String(c.id) === clientId);
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, clientQuery]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const shiftMonth = (delta: number) => {
    const base = fromDate ? new Date(fromDate + "T00:00:00") : new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    setFromDate(`${y}-${pad(m + 1)}-01`);
    setToDate(`${y}-${pad(m + 1)}-${pad(last)}`);
  };
  const thisMonth = () => {
    setFromDate(startOfMonthIST());
    setToDate(endOfMonthIST());
  };

  const err = error instanceof Error ? error.message : error ? "Data load failed" : "";

  return (
    <AdminPage
      title="Parts vs Service (Client)"
      subtitle="Client ke jobs me lage spares (products) vs services ka amount"
      allowStaff
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-panel border border-app rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="bg-panel-2 border border-app hover:bg-panel text-sm font-bold rounded-lg px-3 py-1.5"
            >
              ← Prev Month
            </button>
            <button
              type="button"
              onClick={thisMonth}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg px-3 py-1.5"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="bg-panel-2 border border-app hover:bg-panel text-sm font-bold rounded-lg px-3 py-1.5"
            >
              Next Month →
            </button>
            <span className="text-[10px] text-muted ml-2">
              {fromDate && toDate ? `${fromDate} → ${toDate}` : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                Client (type to search)
              </label>
              <input
                type="text"
                value={
                  clientOpen
                    ? clientQuery
                    : selectedClient?.name || (clientId ? `Client #${clientId}` : "")
                }
                placeholder="All clients — type name…"
                onFocus={() => {
                  setClientOpen(true);
                  setClientQuery("");
                }}
                onChange={(e) => {
                  setClientOpen(true);
                  setClientQuery(e.target.value);
                }}
                onBlur={() => setTimeout(() => setClientOpen(false), 150)}
                className="mt-1 w-full bg-panel-2 border border-app rounded-lg px-3 py-2 text-sm"
                disabled={clientsLoading}
              />
              {clientOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-panel border border-app rounded-lg shadow-lg">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setClientId("");
                      setClientQuery("");
                      setClientOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-panel-2 border-b border-app"
                  >
                    All clients
                  </button>
                  {filteredClients.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted">No match</div>
                  )}
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setClientId(String(c.id));
                        setClientQuery(c.name);
                        setClientOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-panel-2 ${
                        String(c.id) === clientId
                          ? "bg-violet-500/10 text-violet-400 font-bold"
                          : ""
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full bg-panel-2 border border-app rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full bg-panel-2 border border-app rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                Status (type to search)
              </label>
              <input
                type="text"
                value={
                  statusOpen
                    ? statusQuery
                    : STATUS_LABEL[Number(status)] || (status === "all" ? "All" : status)
                }
                placeholder="All — type status…"
                onFocus={() => {
                  setStatusOpen(true);
                  setStatusQuery("");
                }}
                onChange={(e) => {
                  setStatusOpen(true);
                  setStatusQuery(e.target.value);
                }}
                onBlur={() => setTimeout(() => setStatusOpen(false), 150)}
                className="mt-1 w-full bg-panel-2 border border-app rounded-lg px-3 py-2 text-sm"
              />
              {statusOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-panel border border-app rounded-lg shadow-lg">
                  {statusOptions
                    .filter((o) => o.label.toLowerCase().includes(statusQuery.trim().toLowerCase()))
                    .map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setStatus(o.value);
                          setStatusQuery("");
                          setStatusOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-panel-2 ${
                          status === o.value ? "bg-violet-500/10 text-violet-400 font-bold" : ""
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  {statusOptions.filter((o) =>
                    o.label.toLowerCase().includes(statusQuery.trim().toLowerCase())
                  ).length === 0 && <div className="px-3 py-2 text-sm text-muted">No match</div>}
                </div>
              )}
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleApply}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-lg px-4 py-2"
              >
                Apply
              </button>
              <button
                onClick={handleExport}
                disabled={agg.length === 0}
                className="bg-panel-2 border border-app hover:bg-panel text-sm font-bold rounded-lg px-3 py-2 disabled:opacity-50"
                title="Export CSV"
              >
                CSV
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
            {err}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-panel border border-app rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Jobs</p>
            <p className="text-2xl font-black mt-1 text-white">{totals.jobs}</p>
          </div>
          <div className="bg-panel border border-app rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              Spares (₹)
            </p>
            <p className="text-2xl font-black mt-1 text-amber-400">{fmt(totals.spares)}</p>
            <p className="text-[10px] text-muted mt-1">{totals.sparesQty} qty</p>
          </div>
          <div className="bg-panel border border-app rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              Services (₹)
            </p>
            <p className="text-2xl font-black mt-1 text-blue-400">{fmt(totals.services)}</p>
          </div>
          <div className="bg-panel border border-app rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              Grand Total (₹)
            </p>
            <p className="text-2xl font-black mt-1 text-emerald-400">{fmt(totals.grand)}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          <div className="px-4 py-2 text-[10px] text-muted border-b border-app">
            Tip: kisi bhi row par click karo us job ke spares (products) aur services ki detail
            dekhne ke liye.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel-2">
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted">
                  <th className="px-3 py-3">Job ID</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Item / Client</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Spares (₹)</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Services (₹)</th>
                  <th className="px-3 py-3 text-right">Svc #</th>
                  <th className="px-3 py-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && agg.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted">
                      No jobs found for the selected filters.
                    </td>
                  </tr>
                )}
                {agg.map((r) => (
                  <React.Fragment key={r.job.id}>
                    <tr
                      className="border-t border-app hover:bg-panel-2/40 cursor-pointer"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(r.job.id)) next.delete(r.job.id);
                          else next.add(r.job.id);
                          return next;
                        })
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {expanded.has(r.job.id) ? "▾" : "▸"} {r.job.job_id || r.job.id}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.job.date_created?.slice(0, 10)}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-xs truncate max-w-[220px]">
                          {r.job.item || "—"}
                        </div>
                        <div className="text-[10px] text-muted truncate max-w-[220px]">
                          {r.job.client_name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {STATUS_LABEL[r.job.status] || r.job.status}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-400 font-semibold">
                        {fmt(r.sparesAmount)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted">{r.sparesQty}</td>
                      <td className="px-3 py-2 text-right text-blue-400 font-semibold">
                        {fmt(r.servicesAmount)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted">{r.servicesCount}</td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-bold">
                        {fmt(r.total)}
                      </td>
                    </tr>
                    {expanded.has(r.job.id) && (
                      <tr className="bg-panel-2/30">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-black uppercase tracking-widest text-amber-400 mb-1">
                                Spares / Products ({r.sparesLines.length})
                              </div>
                              {r.sparesLines.length === 0 ? (
                                <div className="text-muted italic">No spares used</div>
                              ) : (
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-muted">
                                      <th className="text-left py-1">Part</th>
                                      <th className="text-right py-1">Qty</th>
                                      <th className="text-right py-1">Price</th>
                                      <th className="text-right py-1">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.sparesLines.map((p, i) => (
                                      <tr key={i} className="border-t border-app/40">
                                        <td className="py-1">{p.product_name || "—"}</td>
                                        <td className="py-1 text-right">{p.qty ?? 0}</td>
                                        <td className="py-1 text-right">
                                          {fmt(Number(p.price) || 0)}
                                        </td>
                                        <td className="py-1 text-right text-amber-400 font-semibold">
                                          {fmt((Number(p.price) || 0) * (Number(p.qty) || 0))}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                            <div>
                              <div className="font-black uppercase tracking-widest text-blue-400 mb-1">
                                Services ({r.servicesLines.length})
                              </div>
                              {r.servicesLines.length === 0 ? (
                                <div className="text-muted italic">No services</div>
                              ) : (
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-muted">
                                      <th className="text-left py-1">Service</th>
                                      <th className="text-right py-1">Price</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.servicesLines.map((s, i) => (
                                      <tr key={i} className="border-t border-app/40">
                                        <td className="py-1">{s.service_name || "—"}</td>
                                        <td className="py-1 text-right text-blue-400 font-semibold">
                                          {fmt(Number(s.price) || 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              {agg.length > 0 && (
                <tfoot className="bg-panel-2 font-bold">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-2 text-xs uppercase tracking-widest text-muted"
                    >
                      Total ({totals.jobs} jobs)
                    </td>
                    <td className="px-3 py-2 text-right text-amber-400">{fmt(totals.spares)}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted">{totals.sparesQty}</td>
                    <td className="px-3 py-2 text-right text-blue-400">{fmt(totals.services)}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right text-emerald-400">{fmt(totals.grand)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
