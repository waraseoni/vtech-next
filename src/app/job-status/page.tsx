"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, ChevronRight, Printer, Share2, ArrowLeft, RotateCcw } from "lucide-react";
import Navbar from "../components/Navbar";

type JobData = {
  id: number;
  job_id: string;
  code: string;
  item: string;
  fault: string;
  remark: string;
  status: number;
  amount: number;
  client_name: string;
  date_created: string;
};

type RecentJob = { id: number; job_id: string; code: string; item: string; status: number; date_created: string };

type Service = { service_name: string; price: number };
type Product = { product_name: string; qty: number; price: number; total: number };

const STATUS_CONFIG: Record<number, { label: string; color: string; bg: string; desc: string }> = {
  0: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.2)", desc: "Kaam shuru nahi hua hai" },
  1: { label: "On-Progress", color: "#667eea", bg: "rgba(102,126,234,0.2)", desc: "Kaam chal raha hai" },
  2: { label: "Done", color: "#3b82f6", bg: "rgba(59,130,246,0.2)", desc: "Kaam pura ho gaya hai" },
  3: { label: "Paid", color: "#10b981", bg: "rgba(16,185,129,0.2)", desc: "Payment ho chuka hai" },
  4: { label: "Cancelled", color: "#ef4444", bg: "rgba(239,68,68,0.2)", desc: "Transaction radd ho gaya" },
  5: { label: "Delivered", color: "#059669", bg: "rgba(5,150,105,0.2)", desc: "Aapko item mil chuka hai" },
};

export default function JobStatusPage() {
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"job_id" | "code">("job_id");
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<JobData | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"detailed" | "compact" | "timeline">("detailed");
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    supabase.from("transaction_list")
      .select("id, job_id, code, item, status, date_created")
      .order("id", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setRecentJobs(data || []);
        setRecentLoading(false);
      });
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) { setError("Job ID ya Code daalo!"); return; }

    setLoading(true);
    setError("");
    setJob(null);

    try {
      // Transaction search - without join since relationship doesn't exist
      let query = supabase
        .from("transaction_list")
        .select("id, job_id, code, item, fault, remark, status, amount, client_name, date_created")
        .limit(1);

      if (searchType === "job_id") {
        query = query.eq("job_id", search.trim());
      } else {
        query = query.eq("code", search.trim());
      }

      const { data: txnData, error: txnErr } = await query;

if (txnErr || !txnData || txnData.length === 0) {
        setError(txnErr ? "Error: " + txnErr.message : "Job nahi mila! Sahi Job ID ya Code daalo.");
        setLoading(false);
        return;
      }

      const txn = txnData[0] as any;

      setJob({
        id: txn.id,
        job_id: txn.job_id,
        code: txn.code,
        item: txn.item,
        fault: txn.fault,
        remark: txn.remark,
        status: txn.status,
        amount: txn.amount,
        client_name: txn.client_name,
        date_created: txn.date_created,
      });

      setClientName(txn.client_name || "");
      setClientContact("");

      // Fetch services
      const { data: svcData } = await supabase
        .from("transaction_services")
        .select("service_id, price")
        .eq("transaction_id", txn.id);

      const serviceIds = (svcData || []).map((s: any) => s.service_id).filter(Boolean);
      const serviceNames: Record<number, string> = {};
      if (serviceIds.length > 0) {
        const { data: services } = await supabase.from("service_list").select("id, name").in("id", serviceIds);
        if (services) services.forEach((s: any) => { serviceNames[s.id] = s.name; });
      }

      setServices((svcData || []).map((s: any) => ({
        service_name: serviceNames[s.service_id] || "Unknown",
        price: s.price,
      })));

      // Fetch products
      const { data: prodData } = await supabase
        .from("transaction_products")
        .select("product_id, qty, price")
        .eq("transaction_id", txn.id);

      const productIds = (prodData || []).map((p: any) => p.product_id).filter(Boolean);
      const productNames: Record<number, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase.from("product_list").select("id, name").in("id", productIds);
        if (products) products.forEach((p: any) => { productNames[p.id] = p.name; });
      }

      setProducts((prodData || []).map((p: any) => ({
        product_name: productNames[p.product_id] || "Unknown",
        qty: p.qty,
        price: p.price,
        total: p.qty * p.price,
      })));

    } catch (err: any) {
      setError(err.message || "Search mein error aayi!");
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = job ? STATUS_CONFIG[job.status] || { label: "Unknown", color: "#6b7280", bg: "rgba(107,114,128,0.2)", desc: "Status unknown" } : null;
  const totalServices = services.reduce((s, sv) => s + sv.price, 0);
  const totalProducts = products.reduce((s, p) => s + p.total, 0);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0f0f1a] text-white py-6 px-4">

        {/* ══ SEARCH FORM (exact match PHP check_status.php) ════════════ */}
        {!job && (
          <div className="max-w-xl mx-auto text-center">
            <h1 className="text-3xl font-black mb-2" style={{ color: "white" }}>
              Check Your Repair Status
            </h1>
            <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>
              Apna Job ID ya Repair Code daalkar apne repair ka status check karein
            </p>

            <form onSubmit={handleSearch} style={{
              background: "#1a1a2e", borderRadius: "20px", padding: "2rem",
              border: "1px solid rgba(59,130,246,0.2)",
            }}>
              {/* Search Type Toggle */}
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => setSearchType("job_id")}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                  style={{
                    background: searchType === "job_id" ? "#3b82f6" : "rgba(255,255,255,0.1)",
                    color: searchType === "job_id" ? "white" : "#94a3b8",
                    border: "none", cursor: "pointer",
                  }}>
                  Job ID
                </button>
                <button type="button" onClick={() => setSearchType("code")}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                  style={{
                    background: searchType === "code" ? "#3b82f6" : "rgba(255,255,255,0.1)",
                    color: searchType === "code" ? "white" : "#94a3b8",
                    border: "none", cursor: "pointer",
                  }}>
                  Repair Code
                </button>
              </div>

              {error && (
                <div style={{ background: "#2c0b0e", border: "1px solid #842029", color: "#ea868f", padding: "0.75rem", borderRadius: "10px", marginBottom: "1rem", fontSize: "0.875rem" }}>
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={searchType === "job_id" ? "Enter Job ID (e.g. 27950)" : "Enter Repair Code (e.g. 2026032001)"}
                  className="flex-1 px-4 py-3 rounded-xl text-sm"
                  style={{ background: "#0f0f1a", border: "1px solid #4b4b5a", color: "white", outline: "none" }} />
                <button type="submit" disabled={loading}
                  style={{
                    background: "#3b82f6", color: "white", border: "none", borderRadius: "12px",
                    padding: "0 1.5rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                  }}>
                  {loading ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                  Search
                </button>
              </div>
            </form>

            {/* Recent Jobs for reference */}
            {!recentLoading && recentJobs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold mb-3" style={{ color: "#94a3b8" }}>Recent Jobs (for reference)</h3>
                <div style={{ background: "#1a1a2e", borderRadius: "15px", overflow: "hidden" }}>
                  {recentJobs.map(job => (
                    <button key={job.id} onClick={() => { setSearch(job.job_id); setSearchType("job_id"); }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition text-left"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <span className="font-bold text-blue-400">#{job.job_id}</span>
                        <span className="text-xs ml-2 text-slate-500">{job.item}</span>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full" style={{ 
                        background: STATUS_CONFIG[job.status]?.bg || "rgba(255,255,255,0.1)",
                        color: STATUS_CONFIG[job.status]?.color || "#94a3b8"
                      }}>
                        {STATUS_CONFIG[job.status]?.label || "Unknown"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ JOB STATUS DISPLAY (exact match PHP view_status.php) ════ */}
        {job && statusInfo && (
          <div className="max-w-4xl mx-auto">

            {/* Back + Actions */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { setJob(null); setSearch(""); setError(""); setServices([]); setProducts([]); }}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
                style={{ color: "#3b82f6", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", cursor: "pointer" }}>
                <RotateCcw size={16}/> Search Again
              </button>
              <div className="flex gap-2">
                <button onClick={() => window.open(`/api/print-job-status?job_id=${job.job_id}`, "_blank")} style={{
                  background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "10px", padding: "0.5rem 1rem", fontSize: "0.8rem", cursor: "pointer",
                }}>
                  <Printer size={14} className="inline mr-1"/> Print
                </button>
              </div>
            </div>

            {/* Status Overview Card */}
            <div style={{
              background: "linear-gradient(135deg, rgba(22,22,42,0.9), rgba(26,26,46,0.9))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "25px",
              overflow: "hidden",
              marginBottom: "2rem",
              borderTop: `4px solid ${statusInfo.color}`,
            }}>
              <div className="flex items-center justify-between p-6" style={{ background: "linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))" }}>
                <div>
                  <h2 className="text-xl font-black mb-1">Job Status Tracker</h2>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    Job #{job.job_id} | Code: {job.code}
                  </p>
                </div>
                <div style={{
                  background: statusInfo.bg, border: `2px solid ${statusInfo.color}`,
                  color: statusInfo.color, padding: "0.8rem 1.5rem", borderRadius: "50px",
                  fontWeight: 700, fontSize: "1.1rem",
                }}>
                  {statusInfo.label}
                </div>
              </div>

              {/* View Tabs */}
              <div className="flex gap-1 p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                {(["detailed", "compact", "timeline"] as const).map(tab => (
                  <button key={tab} onClick={() => setView(tab)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                    style={{
                      background: view === tab ? "#3b82f6" : "rgba(255,255,255,0.05)",
                      color: view === tab ? "white" : "#94a3b8",
                      border: "none", cursor: "pointer",
                    }}>
                    {tab === "detailed" ? "Detailed View" : tab === "compact" ? "Compact View" : "Timeline"}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* DETAILED VIEW */}
                {view === "detailed" && (
                  <div className="space-y-6">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Job Number", value: job.job_id, icon: "#" },
                        { label: "Repair Code", value: job.code, icon: "🔧" },
                        { label: "Item", value: job.item, icon: "📦" },
                        { label: "Fault", value: job.fault, icon: "⚠️" },
                      ].map(info => (
                        <div key={info.label} style={{ background: "rgba(26,26,46,0.5)", borderRadius: "15px", padding: "1rem" }}>
                          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>
                            <span className="mr-1">{info.icon}</span> {info.label}
                          </p>
                          <p className="font-bold text-sm" style={{ color: "white" }}>{info.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Services */}
                    {services.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold mb-3" style={{ color: "#3b82f6" }}>🔧 Services Provided</h3>
                        <div style={{ background: "rgba(26,26,46,0.5)", borderRadius: "15px", overflow: "hidden" }}>
                          {services.map((sv, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <span>{sv.service_name}</span>
                              <span className="font-bold" style={{ color: "#3b82f6" }}>₹{sv.price.toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center px-4 py-3 font-bold" style={{ background: "rgba(59,130,246,0.05)" }}>
                            <span>Total Services</span>
                            <span style={{ color: "#3b82f6" }}>₹{totalServices.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Products */}
                    {products.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold mb-3" style={{ color: "#10b981" }}>📦 Products Used</h3>
                        <div style={{ background: "rgba(26,26,46,0.5)", borderRadius: "15px", overflow: "hidden" }}>
                          {products.map((p, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <div>
                                <span className="font-bold">{p.product_name}</span>
                                <span className="text-xs ml-2" style={{ color: "#6b7280" }}>Qty: {p.qty}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold" style={{ color: "#10b981" }}>₹{p.total.toLocaleString("en-IN")}</span>
                                <span className="text-xs block" style={{ color: "#6b7280" }}>₹{p.price.toLocaleString("en-IN")} each</span>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between items-center px-4 py-3 font-bold" style={{ background: "rgba(16,185,129,0.05)" }}>
                            <span>Total Products</span>
                            <span style={{ color: "#10b981" }}>₹{totalProducts.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Amount */}
                    <div className="text-center p-6" style={{
                      background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))",
                      border: "2px solid #10b981", borderRadius: "20px",
                    }}>
                      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>Total Payable Amount</p>
                      <p className="text-4xl font-black" style={{
                        background: "linear-gradient(45deg, #10b981, #34d399)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      }}>
                        ₹{job.amount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>Includes all services and products</p>
                    </div>

                    {/* Remarks */}
                    {job.remark && (
                      <div style={{ background: "rgba(26,26,46,0.5)", borderRadius: "15px", padding: "1rem" }}>
                        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#6b7280" }}>💬 Additional Remarks</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: "#cbd5e1" }}>{job.remark}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* COMPACT VIEW */}
                {view === "compact" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Job Number", value: job.job_id },
                          { label: "Repair Code", value: job.code },
                          { label: "Item", value: job.item },
                          { label: "Fault", value: job.fault },
                        ].map(info => (
                          <div key={info.label} style={{ background: "rgba(26,26,46,0.5)", borderRadius: "10px", padding: "0.75rem" }}>
                            <p className="text-[10px] uppercase" style={{ color: "#6b7280" }}>{info.label}</p>
                            <p className="font-bold text-sm">{info.value}</p>
                          </div>
                        ))}
                      </div>
                      {services.length > 0 && (
                        <div style={{ background: "rgba(26,26,46,0.5)", borderRadius: "10px", overflow: "hidden" }}>
                          {services.map((sv, i) => (
                            <div key={i} className="flex justify-between px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <span className="text-sm">{sv.service_name}</span>
                              <span className="text-sm font-bold" style={{ color: "#3b82f6" }}>₹{sv.price.toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-center p-4" style={{ background: statusInfo.bg, borderRadius: "15px", border: `1px solid ${statusInfo.color}` }}>
                      <p className="text-[10px] uppercase" style={{ color: statusInfo.color }}>Current Status</p>
                      <p className="text-xl font-black" style={{ color: statusInfo.color }}>{statusInfo.label}</p>
                      <p className="text-xs mt-1" style={{ color: statusInfo.color }}>{statusInfo.desc}</p>
                      <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                        <p className="text-xs" style={{ color: "#94a3b8" }}>Total Amount</p>
                        <p className="text-xl font-black" style={{ color: "#10b981" }}>₹{job.amount.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TIMELINE VIEW */}
                {view === "timeline" && (
                  <div className="relative pl-6" style={{ borderLeft: "2px solid rgba(59,130,246,0.3)" }}>
                    {[0, 1, 2, 3, 5].map(step => {
                      const info = STATUS_CONFIG[step] || STATUS_CONFIG[0];
                      const isCompleted = step < job.status;
                      const isCurrent = step === job.status;
                      return (
                        <div key={step} className="relative mb-6">
                          <div style={{
                            position: "absolute", left: "-23px", top: "5px",
                            width: "12px", height: "12px", borderRadius: "50%",
                            background: isCompleted ? "#10b981" : isCurrent ? statusInfo.color : "#374151",
                            boxShadow: isCurrent ? `0 0 0 4px ${statusInfo.bg}` : isCompleted ? "0 0 0 4px rgba(16,185,129,0.2)" : "none",
                          }}/>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold" style={{ color: isCompleted ? "#10b981" : isCurrent ? statusInfo.color : "#94a3b8" }}>
                              {info.label}
                            </span>
                            {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.color }}>Current</span>}
                          </div>
                          <p className="text-xs" style={{ color: "#6b7280" }}>{info.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
